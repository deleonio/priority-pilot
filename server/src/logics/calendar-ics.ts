import type { Transaction } from 'sequelize';
import sequelize from '../database.js';
import { isPublicEndpoint } from '../llm/endpointGuard.js';
import { CalendarEvent, CalendarSource } from '../models/index.js';
import { fetchCaldavEvents } from './calendar-caldav.js';
import { decryptSecret } from './secret-crypto.js';

/**
 * Lesender Kalender-Abruf per ICS-Adresse (#2209, Spec `docs/spec/issue-2209.md`): holt die Datei
 * per GET, behält nur Termine mit Start von heute 00:00 UTC bis +14 Tage und davon nur Start, Ende,
 * Titel und ganztägig. Serientermine (`RRULE`) werden nicht aufgefaltet — es zählt das erste Vorkommen.
 * Die Adresse ist geheim und taucht in keiner Log-Zeile auf.
 */

/** Abruf-Intervall des Scheduler-Jobs (AK6). */
export const CALENDAR_SYNC_INTERVAL_MS = 30 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 14;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_ICS_BYTES = 5 * 1024 * 1024;

export interface ParsedEvent {
	start: Date;
	end: Date;
	title: string;
	allDay: boolean;
}

type IcsProperty = { params: string; value: string };

/** Versatz der Zeitzone `tz` gegenüber UTC zum Zeitpunkt `utcMs` in ms (Intl statt Zusatzpaket). */
const tzOffset = (utcMs: number, tz: string): number => {
	const parts = Object.fromEntries(
		new Intl.DateTimeFormat('en-US', {
			timeZone: tz,
			hourCycle: 'h23',
			year: 'numeric',
			month: 'numeric',
			day: 'numeric',
			hour: 'numeric',
			minute: 'numeric',
			second: 'numeric',
		})
			.formatToParts(utcMs)
			.map((part) => [part.type, Number(part.value)]),
	);
	return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - utcMs;
};

/**
 * `DATE` (`20261007`) = ganztägig, `DATE-TIME` mit `Z` = UTC, mit `TZID` = Ortszeit der Zone.
 * Ohne Zone oder bei unbekannter Zone gilt der Wert als UTC.
 */
const parseIcsDate = ({ params, value }: IcsProperty): { date: Date; allDay: boolean } | null => {
	const match = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(value.trim());
	if (!match) return null;
	const [, year, month, day, hour, minute, second, utc] = match;
	const local = Date.UTC(+year, +month - 1, +day, +(hour ?? 0), +(minute ?? 0), +(second ?? 0));
	if (hour === undefined) return { date: new Date(local), allDay: true };
	const tz = /(?:^|;)TZID=([^;]+)/.exec(params)?.[1].replace(/"/g, '');
	if (utc || !tz) return { date: new Date(local), allDay: false };
	try {
		return { date: new Date(local - tzOffset(local, tz)), allDay: false };
	} catch {
		return { date: new Date(local), allDay: false };
	}
};

const unescapeText = (value: string): string =>
	value.replace(/\\([\\;,nN])/g, (_, char: string) => (char.toLowerCase() === 'n' ? '\n' : char));

const toEvent = (props: Map<string, IcsProperty>): ParsedEvent | null => {
	const dtStart = props.get('DTSTART');
	const start = dtStart && parseIcsDate(dtStart);
	if (!start || props.get('STATUS')?.value === 'CANCELLED') return null;
	const dtEnd = props.get('DTEND');
	const end = dtEnd && parseIcsDate(dtEnd);
	return {
		start: start.date,
		end: end ? end.date : new Date(start.date.getTime() + (start.allDay ? DAY_MS : 0)),
		title: unescapeText(props.get('SUMMARY')?.value ?? ''),
		allDay: start.allDay,
	};
};

/** Abruf-Fenster `[heute 00:00 UTC, now + 14 Tage]` in ms (AK1/AK2). */
export const syncWindow = (now: Date): { from: number; to: number } => ({
	from: Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
	to: now.getTime() + WINDOW_DAYS * DAY_MS,
});

/** Termine mit Start im {@link syncWindow} (AK1/AK2). */
export const parseIcsEvents = (ics: string, now: Date): ParsedEvent[] => {
	const { from, to } = syncWindow(now);
	const events: ParsedEvent[] = [];
	let props: Map<string, IcsProperty> | null = null;
	// Verschachtelte Komponenten (VALARM) tragen eigene SUMMARY/DESCRIPTION — die zählen nicht.
	let nested = 0;
	// Gefaltete Zeilen (RFC 5545 3.1) vor dem Zerlegen wieder zusammenfügen.
	for (const line of ics.replace(/\r?\n[ \t]/g, '').split(/\r?\n/)) {
		if (!props) {
			if (line === 'BEGIN:VEVENT') props = new Map();
		} else if (line.startsWith('BEGIN:')) {
			nested++;
		} else if (nested > 0) {
			if (line.startsWith('END:')) nested--;
		} else if (line === 'END:VEVENT') {
			const event = toEvent(props);
			if (event && event.start.getTime() >= from && event.start.getTime() <= to) events.push(event);
			props = null;
		} else {
			const match = /^([A-Za-z-]+)((?:;[^:]*)?):(.*)$/.exec(line);
			if (match) props.set(match[1].toUpperCase(), { params: match[2], value: match[3] });
		}
	}
	return events;
};

/** Liest den Antwort-Body, bricht aber über `MAX_ICS_BYTES` ab — die Adresse ist nutzerdefiniert. */
const readLimited = async (response: Response): Promise<string> => {
	if (Number(response.headers.get('content-length')) > MAX_ICS_BYTES) throw new Error('Kalender-Datei zu groß');
	const chunks: Uint8Array[] = [];
	let size = 0;
	const reader = response.body?.getReader();
	for (let chunk = await reader?.read(); chunk && !chunk.done; chunk = await reader?.read()) {
		size += chunk.value.byteLength;
		if (size > MAX_ICS_BYTES) {
			await reader?.cancel();
			throw new Error('Kalender-Datei zu groß');
		}
		chunks.push(chunk.value);
	}
	return new TextDecoder().decode(Buffer.concat(chunks));
};

/**
 * Lädt die ICS-Datei — per GET, nie schreibend (AK6); `request` setzt nur der CalDAV-Abruf (#2211,
 * lesendes `REPORT`). SSRF-Sperre wie bei LLM-Endpoints (F-2): keine internen Ziele, keine
 * Redirects. `ICS_ALLOW_INTERNAL_HOSTS=1` hebt die Sperre nur für die Tests mit Loopback-Stub auf
 * (`test/helpers.ts`).
 */
export const fetchIcs = async (
	url: string,
	fetchImpl: typeof fetch = fetch,
	request: Pick<RequestInit, 'method' | 'headers' | 'body'> = { method: 'GET' },
): Promise<string> => {
	if (process.env.ICS_ALLOW_INTERNAL_HOSTS !== '1' && !(await isPublicEndpoint(url))) {
		throw new Error('Kalender-Adresse zeigt auf eine interne Adresse.');
	}
	const response = await fetchImpl(url, {
		...request,
		redirect: 'error',
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
	});
	if (!response.ok) throw new Error(`Kalender-Abruf mit Status ${response.status}`);
	return readLimited(response);
};

/** Ersetzt die gespeicherten Termine der Quelle (AK2: keine Dubletten bei erneutem Abruf). */
export const replaceCalendarEvents = async (
	source: CalendarSource,
	events: ParsedEvent[],
	transaction: Transaction,
): Promise<void> => {
	await CalendarEvent.destroy({ where: { sourceId: source.id }, transaction });
	await CalendarEvent.bulkCreate(
		events.map((event) => ({ ...event, userId: source.userId, sourceId: source.id })),
		{ transaction },
	);
};

/**
 * Scheduler-Job (AK6): ruft jede Quelle ab, CalDAV-Quellen mit entschlüsseltem Passwort (#2211);
 * eine fehlerhafte Quelle hält die übrigen nicht auf.
 */
export const runCalendarSync = async (now: Date = new Date(), fetchImpl: typeof fetch = fetch): Promise<void> => {
	for (const source of await CalendarSource.findAll()) {
		try {
			const events =
				source.type === 'caldav'
					? await fetchCaldavEvents(
							source.url,
							source.username ?? '',
							decryptSecret(source.passwordEncrypted ?? ''),
							now,
							fetchImpl,
						)
					: parseIcsEvents(await fetchIcs(source.url, fetchImpl), now);
			await sequelize.transaction(async (transaction) => {
				// Während des Abrufs gelöschte Quelle: keine verwaisten Termine anlegen.
				if (await CalendarSource.findByPk(source.id, { transaction })) {
					await replaceCalendarEvents(source, events, transaction);
				}
			});
		} catch {
			console.error(`Kalender-Abruf für Quelle ${source.id} fehlgeschlagen.`);
		}
	}
};

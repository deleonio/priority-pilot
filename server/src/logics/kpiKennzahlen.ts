import { createHmac } from 'node:crypto';
import { Op, col, fn } from 'sequelize';
import { ScoreEntry, Task, User } from '../models/index.js';
import KpiEvent, { type KpiArt } from '../models/kpiEvent.js';

/**
 * KPI-Messung der Markteinführung (#1989): anonyme Protokollierung von Aktivierung (Erledigung am
 * Registrierungstag), Tagesaktivität, geteilter Wochen-Karte und versandter Einladungen — plus die
 * Admin-Auswertung als Kohorten-Quoten. Wie `logics/careWirkung.ts` gilt: Tabelle und Antwort
 * enthalten keinen Personenbezug (HMAC-`dedupKey` statt `userId`), Zellen unter {@link MIN_ZELLE}
 * Nutzern werden unterdrückt und Fehler der Protokollierung werden nur geloggt — die auslösende
 * Anfrage darf daran nicht scheitern.
 */

const TAG_MS = 86_400_000;
/** Kleinste ausgewiesene Kohortengröße (AK6). */
const MIN_ZELLE = 5;

export type Zeitraum = 'woche' | 'monat';
type KpiZelle = { zaehler: number; nenner: number; quote: number } | 'unterdrueckt';

interface KpiZeile {
	periode: string;
	neueNutzer: number;
	aktivierung: KpiZelle;
	tag7: KpiZelle;
	wochenkarte: KpiZelle;
	einladungen: KpiZelle;
}

export interface KpiAuswertung {
	zeitraum: Zeitraum;
	zeilen: KpiZeile[];
}

export interface KpiEingabe {
	/** Kohorte ohne Admin-Konten — Personal zählt nicht zur Aktivierungs-Quote. */
	nutzer: { id: number; registriertAm: Date }[];
	erledigungen: { userId: number; zeitpunkt: Date }[];
	ereignisse: { tag: string; art: KpiArt; anzahl: number }[];
}

/** Montag 00:00 UTC der Woche von `zeitpunkt` (Muster `careWirkung`). */
const wochenStart = (zeitpunkt: Date): number => {
	const tag = Date.UTC(zeitpunkt.getUTCFullYear(), zeitpunkt.getUTCMonth(), zeitpunkt.getUTCDate());
	return tag - ((new Date(tag).getUTCDay() + 6) % 7) * TAG_MS;
};

const tagVon = (zeitpunkt: Date): string => zeitpunkt.toISOString().slice(0, 10);

/** Kalenderwoche (Montag, `YYYY-MM-DD`) bzw. Monat (`YYYY-MM`) eines Zeitpunkts. */
const periodeVon = (zeitpunkt: Date, zeitraum: Zeitraum): string =>
	zeitraum === 'monat' ? tagVon(zeitpunkt).slice(0, 7) : tagVon(new Date(wochenStart(zeitpunkt)));

const dedupSecret = (): string => process.env.SESSION_SECRET?.trim() || 'kpi';

/**
 * Dedup-Kontext je Ereignisart: `aktivierung` einmal je Konto, `aktivitaet` je Tag,
 * `wochenkarte` je Woche (Montag) und `einladung` je Paar und Tag.
 */
const dedupWert = (userId: number, art: KpiArt, jetzt: Date, eingeladenerUserId?: number): string => {
	switch (art) {
		case 'aktivierung':
			return `${userId}|aktivierung`;
		case 'wochenkarte':
			return `${userId}|wochenkarte|${tagVon(new Date(wochenStart(jetzt)))}`;
		case 'einladung':
			return `${userId}|einladung|${eingeladenerUserId ?? 0}|${tagVon(jetzt)}`;
		default:
			return `${userId}|aktivitaet|${tagVon(jetzt)}`;
	}
};

/**
 * Protokolliert ein anonymes KPI-Ereignis (AK1) — ein eindeutiger HMAC-`dedupKey` macht den
 * Aufruf idempotent, `ignoreDuplicates` schluckt das Duplikat. Fehler werden nur geloggt.
 */
export const protokolliereKpiEreignis = async (
	userId: number,
	art: KpiArt,
	jetzt = new Date(),
	eingeladenerUserId?: number,
): Promise<void> => {
	try {
		await KpiEvent.create(
			{
				tag: tagVon(jetzt),
				art,
				dedupKey: createHmac('sha256', dedupSecret())
					.update(dedupWert(userId, art, jetzt, eingeladenerUserId))
					.digest('hex'),
			},
			{ ignoreDuplicates: true },
		);
	} catch (error) {
		console.warn('KPI-Ereignis nicht protokolliert:', error);
	}
};

/**
 * Erledigung eines Kontos (AK2): am UTC-Kalendertag der Registrierung zählt sie als
 * `aktivierung` (einmal je Konto), danach nur als Tages-`aktivitaet` — genau ein Ereignis.
 */
export const protokolliereErledigung = async (
	userId: number,
	registriertAm: Date,
	jetzt = new Date(),
): Promise<void> => {
	await protokolliereKpiEreignis(userId, tagVon(registriertAm) === tagVon(jetzt) ? 'aktivierung' : 'aktivitaet', jetzt);
};

/**
 * Rechnet die Auswertung (AK3/AK6): eine Zeile je Registrierungsperiode der Kohorte, aufsteigend.
 * Aktivierung und Tag-7 kommen aus den Erledigungen (Kohorte), Wochenkarte und Einladungen aus
 * den anonymen Ereignissen der Periode; Nenner unter {@link MIN_ZELLE} → `unterdrueckt`.
 */
export const berechneKpis = (eingabe: KpiEingabe, zeitraum: Zeitraum, jetzt: Date): KpiAuswertung => {
	const sammel = new Map<
		string,
		{
			neueNutzer: number;
			tag7Nenner: number;
			aktivierung: number;
			tag7: number;
			wochenkarte: number;
			einladungen: number;
		}
	>();
	const zaehle = (periode: string) => {
		const bestehend = sammel.get(periode);
		if (bestehend) return bestehend;
		const neu = { neueNutzer: 0, tag7Nenner: 0, aktivierung: 0, tag7: 0, wochenkarte: 0, einladungen: 0 };
		sammel.set(periode, neu);
		return neu;
	};

	for (const nutzer of eingabe.nutzer) {
		const periode = periodeVon(nutzer.registriertAm, zeitraum);
		const z = zaehle(periode);
		z.neueNutzer += 1;
		const tag0 = Date.parse(tagVon(nutzer.registriertAm));
		// Tag 7 „vergangen“ = der siebte UTC-Kalendertag ist komplett vorbei (Tag-8-Grenze).
		if (jetzt.getTime() >= tag0 + 8 * TAG_MS) z.tag7Nenner += 1;
		const eigene = eingabe.erledigungen.filter((e) => e.userId === nutzer.id);
		if (eigene.some((e) => e.zeitpunkt.getTime() >= tag0 && e.zeitpunkt.getTime() < tag0 + TAG_MS)) {
			z.aktivierung += 1;
		}
		if (eigene.some((e) => e.zeitpunkt.getTime() >= tag0 + 7 * TAG_MS && e.zeitpunkt.getTime() < tag0 + 8 * TAG_MS)) {
			z.tag7 += 1;
		}
	}
	for (const ereignis of eingabe.ereignisse) {
		const z = sammel.get(periodeVon(new Date(`${ereignis.tag}T00:00:00Z`), zeitraum));
		if (!z) continue;
		if (ereignis.art === 'wochenkarte') z.wochenkarte += ereignis.anzahl;
		else if (ereignis.art === 'einladung') z.einladungen += ereignis.anzahl;
	}

	const zelle = (zaehler: number, nenner: number): KpiZelle =>
		nenner < MIN_ZELLE ? 'unterdrueckt' : { zaehler, nenner, quote: zaehler / nenner };
	const zeilen = [...sammel.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([periode, z]) => ({
			periode,
			neueNutzer: z.neueNutzer,
			aktivierung: zelle(z.aktivierung, z.neueNutzer),
			tag7: zelle(z.tag7, z.tag7Nenner),
			wochenkarte: zelle(z.wochenkarte, z.neueNutzer),
			einladungen: zelle(z.einladungen, z.neueNutzer),
		}));
	return { zeitraum, zeilen };
};

/** Lädt die Rohdaten für {@link berechneKpis} — nur interne Ids, Zeitpunkte und Summen. */
export const ladeKpis = async (zeitraum: Zeitraum, jetzt = new Date()): Promise<KpiAuswertung> => {
	const [nutzer, erledigungen, ereignisse] = await Promise.all([
		User.findAll({ attributes: ['id', 'createdAt'], where: { role: { [Op.ne]: 'admin' } } }),
		ScoreEntry.findAll({
			attributes: ['zeitpunkt'],
			include: [{ model: Task, attributes: ['userId'], required: true }],
		}),
		KpiEvent.findAll({
			attributes: ['tag', 'art', [fn('COUNT', col('id')), 'anzahl']],
			group: ['tag', 'art'],
			raw: true,
		}) as unknown as Promise<{ tag: string; art: KpiArt; anzahl: number | string }[]>,
	]);
	return berechneKpis(
		{
			nutzer: nutzer.map((u) => ({ id: u.id, registriertAm: u.createdAt })),
			erledigungen: erledigungen.flatMap((e) =>
				e.Task?.userId != null ? [{ userId: e.Task.userId, zeitpunkt: e.zeitpunkt }] : [],
			),
			ereignisse: ereignisse.map((e) => ({ tag: e.tag, art: e.art, anzahl: Number(e.anzahl) })),
		},
		zeitraum,
		jetzt,
	);
};

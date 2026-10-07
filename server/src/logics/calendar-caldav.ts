import { fetchIcs, parseIcsEvents, syncWindow, type ParsedEvent } from './calendar-ics.js';

/**
 * Lesender Kalender-Abruf per CalDAV (#2211): ein `REPORT calendar-query` mit Zeitfenster auf die
 * Kalender-Adresse, HTTP Basic mit App-Passwort. Abruf über {@link fetchIcs} (Netz-Guard, keine
 * Redirects, Größengrenze); die `calendar-data` jeder Antwort läuft durch {@link parseIcsEvents}.
 * Benutzername und Passwort tauchen in keiner Fehlermeldung auf.
 */

const stamp = (ms: number): string =>
	new Date(ms)
		.toISOString()
		.replace(/[-:]/g, '')
		.replace(/\.\d{3}/, '');

const calendarQuery = (now: Date): string => {
	const { from, to } = syncWindow(now);
	return `<?xml version="1.0" encoding="utf-8"?><c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><c:calendar-data/></d:prop><c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT"><c:time-range start="${stamp(from)}" end="${stamp(to)}"/></c:comp-filter></c:comp-filter></c:filter></c:calendar-query>`;
};

const XML_ENTITIES: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

/** `calendar-data`-Inhalte aus der Multistatus-Antwort, als CDATA oder XML-maskiert. */
const calendarData = (xml: string): string[] =>
	[...xml.matchAll(/<(?:[\w-]+:)?calendar-data\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?calendar-data>/g)].map(([, raw]) => {
		const cdata = /^\s*<!\[CDATA\[([\s\S]*)\]\]>\s*$/.exec(raw);
		return cdata
			? cdata[1]
			: raw.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (entity, code: string) =>
					code.startsWith('#')
						? String.fromCodePoint(Number(code.startsWith('#x') ? `0${code.slice(1)}` : code.slice(1)))
						: (XML_ENTITIES[code] ?? entity),
				);
	});

export const fetchCaldavEvents = async (
	url: string,
	username: string,
	password: string,
	now: Date,
	fetchImpl: typeof fetch = fetch,
): Promise<ParsedEvent[]> => {
	const xml = await fetchIcs(url, fetchImpl, {
		method: 'REPORT',
		headers: {
			Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
			'Content-Type': 'application/xml; charset=utf-8',
			Depth: '1',
		},
		body: calendarQuery(now),
	});
	return calendarData(xml).flatMap((ics) => parseIcsEvents(ics, now));
};

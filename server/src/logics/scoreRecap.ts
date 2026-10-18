/**
 * Recap-Fachlogik der Rückblick-Endpunkte (#2689) — Fenster-, Rundungs- und Aggregationshelfer für
 * `GET /scores/monthly-recap` und `GET /scores/yearly-recap` (Abruf und Antwort bleiben in
 * `routes/scores.ts`). Reine Funktionen, Plain-Data rein — Schnittstellen-Muster wie
 * `balanceHistory.ts`. Verhalten byte-genau aus der Route übernommen (Spiegel: die
 * Endpunkt-Tests scores-monthly/yearly-recap).
 */

/** Punktestand einer Säule zu einem Zeitpunkt (Stand oder Differenz). */
export interface SaeulenStand {
	id: number;
	name: string;
	punkte: number;
}

/** Letzter Kalendertag des Monats `JJJJ-MM` als `YYYY-MM-DD`. */
export const letzterTagVon = (monat: string): string => {
	const [jahr, monatNr] = monat.split('-').map(Number) as [number, number];
	return new Date(Date.UTC(jahr, monatNr, 0)).toISOString().slice(0, 10);
};

/** Vormonat eines Monats `JJJJ-MM` als `JJJJ-MM` (Jahreswechsel-sicher). */
export const vormonatVon = (monat: string): string => {
	const [jahr, monatNr] = monat.split('-').map(Number) as [number, number];
	return `${jahr + Math.floor((monatNr - 2) / 12)}-${String(((monatNr + 10) % 12) + 1).padStart(2, '0')}`;
};

/**
 * UTC-Zeitpunkt 12:00 eines lokalen Kalendertags in `zeitZone` — Streak-Stichtag „Monatsende".
 * Die Mittagsstunde hält DST-Nähte fern; der Offset wird über `Intl` an genau dieser Naht
 * zurückgerechnet (ein Anker `Date.UTC(jahr, monat, 0) - 1` läge in Zeitzonen östlich von UTC
 * schon im Folgemonat).
 */
export const mittagDesTags = (tag: string, zeitZone: string): Date => {
	const [jahr, monat, tagImMonat] = tag.split('-').map(Number) as [number, number, number];
	const naive = Date.UTC(jahr, monat - 1, tagImMonat, 12);
	const teile = new Intl.DateTimeFormat('en-US', {
		timeZone: zeitZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hourCycle: 'h23',
	}).formatToParts(new Date(naive));
	const teil = (typ: Intl.DateTimeFormatPartTypes): number => Number(teile.find((p) => p.type === typ)?.value ?? 0);
	const alsUtc = Date.UTC(teil('year'), teil('month') - 1, teil('day'), teil('hour'), teil('minute'), teil('second'));
	return new Date(naive - (alsUtc - naive));
};

/** Rundet auf eine Dezimalstelle (`Math.round(x * 10) / 10`) — schneidet FP-Dreck ab. */
export const rundeAufZehntel = (wert: number): number => Math.round(wert * 10) / 10;

/**
 * Säulen-Differenz `ende − start` je Säule (fehlender Startstand zählt 0 — z. B. Fenstereintritt
 * ohne Säulenstand), gerundet auf eine Dezimalstelle. Deckt die Monats- wie die Jahresrechnung ab.
 */
export const saeulenDifferenz = (start: readonly SaeulenStand[], ende: readonly SaeulenStand[]): SaeulenStand[] => {
	const standStart = new Map(start.map((saeule) => [saeule.id, saeule.punkte]));
	return ende.map((saeule) => ({
		id: saeule.id,
		name: saeule.name,
		punkte: rundeAufZehntel(saeule.punkte - (standStart.get(saeule.id) ?? 0)),
	}));
};

/**
 * Stärkste Säule = größte Punktedifferenz. `null` ohne Punkte, bei Gleichstand (z. B. nur nicht
 * zugeordnete Aufgaben, die nach Gewicht gleich verteilt werden) und unterhalb der Basislinie 0 —
 * bestehende Reduce-Semantik der Route, unverändert.
 */
export const staerksteSaeuleVon = (saeulen: readonly SaeulenStand[]): SaeulenStand | null => {
	const alleGleich = saeulen.every((saeule) => saeule.punkte === saeulen[0]?.punkte);
	return alleGleich
		? null
		: saeulen.reduce<SaeulenStand | null>(
				(beste, saeule) => (saeule.punkte > (beste?.punkte ?? 0) ? saeule : beste),
				null,
			);
};

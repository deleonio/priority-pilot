/**
 * Verrechnung der Restlaufzeit beim Upgrade (#1912, PO-Entscheidungen in #1895). Reine Rechenfunktion
 * ohne DB- und Anbieterbezug.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Laufende Nummer des UTC-Kalendertags — Grundlage der taggenauen Zählung. */
const utcDay = (date: Date): number => Math.floor(date.getTime() / DAY_MS);

/**
 * Guthaben = Preis alt × Resttage / Periodentage, auf volle Cent abgerundet; erster Zyklus des neuen
 * Abos = Preis neu − Guthaben, nie unter 0. Gilt unverändert auch bei Wechsel des Zeitraums.
 */
export const prorateUpgrade = ({
	oldPriceCents,
	newPriceCents,
	periodStart,
	periodEnd,
	now,
}: {
	oldPriceCents: number;
	newPriceCents: number;
	periodStart: Date;
	periodEnd: Date;
	now: Date;
}): { creditCents: number; firstCycleCents: number } => {
	const periodDays = utcDay(periodEnd) - utcDay(periodStart);
	const remainingDays = Math.min(Math.max(utcDay(periodEnd) - utcDay(now), 0), periodDays);
	const creditCents = periodDays > 0 ? Math.floor((oldPriceCents * remainingDays) / periodDays) : 0;
	return { creditCents, firstCycleCents: Math.max(0, newPriceCents - creditCents) };
};

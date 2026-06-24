import type { Pillar } from 'client';

/** Balance-Stand einer Säule fürs Dashboard: ihr Punktestand und ihr Anteil am Gesamtstand. */
export interface PillarBalance {
	pillar: Pillar;
	/** Auf diese Säule entfallende (anteilig nach `share` aggregierte) Gamification-Punkte. */
	punkte: number;
	/** Anteil der Säule am Gesamt-Punktestand (0–1); 0, wenn insgesamt keine Punkte vergeben sind. */
	anteil: number;
}

/**
 * Bereitet den „Balance-Stand pro Säule" fürs Dashboard auf (Konzept §4.4): je Säule ihr
 * Punktestand (aus `punkteProSaeule`, 0 wenn nicht enthalten) und ihr Anteil am Gesamtstand. Die
 * Reihenfolge der Säulen bleibt erhalten. Ohne vergebene Punkte ist jeder Anteil 0 (keine Division
 * durch 0).
 */
export const buildPillarBalances = (
	pillars: Pillar[],
	punkteProSaeule: ReadonlyMap<number, number>,
): PillarBalance[] => {
	const gesamt = [...punkteProSaeule.values()].reduce((acc, punkte) => acc + punkte, 0);
	return pillars.map((pillar) => {
		const punkte = punkteProSaeule.get(pillar.id) ?? 0;
		return { pillar, punkte, anteil: gesamt > 0 ? punkte / gesamt : 0 };
	});
};

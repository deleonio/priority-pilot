/**
 * Vollverteilung über alle Säulen für API-Fixtures (#2077): Nicht-leere `pillars`-Listen müssen
 * jede Säule des Kontos abdecken, jeder Anteil liegt zwischen 5 und 80, die Summe ist exakt 100.
 * Die Säule am `emphasisIndex` trägt den Höchstanteil (80 %), der Rest verteilt sich gleichmäßig
 * auf die übrigen — Ganzzahlreste bei den ersten übrigen Säulen (#2154: die alte Formel
 * „100 − (n−1)·5“ lieferte für n = 2–4 serverabgewiesene Anteile > 80).
 * `confidence` wird nur gesetzt, wenn übergeben (wie bisher je Spec).
 *
 * Reine Logik in `src/lib/` statt in `e2e/helpers.ts`, damit Vitest sie unit-testen kann —
 * Vitest excludiert das e2e-Verzeichnis, und der `@playwright/test`-Import der Helpers crasht
 * unter jsdom (#2154); helpers.ts re-exportiert unter unveränderter Signatur/Exportstelle.
 */
export const fullPillarContributions = (
	pillars: ReadonlyArray<{ id: number }>,
	emphasisIndex: number,
	confidence?: number,
): Array<{ pillarId: number; share: number; confidence?: number }> => {
	const otherCount = pillars.length - 1;
	if (otherCount === 0) {
		return pillars.map((pillar) => ({
			pillarId: pillar.id,
			share: 100,
			...(confidence === undefined ? {} : { confidence }),
		}));
	}
	const emphasisShare = Math.min(80, 100 - otherCount * 5);
	const rest = 100 - emphasisShare;
	const base = Math.floor(rest / otherCount);
	let extras = rest - base * otherCount;
	return pillars.map((pillar, index) => {
		const share = index === emphasisIndex ? emphasisShare : base + (extras-- > 0 ? 1 : 0);
		return { pillarId: pillar.id, share, ...(confidence === undefined ? {} : { confidence }) };
	});
};

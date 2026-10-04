/**
 * Reine SVG-Erzeugung der teilbaren Monats-Rückblick-Karte (#1995, AK2) — Spiegel der
 * Wochen-Balance-Karte (`weeklyShareCard.ts`, #1968): Daten rein, SVG-String raus, ohne DOM und
 * ohne neue npm-Abhängigkeit. Die Rasterung (SVG→Canvas→PNG) lebt als dünner Adapter in
 * `MonthlyBalanceCard.tsx`. Themefest wie die Wochenkarte: eine feste dunkle Markenvariante,
 * deren Kontraste dort gerechnet sind — deshalb Farben und XML-Escape von dort übernommen.
 *
 * Die Karte enthält bewusst keine Aufgabeninhalte (AK2) und nennt Meilensteine nur, wenn es
 * welche gibt — keine „0 Meilensteine“-Zeile (Fürsorge-Tonalität: sorgt, nicht protokolliert).
 */
import { GEDAEMPFT, GRUND, KARTE_BREITE, KARTE_HOEHE, RAMPE, TINTE, xml } from './weeklyShareCard';

export interface MonatsKarteDaten {
	/** Name und Wert je Säule — bewusst nur das: Aufgabentitel/-inhalte dürfen nie ankommen (AK2). */
	saeulen: { name: string; wert: number }[];
	streak: number;
	/** Karten-Texte der im Monat erreichten Meilensteine — bei leerer Liste keine Zeile. */
	meilensteine: string[];
	monat: string;
}

export const erzeugeMonatsKarteSvg = ({ saeulen, streak, meilensteine, monat }: MonatsKarteDaten): string => {
	const maximal = Math.max(1, ...saeulen.map((s) => s.wert));
	const basisY = 300;
	const maximalHoehe = 160;
	const spaltenBreite = 72;
	const spaltenAbstand = 32;
	const spalten = saeulen
		.slice(0, 5)
		.map((saeule, index) => {
			const x = 48 + index * (spaltenBreite + spaltenAbstand);
			const hoehe = Math.max(4, Math.round((saeule.wert / maximal) * maximalHoehe));
			const y = basisY - hoehe;
			const mitte = x + spaltenBreite / 2;
			return [
				`<text x="${mitte}" y="${y - 10}" text-anchor="middle" font-size="16" font-weight="700" fill="${TINTE}">${saeule.wert}</text>`,
				`<rect x="${x}" y="${y}" width="${spaltenBreite}" height="${hoehe}" rx="8" fill="${RAMPE[index % RAMPE.length]}"></rect>`,
				`<text x="${mitte}" y="${basisY + 24}" text-anchor="middle" font-size="13" fill="${GEDAEMPFT}">${xml(saeule.name)}</text>`,
			].join('');
		})
		.join('');
	// Meilensteine nur bei nicht-leerer Liste — eine „0 Meilensteine“-Zeile wäre Protokoll, nicht Fürsorge.
	const meilensteinZeile =
		meilensteine.length > 0
			? `<text x="48" y="342" font-size="13"><tspan fill="${GEDAEMPFT}">Meilensteine </tspan><tspan fill="${TINTE}">${xml(meilensteine.join(' · '))}</tspan></text>`
			: '';
	return [
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${KARTE_BREITE} ${KARTE_HOEHE}" width="${KARTE_BREITE}" height="${KARTE_HOEHE}" font-family="system-ui, sans-serif">`,
		`<rect width="${KARTE_BREITE}" height="${KARTE_HOEHE}" fill="${GRUND}"></rect>`,
		`<text x="48" y="48" font-size="16" font-weight="600" fill="${TINTE}">${xml(monat)}</text>`,
		spalten,
		meilensteinZeile,
		`<text x="48" y="372" font-size="15"><tspan fill="${GEDAEMPFT}">Streak </tspan><tspan font-weight="700" fill="${TINTE}">${streak}</tspan></text>`,
		`<a href="https://balamentum.app"><text x="${KARTE_BREITE - 48}" y="372" text-anchor="end" font-size="14" fill="${GEDAEMPFT}">Balamentum</text></a>`,
		'</svg>',
	].join('');
};

/** Vormonat eines Datums als `JJJJ-MM` (lokale Zeit, Jahreswechsel-sicher). */
export const vormonat = (datum: Date): string => {
	const arbeit = new Date(datum.getFullYear(), datum.getMonth() - 1, 1);
	return `${arbeit.getFullYear()}-${String(arbeit.getMonth() + 1).padStart(2, '0')}`;
};

/** Sprachneutraler Dateiname mit Monat — Dateinamen werden nicht übersetzt (AK2). */
export const monatsDateiname = (monat: string): string => `balamentum-monat-${monat}.png`;

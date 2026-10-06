/**
 * Reine SVG-Erzeugung der teilbaren Wochen-Balance-Karte (#1968, AK1) — ohne DOM und ohne neue
 * npm-Abhängigkeit: Daten rein, SVG-String raus. Die Rasterung (SVG→Canvas→PNG) lebt als dünner
 * Adapter in `WeeklyBalanceCard.tsx`, damit diese Datei ohne jsdom testbar bleibt.
 *
 * Themefest: das geteilte PNG kennt kein Theme — es friert Farben zum Erzeugungszeitpunkt ein.
 * Deshalb eine feste dunkle Markenvariante mit eigenen Werten statt der `--pp-pillar-*`-Tokens,
 * deren Werte je Schema wechseln (der Dark-Wert der Säule 4, `#4324db`, läge mit 2,1:1 unter der
 * 3:1-Grenze für Grafik). Kontraste gerechnet gegen den Grund `#101828`: Tinte `#F2F4F7` ≈ 14,9:1,
 * gedämpft `#98A2B3` ≈ 6,9:1, Säulen-Rampe ≥ 4:1 — im Bild steht alles auch als Text (AK1),
 * Farbe trägt nie allein Information.
 */

/** Feste Bildmaße — die Rasterung skaliert darauf (2× für Retina, siehe Komponente). */
export const KARTE_BREITE = 640;
export const KARTE_HOEHE = 400;

/** Säulen-Rampe in der Reihenfolge der fünf Lebensbalance-Säulen, auf dunklen Grund hell gerechnet. */
export const RAMPE = ['#f0210f', '#e7f831', '#5af2a6', '#8b7cf8', '#c22aef'] as const;
export const GRUND = '#101828';
export const TINTE = '#f2f4f7';
export const GEDAEMPFT = '#98a2b3';

const XML_ESCAPES: Record<string, string> = {
	'<': '&lt;',
	'>': '&gt;',
	'&': '&amp;',
	'"': '&quot;',
	"'": '&apos;',
};

/** Namen stammen aus Nutzereingaben — bevor sie ins SVG gehen, werden sie XML-sicher gemacht. */
export const xml = (text: string): string => text.replace(/[<>&"']/g, (zeichen) => XML_ESCAPES[zeichen] ?? zeichen);

export interface WochenKarteDaten {
	/** Name und Wert je Säule — bewusst nur das: Aufgabentitel/-inhalte dürfen nie ankommen (AK1). */
	saeulen: { name: string; wert: number }[];
	streak: number;
	woche: string;
}

export const erzeugeWochenKarteSvg = ({ saeulen, streak, woche }: WochenKarteDaten): string => {
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
	return [
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${KARTE_BREITE} ${KARTE_HOEHE}" width="${KARTE_BREITE}" height="${KARTE_HOEHE}" font-family="system-ui, sans-serif">`,
		`<rect width="${KARTE_BREITE}" height="${KARTE_HOEHE}" fill="${GRUND}"></rect>`,
		`<text x="48" y="48" font-size="16" font-weight="600" fill="${TINTE}">${xml(woche)}</text>`,
		spalten,
		`<text x="48" y="362" font-size="15"><tspan fill="${GEDAEMPFT}">Streak </tspan><tspan font-weight="700" fill="${TINTE}">${streak}</tspan></text>`,
		`<a href="https://balamentum.modevel.de"><text x="${KARTE_BREITE - 48}" y="362" text-anchor="end" font-size="14" fill="${GEDAEMPFT}">balamentum.modevel.de</text></a>`,
		'</svg>',
	].join('');
};

/** ISO-Kalenderwoche (Montag–Sonntag) — Quelle fürs Wochenlabel und den Download-Dateinamen (AK3). */
export const kalenderWoche = (datum: Date): { kw: number; jahr: number } => {
	const arbeit = new Date(Date.UTC(datum.getFullYear(), datum.getMonth(), datum.getDate()));
	const wochentag = (arbeit.getUTCDay() + 6) % 7; // Mo=0 … So=6
	arbeit.setUTCDate(arbeit.getUTCDate() - wochentag + 3); // Donnerstag dieser Woche
	const jahr = arbeit.getUTCFullYear();
	const jahresAnfang = new Date(Date.UTC(jahr, 0, 4)); // Der 4. Januar liegt immer in KW 1.
	const startTag = (jahresAnfang.getUTCDay() + 6) % 7;
	jahresAnfang.setUTCDate(jahresAnfang.getUTCDate() - startTag + 3);
	const kw = 1 + Math.round((arbeit.getTime() - jahresAnfang.getTime()) / (7 * 24 * 60 * 60 * 1000));
	return { kw, jahr };
};

/** Montag der Kalenderwoche des Datums in lokaler Zeit (Montag–Sonntag, Annahme aus der Triage). */
export const montagDerWoche = (datum: Date): Date => {
	const montag = new Date(datum);
	montag.setDate(montag.getDate() - ((montag.getDay() + 6) % 7));
	return montag;
};

/** Sprachneutraler Dateiname mit KW und Jahr (AK3) — Dateinamen werden nicht übersetzt. */
export const kartenDateiname = (datum: Date): string => {
	const { kw, jahr } = kalenderWoche(datum);
	return `balamentum-woche-${kw}-${jahr}.png`;
};

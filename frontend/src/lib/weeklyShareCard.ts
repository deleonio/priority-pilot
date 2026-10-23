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

import logoDunkel from '../assets/logo-with-name.horizontal.dark.svg?raw';

/** Übersetzte Logo-Bezeichnungen der Marken-Elemente (#2255, #2275) — für alle Karten gemeinsam. */
export interface KartenMarken {
	balamentum: string;
	play: string;
	pwa: string;
}

/** Deutsche Default-Bezeichnungen — jede Karte ist ohne Component-Kontext erzeugbar (#2255 AK3). */
const MARKEN_DEFAULTS: KartenMarken = {
	balamentum: 'Balamentum',
	play: 'Erhältlich bei Google Play',
	pwa: 'Als App installierbar (PWA)',
};

/** Google-Play-Logo als Inline-Pfade (vier Keile, unverzerrt 1:1) — Rasterung lädt keine externen Referenzen. */
const SPIEL_LOGO = [
	'<path fill="#00d2ff" d="M2 1 L12 12 L2 23 Z"></path>',
	'<path fill="#00f076" d="M2 1 L17.2 7.6 L12 12 Z"></path>',
	'<path fill="#ffc900" d="M17.2 7.6 L21.5 12 L17.2 16.4 L12 12 Z"></path>',
	'<path fill="#ff3a44" d="M2 23 L17.2 16.4 L12 12 Z"></path>',
].join('');

/** PWA-Blitz als Inline-Pfad — identisch in jeder Karten-Fußzeile (#2255). */
const PWA_LOGO_PFAD = '<path fill="#00a8ff" d="M10 0 L3 11 H8 L7 20 L16 8 H11 L14 0 Z"></path>';

/** Dunkle Wortmarke (helle Schrift, Schrift + Bild eingebettet) als data-URL — keine externe Referenz (#2275 AK1/AK3). */
const LOGO_DATEN_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(logoDunkel)}`;
/** Kopfzeilen-Logo: viewBox 685×104 auf Höhe 32 skaliert. */
const LOGO_BREITE = Math.round((685 / 104) * 32);

/**
 * Gemeinsame Marken-Kopfzeile aller Karten (#2255, #2275): Logo links, Label rechtsbündig —
 * Werbefläche oben, Inhaltsbereich darunter. `<title>` trägt die übersetzte Bezeichnung.
 */
export const kartenKopfzeile = (label: string, marken?: KartenMarken): string => {
	const bezeichnungen = marken ?? MARKEN_DEFAULTS;
	return [
		`<g id="brand-balamentum" transform="translate(48,24)"><title>${xml(bezeichnungen.balamentum)}</title><image href="${LOGO_DATEN_URL}" width="${LOGO_BREITE}" height="32"></image></g>`,
		`<text x="${KARTE_BREITE - 48}" y="46" text-anchor="end" font-size="16" font-weight="600" fill="${TINTE}">${xml(label)}</text>`,
	].join('');
};

/**
 * Gemeinsame Marken-Fußzeile aller Karten (#2255, #2275): Domain als einziger Link
 * (Call-to-Action), danach Play/PWA-Logo — alle Logos inline, keine externe Referenz.
 */
export const kartenFusszeile = (marken?: KartenMarken): string => {
	const bezeichnungen = marken ?? MARKEN_DEFAULTS;
	return [
		`<a href="https://balamentum.modevel.de"><text x="190" y="376" font-size="16" fill="${TINTE}">balamentum.modevel.de</text></a>`,
		`<g id="brand-google-play" transform="translate(440,360) scale(0.92)"><title>${xml(bezeichnungen.play)}</title>${SPIEL_LOGO}</g>`,
		`<g id="brand-pwa" transform="translate(480,362)"><title>${xml(bezeichnungen.pwa)}</title>${PWA_LOGO_PFAD}<text x="19" y="15" font-size="14" font-weight="800" fill="#00a8ff">PWA</text></g>`,
	].join('');
};

export interface WochenKarteDaten {
	/** Name und Wert je Säule — bewusst nur das: Aufgabentitel/-inhalte dürfen nie ankommen (AK1). */
	saeulen: { name: string; wert: number }[];
	streak: number;
	woche: string;
	/** Übersetzte Logo-Bezeichnungen der Marken-Elemente (#2255, #2275) — ohne Parameter deutsche Defaults. */
	marken?: KartenMarken;
}

export const erzeugeWochenKarteSvg = ({ saeulen, streak, woche, marken }: WochenKarteDaten): string => {
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
		kartenKopfzeile(woche, marken),
		`<line x1="48" y1="300" x2="${KARTE_BREITE - 48}" y2="300" stroke="${GEDAEMPFT}" stroke-opacity="0.4"></line>`,
		spalten,
		`<text x="48" y="376" font-size="15"><tspan fill="${GEDAEMPFT}">Streak </tspan><tspan font-weight="700" fill="${TINTE}">${streak}</tspan></text>`,
		kartenFusszeile(marken),
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

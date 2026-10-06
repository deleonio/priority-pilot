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
	/** Übersetzte Logo-Bezeichnungen der Marken-Fußzeile (#2255) — ohne Parameter deutsche Defaults. */
	marken?: { balamentum: string; play: string; pwa: string };
}

/** Deutsche Default-Bezeichnungen — die Karte ist ohne Component-Kontext erzeugbar (#2255 AK3). */
const MARKEN_DEFAULTS = {
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

/** PWA-Blitz als Inline-Pfad — identisch im data-URL-Logo und in der Karten-Fußzeile (#2255). */
const PWA_LOGO_PFAD = '<path fill="#00a8ff" d="M10 0 L3 11 H8 L7 20 L16 8 H11 L14 0 Z"></path>';

/** Eigenständige Logos für die In-App-Karte (data-URL) — gleiche Grafik wie im SVG (#2255 AK4). */
export const playLogoSvg = (bezeichnung: string): string =>
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><title>${xml(bezeichnung)}</title>${SPIEL_LOGO}</svg>`;
export const pwaLogoSvg = (bezeichnung: string): string =>
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 20"><title>${xml(bezeichnung)}</title>${PWA_LOGO_PFAD}<text x="19" y="15" font-size="14" font-weight="800" fill="#00a8ff" font-family="system-ui, sans-serif">PWA</text></svg>`;

export const erzeugeMonatsKarteSvg = ({ saeulen, streak, meilensteine, monat, marken }: MonatsKarteDaten): string => {
	const bezeichnungen = marken ?? MARKEN_DEFAULTS;
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
			? `<text x="48" y="330" font-size="13"><tspan fill="${GEDAEMPFT}">Meilensteine </tspan><tspan fill="${TINTE}">${xml(meilensteine.join(' · '))}</tspan></text>`
			: '';
	return [
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${KARTE_BREITE} ${KARTE_HOEHE}" width="${KARTE_BREITE}" height="${KARTE_HOEHE}" font-family="system-ui, sans-serif">`,
		`<rect width="${KARTE_BREITE}" height="${KARTE_HOEHE}" fill="${GRUND}"></rect>`,
		`<text x="48" y="48" font-size="16" font-weight="600" fill="${TINTE}">${xml(monat)}</text>`,
		spalten,
		meilensteinZeile,
		`<text x="48" y="372" font-size="15"><tspan fill="${GEDAEMPFT}">Streak </tspan><tspan font-weight="700" fill="${TINTE}">${streak}</tspan></text>`,
		// Marken-Fußzeile (#2255): Logo → Domain (einziger Link) → Play/PWA-Gruppe, alle Logos inline.
		`<g id="brand-balamentum" transform="translate(48,342)"><title>${xml(bezeichnungen.balamentum)}</title><circle cx="9" cy="9" r="9" fill="${RAMPE[0]}"></circle><circle cx="9" cy="9" r="3.5" fill="${GRUND}"></circle><text x="24" y="14" font-size="15" font-weight="700" fill="${TINTE}">Balamentum</text></g>`,
		// Fußzeilen-X-Positionen gespreizt (Review #2269): die fette Wortmarke läuft fontabhängig bis ~x=180,
		// die Domain fontabhängig bis ~x=310 (Chromium-Messung) — Play/PWA rücken mit Kopfanteil dahinter
		// (Kartenrand: 592), gerendert gegenprüft statt nur gerechnet.
		`<a href="https://balamentum.app"><text x="190" y="356" font-size="14" fill="${GEDAEMPFT}">balamentum.app</text></a>`,
		`<g id="brand-google-play" transform="translate(330,340) scale(0.92)"><title>${xml(bezeichnungen.play)}</title>${SPIEL_LOGO}</g>`,
		`<g id="brand-pwa" transform="translate(370,342)"><title>${xml(bezeichnungen.pwa)}</title>${PWA_LOGO_PFAD}<text x="19" y="15" font-size="14" font-weight="800" fill="#00a8ff">PWA</text></g>`,
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

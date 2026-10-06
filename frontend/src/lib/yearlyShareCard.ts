/**
 * Reine SVG-Erzeugung der teilbaren Jahresrückblick-Karte (#1997, AK6) — Spiegel der
 * Monats-Rückblick-Karte (`monthlyShareCard.ts`, #1995): Daten rein, SVG-String raus, ohne DOM und
 * ohne neue npm-Abhängigkeit. Die Rasterung (SVG→Canvas→PNG) lebt als dünner Adapter in
 * `YearlyRecapCard.tsx`. Farben und XML-Escape kommen von der Wochenkarte (themefeste Markenvariante).
 *
 * Die Karte enthält bewusst nur die fünf Kennzahlen, nie Aufgabentitel oder -inhalte (AK6).
 */
import { GEDAEMPFT, GRUND, KARTE_BREITE, KARTE_HOEHE, TINTE, xml } from './weeklyShareCard';

interface JahresKarteBeschriftungen {
	aufgaben: string;
	stunden: string;
	streak: string;
	projekte: string;
	saeule: string;
}

export interface JahresKarteDaten {
	jahr: number;
	/** Überschrift des Bildes, z. B. „Rückblick 2025“. */
	label: string;
	erledigteAufgaben: number;
	stunden: number;
	laengsterStreak: number;
	/** Name und Punkte der stärksten Säule — `null` ohne Punkte, dann entfällt die Zeile. */
	staerksteSaeule: { name: string; punkte: number } | null;
	abgeschlosseneProjekte: number;
	/** Zahlenformat und Beschriftungen der aktuellen App-Sprache; ohne Angabe Deutsch. */
	sprache?: string;
	beschriftungen?: JahresKarteBeschriftungen;
}

const STANDARD_BESCHRIFTUNGEN: JahresKarteBeschriftungen = {
	aufgaben: 'Erledigte Aufgaben',
	stunden: 'Investierte Stunden',
	streak: 'Längster Streak',
	projekte: 'Abgeschlossene Projekte',
	saeule: 'Stärkste Säule',
};

export const erzeugeJahresKarteSvg = ({
	label,
	erledigteAufgaben,
	stunden,
	laengsterStreak,
	staerksteSaeule,
	abgeschlosseneProjekte,
	sprache = 'de',
	beschriftungen = STANDARD_BESCHRIFTUNGEN,
}: JahresKarteDaten): string => {
	const zahl = new Intl.NumberFormat(sprache, { maximumFractionDigits: 1 });
	const zeilen: [string, string][] = [
		[beschriftungen.aufgaben, zahl.format(erledigteAufgaben)],
		[beschriftungen.stunden, zahl.format(stunden)],
		[beschriftungen.streak, zahl.format(laengsterStreak)],
		[beschriftungen.projekte, zahl.format(abgeschlosseneProjekte)],
	];
	if (staerksteSaeule) {
		zeilen.push([beschriftungen.saeule, staerksteSaeule.name]);
	}
	const zeilenSvg = zeilen
		.map(([bezeichnung, wert], index) => {
			const y = 110 + index * 52;
			return [
				`<text x="48" y="${y}" font-size="16" fill="${GEDAEMPFT}">${xml(bezeichnung)}</text>`,
				`<text x="${KARTE_BREITE - 48}" y="${y}" text-anchor="end" font-size="28" font-weight="700" fill="${TINTE}">${xml(wert)}</text>`,
			].join('');
		})
		.join('');
	return [
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${KARTE_BREITE} ${KARTE_HOEHE}" width="${KARTE_BREITE}" height="${KARTE_HOEHE}" font-family="system-ui, sans-serif">`,
		`<rect width="${KARTE_BREITE}" height="${KARTE_HOEHE}" fill="${GRUND}"></rect>`,
		`<text x="48" y="48" font-size="16" font-weight="600" fill="${TINTE}">${xml(label)}</text>`,
		zeilenSvg,
		`<a href="https://balamentum.modevel.de"><text x="${KARTE_BREITE - 48}" y="372" text-anchor="end" font-size="14" fill="${GEDAEMPFT}">balamentum.modevel.de</text></a>`,
		'</svg>',
	].join('');
};

/** Sprachneutraler Dateiname mit Jahr — Dateinamen werden nicht übersetzt. */
export const jahresDateiname = (jahr: number): string => `balamentum-jahr-${jahr}.png`;

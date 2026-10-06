/**
 * Reine SVG-Erzeugung der teilbaren Abschluss-Karte einer Gruppen-Challenge (#1992, AK6) — Spiegel
 * der Wochen-/Monatskarte (`weeklyShareCard.ts`): Daten rein, SVG-String raus, ohne DOM. Die
 * Rasterung lebt in `GroupChallengeCard.tsx`. Farben, Maße und XML-Escape stammen aus der
 * Wochenkarte, deren Kontraste dort gerechnet sind.
 *
 * Die Karte enthält bewusst nur Gruppenname, Zeitraum und Rang/Name/Wert — keine Aufgabeninhalte.
 */
import { GEDAEMPFT, GRUND, KARTE_BREITE, KARTE_HOEHE, TINTE, xml } from './weeklyShareCard';

export interface ChallengeKarteDaten {
	gruppe: string;
	zeitraum: string;
	rangfolge: { name: string; rang: number; balance: number | null }[];
}

/** Mehr Zeilen passen nicht auf die feste Kartenhöhe — der Rest steht als „+ n weitere“. */
const MAX_ZEILEN = 5;
const MAX_NAME = 24;

/** Balance-Wert als Text — ohne Punkte im Zeitraum kein „0 %“ (Fürsorge-Tonalität). */
export const balanceText = (balance: number | null): string =>
	balance === null ? 'Noch kein Wert' : `${Math.round(balance * 100)} %`;

const kuerze = (name: string): string => (name.length > MAX_NAME ? `${name.slice(0, MAX_NAME - 1)}…` : name);

export const erzeugeChallengeKarteSvg = ({ gruppe, zeitraum, rangfolge }: ChallengeKarteDaten): string => {
	const zeilen = rangfolge
		.slice(0, MAX_ZEILEN)
		.map((eintrag, index) => {
			const y = 156 + index * 36;
			const platz = eintrag.balance === null ? '' : `Platz ${eintrag.rang}`;
			return [
				`<text x="48" y="${y}" font-size="14" fill="${GEDAEMPFT}">${platz}</text>`,
				`<text x="136" y="${y}" font-size="16" font-weight="600" fill="${TINTE}">${xml(kuerze(eintrag.name))}</text>`,
				`<text x="${KARTE_BREITE - 48}" y="${y}" text-anchor="end" font-size="16" fill="${TINTE}">${balanceText(eintrag.balance)}</text>`,
			].join('');
		})
		.join('');
	const rest =
		rangfolge.length > MAX_ZEILEN
			? `<text x="136" y="${156 + MAX_ZEILEN * 36}" font-size="13" fill="${GEDAEMPFT}">+ ${rangfolge.length - MAX_ZEILEN} weitere</text>`
			: '';
	return [
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${KARTE_BREITE} ${KARTE_HOEHE}" width="${KARTE_BREITE}" height="${KARTE_HOEHE}" font-family="system-ui, sans-serif">`,
		`<rect width="${KARTE_BREITE}" height="${KARTE_HOEHE}" fill="${GRUND}"></rect>`,
		`<text x="48" y="48" font-size="18" font-weight="700" fill="${TINTE}">${xml(gruppe)}</text>`,
		`<text x="48" y="74" font-size="14" fill="${GEDAEMPFT}">7-Tage-Challenge · ${xml(zeitraum)}</text>`,
		`<text x="48" y="112" font-size="13" fill="${GEDAEMPFT}">Rangfolge nach Ausgewogenheit</text>`,
		zeilen,
		rest,
		`<a href="https://balamentum.modevel.de"><text x="${KARTE_BREITE - 48}" y="372" text-anchor="end" font-size="14" fill="${GEDAEMPFT}">balamentum.modevel.de</text></a>`,
		'</svg>',
	].join('');
};

/** Sprachneutraler Dateiname mit Startdatum (`JJJJ-MM-TT`). */
export const challengeDateiname = (startsAt: string): string => `balamentum-challenge-${startsAt.slice(0, 10)}.png`;

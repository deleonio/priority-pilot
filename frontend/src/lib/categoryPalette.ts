import type { CategoryColor } from 'client';
import i18next from '../i18n/config';

/** Label als Getter: zur Laufzeit übersetzt, damit ein Sprachwechsel greift. */
const paletteEntry = (color: CategoryColor, key: string): { color: CategoryColor; label: string } => ({
	color,
	get label() {
		return i18next.t(`settings:categoryPalette.${key}`);
	},
});

/**
 * Die feste Kategorie-Palette mit den Namen, die im Auswahlfeld stehen. Die Hex-Werte sind der
 * Spiegel des `CategoryColor`-Enums im API-Vertrag (`openapi.yml`) und von
 * `server/src/models/categoryColors.ts`; wer dort ergänzt, ergänzt hier mit.
 *
 * Bewusst als Hex-Wert statt als CSS-Variable: `KolBadge` bekommt die Farbe als Prop und rechnet
 * die Textfarbe daraus aus (`spec/badge`) — eine `var(--…)`-Referenz könnte es nicht auswerten.
 */
export const CATEGORY_PALETTE: { color: CategoryColor; label: string }[] = [
	paletteEntry('#b42318', 'red'),
	paletteEntry('#b54708', 'orange'),
	paletteEntry('#8a6100', 'gold'),
	paletteEntry('#1a7f37', 'green'),
	paletteEntry('#0e7490', 'turquoise'),
	paletteEntry('#1064d0', 'blue'),
	paletteEntry('#6941c6', 'violet'),
	paletteEntry('#475467', 'grey'),
];

/** Vorbelegung des Farbfelds beim Anlegen einer Kategorie. */
export const DEFAULT_CATEGORY_COLOR: CategoryColor = CATEGORY_PALETTE[0].color;

/** Optionen für das Farb-Auswahlfeld (`KolSelect`): Wert ist der Hex-Code, Label der Farbname. */
export const categoryColorOptions = (): { label: string; value: string }[] =>
	CATEGORY_PALETTE.map((entry) => ({ label: entry.label, value: entry.color }));

/**
 * Farbname zu einem Hex-Wert — für Beschriftungen, die die Farbe nicht allein tragen dürfen
 * (Farbe ist nie alleiniger Bedeutungsträger, siehe DESIGN.md). Unbekannte Werte (z. B. aus einer
 * später erweiterten Palette) liefern den Hex-Code zurück, statt leer zu bleiben.
 */
export const categoryColorLabel = (color: string): string =>
	CATEGORY_PALETTE.find((entry) => entry.color === color)?.label ?? color;

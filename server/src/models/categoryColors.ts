/**
 * Feste Farbpalette der Kategorien. Bewusst **keine** freie Farbwahl: `KolBadge` rechnet zwar die
 * Textfarbe zur Hintergrundfarbe aus, ein frei gewählter Hex-Wert könnte aber trotzdem neben der
 * Design-Sprache liegen (docs/../.ai-knowledge/ux-design.md). Die acht Werte folgen den Hues der
 * vorhandenen Status-Tokens (`--pp-danger`, `--pp-warning`, `--pp-success`, `--pp-status-open`) und
 * sind bewusst NICHT die Säulen-Rampe (`--pp-pillar-*`) — Kategorie und Säule sollen sich auch
 * farblich nicht verwechseln lassen.
 *
 * Spiegel des `enum` in `openapi.yml` (Schema `Category.color`): Wer hier ergänzt, ergänzt dort mit.
 */
export const CATEGORY_COLORS = [
	'#b42318',
	'#b54708',
	'#8a6100',
	'#1a7f37',
	'#0e7490',
	'#1064d0',
	'#6941c6',
	'#475467',
] as const;

/** Prüft, ob ein Wert eine der erlaubten Kategorie-Farben ist. */
export const isCategoryColor = (value: unknown): value is (typeof CATEGORY_COLORS)[number] =>
	typeof value === 'string' && (CATEGORY_COLORS as readonly string[]).includes(value);

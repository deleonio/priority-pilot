/** Badge-Farben für `KolBadge _color` (parsbarer Hex-Wert nötig, KoliBri rechnet den Kontrast selbst). */
export const BADGE_COLOR = {
	changed: '#c66a00', // --kol-color-warning
	progress: '#2e7d32', // Erfolgs-Grün (kein --kol-color-*-Pendant), wie MilestoneBadges
	info: '#005b99', // --kol-color-primary
} as const;

/** Badge-Farben für `KolBadge _color` (parsbarer Hex-Wert nötig, KoliBri rechnet den Kontrast selbst). */
export const BADGE_COLOR = {
	changed: '#c66a00', // --kol-color-warning
	progress: '#2e7d32', // Erfolgs-Grün (kein --kol-color-*-Pendant), wie MilestoneBadges
	neutral: '#9e9e9e', // nicht erreichte Meilenstein-Stufe
	info: '#005b99', // --kol-color-primary
} as const;

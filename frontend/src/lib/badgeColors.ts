/** Badge-Farben für `KolBadge _color` (parsbarer Hex-Wert nötig, KoliBri rechnet den Kontrast selbst). */
export const BADGE_COLOR = {
	changed: '#c66a00', // --kol-color-warning
	progress: '#2e7d32', // Erfolgs-Grün (kein --kol-color-*-Pendant), wie MilestoneBadges
	neutral: '#9e9e9e', // nicht erreichte Meilenstein-Stufe
	info: '#005b99', // --kol-color-primary
} as const;

/** Farb-Mapping für Prioritäts-Badges (`priorityBadge`-Typen) — zentrale Quelle statt lokaler Konstanten (#2637). */
export const PRIORITY_COLOR = {
	info: '#005b99', // --kol-color-primary
	warning: '#c66a00', // --kol-color-warning
	danger: '#b42318', // --kol-color-danger
} as const;

/** Farb-Mapping für Dringlichkeits-Badges (`deadlineUrgency` ohne 'later') — zentrale Quelle (#2637). */
export const URGENCY_COLOR = {
	overdue: '#b42318',
	soon: '#b54708',
} as const;

import type { ThemePreference } from '../lib/theme';

// Reihenfolge der Darstellungs-Optionen: System → Hell → Dunkel. „System" folgt dem Betriebssystem,
// „Hell"/„Dunkel" erzwingen das jeweilige Theme als Override. Bis #285 wurde daraus ein zyklischer
// Header-Umschalter gebaut; seit #285 steuert das Darstellungs-Bedienelement in den Einstellungen
// dieselben drei Optionen an (siehe `AppearanceSetting`).
export const THEME_ORDER: ThemePreference[] = ['system', 'light', 'dark'];

export const THEME_LABELS: Record<ThemePreference, string> = {
	system: 'System',
	light: 'Hell',
	dark: 'Dunkel',
};

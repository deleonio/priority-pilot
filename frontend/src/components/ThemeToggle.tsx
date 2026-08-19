import type { ThemePreference } from '../lib/theme';

/**
 * Konstanten für die Theme-Auswahl in der UI. Werden von AppearanceSetting genutzt.
 *
 * Export für AppearanceSetting.tsx — die Komponente selbst wurde nach #285 in die
 * Einstellungen verschoben, aber die Konstanten bleiben hier für die Weiterverwendung.
 */

export const THEME_ORDER: ThemePreference[] = ['system', 'light', 'dark'];

export const THEME_LABELS: Record<ThemePreference, string> = {
	system: 'System',
	light: 'Hell',
	dark: 'Dunkel',
};

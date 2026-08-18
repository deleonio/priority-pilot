/**
 * Theme-Logik: Die App läuft nur im Hell-Modus. Dunkelmodus ist deaktiviert.
 *
 * Der Anti-FOUC-Bootstrap in `index.html` und diese Funktion setzen das `data-theme`
 * Attribut auf `light`. `color-scheme` lässt native Controls/Scrollbars mitziehen.
 */

/**
 * Wendet das hell Theme auf das `<html>`-Element an — vor dem ersten Render
 * aufzurufen, damit beim Laden kein Theme-Wechsel aufblitzt (Anti-FOUC).
 */
export const applyInitialTheme = (): void => {
	try {
		const root = document.documentElement;
		root.dataset.theme = 'light';
		root.style.colorScheme = 'light';
	} catch {
		// DOM nicht verfügbar — das Standard-Theme greift dann ohne Vorab-Anstrich.
	}
};

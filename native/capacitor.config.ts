import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Nativer Wrapper im Remote-Modus (ADR 0016): Die App lädt die gehostete `/app/` aus `SITE_URL`;
 * gebündelt ist nur die Fehlerseite für den Fall, dass der Server nicht erreichbar ist.
 */
const siteUrl = process.env.SITE_URL?.trim().replace(/\/$/, '');
if (!siteUrl) {
	throw new Error('SITE_URL fehlt, z. B. SITE_URL=https://example.org pnpm --filter native sync');
}

const config: CapacitorConfig = {
	appId: 'de.balamentum.app',
	appName: 'Balamentum',
	webDir: 'www',
	server: {
		url: `${siteUrl}/app/`,
		// Nur die eigene Domain im WebView; fremde Links öffnet Capacitor im System-Browser.
		allowNavigation: [new URL(siteUrl).host],
		errorPath: 'error.html',
	},
	plugins: {
		SplashScreen: { backgroundColor: '#ffffff', launchShowDuration: 1000 },
	},
};

export default config;

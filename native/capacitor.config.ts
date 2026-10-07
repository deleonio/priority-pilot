import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Nativer Wrapper mit gebündelter Web-App (ADR 0021): `webDir` ist der Android-Build des Frontends
 * (`pnpm --filter frontend build:android`), die App läuft auf `https://localhost` und startet auch ohne Netz.
 * `SITE_URL` liefert nur die Domain für App Links und die erlaubte Navigation.
 */
const siteUrl = process.env.SITE_URL?.trim().replace(/\/$/, '');
if (!siteUrl) {
	throw new Error('SITE_URL fehlt, z. B. SITE_URL=https://example.org pnpm --filter native sync');
}

const config: CapacitorConfig = {
	appId: 'balamentum.app',
	appName: 'Balamentum',
	webDir: '../frontend/dist-android',
	server: {
		// Nur die eigene Domain im WebView; fremde Links öffnet Capacitor im System-Browser.
		allowNavigation: [new URL(siteUrl).host],
	},
	plugins: {
		SplashScreen: { backgroundColor: '#ffffff', launchShowDuration: 1000 },
	},
};

export default config;

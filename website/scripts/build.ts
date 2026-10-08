/**
 * Baut die öffentliche Website nach `website/dist/` (ADR 0015). Aufruf: `pnpm --filter website build`.
 * `SITE_URL` (z. B. `https://example.org`) macht canonical/hreflang absolut und erzeugt die Sitemap.
 * `ANDROID_PACKAGE_ID` und `ANDROID_CERT_SHA256` erzeugen `/.well-known/assetlinks.json` (ADR 0016).
 * `MATOMO_URL` und `MATOMO_SITE_ID` binden das cookielose Matomo in jede Seite ein.
 */
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLAN_VALUES, getPlansCatalog } from '../../server/src/logics/plans.ts';
import { OPERATOR } from '../../frontend/src/lib/operator.ts';
import { matomoScript } from '../../frontend/src/lib/matomo.ts';
import de from '../src/i18n/de.json' with { type: 'json' };
import en from '../src/i18n/en.json' with { type: 'json' };
import es from '../src/i18n/es.json' with { type: 'json' };
import fr from '../src/i18n/fr.json' with { type: 'json' };
import it from '../src/i18n/it.json' with { type: 'json' };
import nl from '../src/i18n/nl.json' with { type: 'json' };
import pl from '../src/i18n/pl.json' with { type: 'json' };
import pt from '../src/i18n/pt.json' with { type: 'json' };
import ru from '../src/i18n/ru.json' with { type: 'json' };
import sv from '../src/i18n/sv.json' with { type: 'json' };
import {
	LOCALES,
	homePath,
	renderAccountDeletion,
	renderImprint,
	renderAssessment,
	renderAssetLinks,
	renderLanding,
	renderMcpGuide,
	renderTemplateIndex,
	renderTemplatePage,
	renderPrivacy,
	renderTerms,
	renderWithdrawal,
	renderCancellation,
	renderCancellationConfirm,
	renderRobots,
	renderSitemap,
	type Locale,
	type Messages,
} from '../src/render.ts';
import { TEMPLATES } from '../src/templates.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const frontendPublic = resolve(root, '../frontend/public');
const fonts = resolve(root, 'node_modules/@fontsource/archivo/files');
const siteUrl = (process.env.SITE_URL ?? '').trim().replace(/\/$/, '');
const matomo = matomoScript(process.env);

const allMessages: Record<Locale, Messages> = { de, en, es, fr, it, nl, pl, pt, ru, sv };

const write = (path: string, content: string): void => {
	const target = join(dist, path);
	mkdirSync(dirname(target), { recursive: true });
	writeFileSync(target, path.endsWith('.html') ? content.replace('</head>', `${matomo}</head>`) : content);
};

const copy = (source: string, target: string): void => {
	mkdirSync(dirname(join(dist, target)), { recursive: true });
	copyFileSync(source, join(dist, target));
};

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

// Statische Dateien: eigenes public/ plus Icons und Schrift aus dem Frontend (keine Kopie im Repo).
cpSync(join(root, 'public'), dist, { recursive: true });
copy(join(root, 'src/styles.css'), 'styles.css');
copy(join(frontendPublic, 'favicon-32x32.png'), 'favicon-32x32.png');
copy(join(frontendPublic, 'favicon-16x16.png'), 'favicon-16x16.png');
copy(join(frontendPublic, 'apple-touch-icon.png'), 'apple-touch-icon.png');
copy(join(frontendPublic, 'logo/logo-with-name.horizontal.svg'), 'logo-with-name.svg');
copy(join(frontendPublic, 'logo/logo-with-name.horizontal.dark.svg'), 'logo-with-name.dark.svg');
copy(join(frontendPublic, 'icons/icon-512x512.png'), 'icon-512.png');
for (const weight of ['400', '600']) {
	copy(join(fonts, `archivo-latin-${weight}-normal.woff2`), `fonts/archivo-latin-${weight}-normal.woff2`);
}

// Screenshots aus `frontend/e2e/landing-shots.spec.ts`; eine Funktion ohne Bild erscheint als Karte.
const shotsDir = join(root, 'public/shots');
const shots = new Set(
	existsSync(shotsDir)
		? readdirSync(shotsDir)
				.filter((file) => file.endsWith('.jpg'))
				.map((file) => file.slice(0, -4))
		: [],
);
const paths: string[] = [];
for (const locale of LOCALES) {
	const messages = allMessages[locale];
	const context = { locale, messages, siteUrl };
	write(
		join(homePath(locale), 'index.html'),
		renderLanding({
			...context,
			catalog: getPlansCatalog(),
			plans: PLAN_VALUES,
			shots,
		}),
	);
	const imprintPath = `${homePath(locale)}${messages.footer.imprintPath}`;
	write(join(imprintPath, 'index.html'), renderImprint({ ...context, operator: OPERATOR, allMessages }));
	const deletionPath = `${homePath(locale)}${messages.footer.accountDeletionPath}`;
	write(join(deletionPath, 'index.html'), renderAccountDeletion({ ...context, operator: OPERATOR, allMessages }));
	paths.push(homePath(locale), imprintPath, deletionPath);
}

// Datenschutzerklärung: eine feste deutsche Seite an der Wurzel, Footer-Link in allen Sprachen (#1672).
write(join('datenschutz', 'index.html'), renderPrivacy({ locale: 'de', messages: de, siteUrl, allMessages }));
paths.push('/datenschutz/');

// Nutzungsbedingungen: wie die Datenschutzerklärung eine feste deutsche Seite (#1891).
write(join('nutzungsbedingungen', 'index.html'), renderTerms({ locale: 'de', messages: de, siteUrl, allMessages }));
paths.push('/nutzungsbedingungen/');

// Widerrufsbelehrung und Muster-Widerrufsformular: feste deutsche Seite (#2307).
write(join('widerruf', 'index.html'), renderWithdrawal({ locale: 'de', messages: de, siteUrl, allMessages }));
paths.push('/widerruf/');

// Kündigung ohne Login (#2317): feste deutsche Seite; die Bestätigungsseite des Mail-Links bleibt aus der Sitemap.
write(join('kuendigen', 'index.html'), renderCancellation({ locale: 'de', messages: de, siteUrl, allMessages }));
write(
	join('kuendigen', 'bestaetigen', 'index.html'),
	renderCancellationConfirm({ locale: 'de', messages: de, siteUrl }),
);
paths.push('/kuendigen/');

// MCP-Anleitung (#1978): deutsch an der Wurzel, englische Schwester unter /en/, Footer-Link in allen Sprachen.
write(join('mcp', 'index.html'), renderMcpGuide({ locale: 'de', messages: de, siteUrl, allMessages }));
write(join('en', 'mcp', 'index.html'), renderMcpGuide({ locale: 'en', messages: en, siteUrl, allMessages }));
paths.push('/mcp/', '/en/mcp/');

// Vorlagen-Bibliothek (#1976): deutsche Übersicht und je Vorlage eine Seite.
write(join('vorlagen', 'index.html'), renderTemplateIndex({ locale: 'de', messages: de, siteUrl }));
paths.push('/vorlagen/');
for (const template of TEMPLATES) {
	write(
		join('vorlagen', template.slug, 'index.html'),
		renderTemplatePage({ locale: 'de', messages: de, siteUrl, template }),
	);
	paths.push(`/vorlagen/${template.slug}/`);
}

// Balance-Check (#1979): feste deutsche Seite ohne Sprachvarianten.
write(join('balance-check', 'index.html'), renderAssessment({ locale: 'de', messages: de, siteUrl, allMessages }));
paths.push('/balance-check/');

write('robots.txt', renderRobots(siteUrl));
if (siteUrl) {
	write('sitemap.xml', renderSitemap(siteUrl, paths));
}
const assetLinks = renderAssetLinks(process.env.ANDROID_PACKAGE_ID ?? '', process.env.ANDROID_CERT_SHA256 ?? '');
if (assetLinks) {
	write('.well-known/assetlinks.json', assetLinks);
}
console.log(`[website] ${paths.length} Seiten nach ${dist} geschrieben${siteUrl ? ` (SITE_URL ${siteUrl})` : ''}.`);

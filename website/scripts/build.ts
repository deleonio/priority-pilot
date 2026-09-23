/**
 * Baut die öffentliche Website nach `website/dist/` (ADR 0015). Aufruf: `pnpm --filter website build`.
 * `SITE_URL` (z. B. `https://example.org`) macht canonical/hreflang absolut und erzeugt die Sitemap.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AI_ASSIST_MONTHLY_QUOTA, PLAN_VALUES, getPlansCatalog } from '../../server/src/logics/plans.ts';
import { OPERATOR } from '../../frontend/src/lib/operator.ts';
import de from '../src/i18n/de.json' with { type: 'json' };
import en from '../src/i18n/en.json' with { type: 'json' };
import {
	LOCALES,
	homePath,
	renderImprint,
	renderLanding,
	renderRobots,
	renderSitemap,
	type Locale,
	type Messages,
} from '../src/render.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const frontendPublic = resolve(root, '../frontend/public');
const fonts = resolve(root, 'node_modules/@fontsource/archivo/files');
const siteUrl = (process.env.SITE_URL ?? '').trim().replace(/\/$/, '');

const allMessages: Record<Locale, Messages> = { de, en };

const write = (path: string, content: string): void => {
	const target = join(dist, path);
	mkdirSync(dirname(target), { recursive: true });
	writeFileSync(target, content);
};

const copy = (source: string, target: string): void => {
	mkdirSync(dirname(join(dist, target)), { recursive: true });
	copyFileSync(source, join(dist, target));
};

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

// Statische Dateien: eigenes public/ plus Icons und Schrift aus dem Frontend (keine Kopie im Repo).
for (const file of readdirSync(join(root, 'public'))) {
	copy(join(root, 'public', file), file);
}
copy(join(root, 'src/styles.css'), 'styles.css');
copy(join(frontendPublic, 'favicon-32x32.png'), 'favicon-32x32.png');
copy(join(frontendPublic, 'favicon-16x16.png'), 'favicon-16x16.png');
copy(join(frontendPublic, 'apple-touch-icon.png'), 'apple-touch-icon.png');
copy(join(frontendPublic, 'icons/icon-192x192.png'), 'icon-192.png');
copy(join(frontendPublic, 'icons/icon-512x512.png'), 'icon-512.png');
for (const weight of ['400', '600']) {
	copy(join(fonts, `archivo-latin-${weight}-normal.woff2`), `fonts/archivo-latin-${weight}-normal.woff2`);
}

const screenshot = existsSync(join(root, 'public/screenshot.jpg')) ? 'screenshot.jpg' : undefined;
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
			aiQuota: AI_ASSIST_MONTHLY_QUOTA,
			screenshot,
		}),
	);
	const imprintPath = `${homePath(locale)}${messages.footer.imprintPath}`;
	write(join(imprintPath, 'index.html'), renderImprint({ ...context, operator: OPERATOR, allMessages }));
	paths.push(homePath(locale), imprintPath);
}

write('robots.txt', renderRobots(siteUrl));
if (siteUrl) {
	write('sitemap.xml', renderSitemap(siteUrl, paths));
}
console.log(`[website] ${paths.length} Seiten nach ${dist} geschrieben${siteUrl ? ` (SITE_URL ${siteUrl})` : ''}.`);

import { describe, expect, it } from 'vitest';
import { AI_ASSIST_MONTHLY_QUOTA, FEATURE_IDS, PLAN_VALUES, getPlansCatalog } from '../../server/src/logics/plans.ts';
import { OPERATOR } from '../../frontend/src/lib/operator.ts';
import de from './i18n/de.json';
import en from './i18n/en.json';
import {
	EMAIL_LOGIN_PATH,
	LOGIN_PATH,
	SIGNED_IN_REDIRECT,
	addedFeatures,
	renderImprint,
	renderLanding,
	renderRobots,
	renderSitemap,
} from './render.ts';

const catalog = getPlansCatalog();
const allMessages = { de, en };

const landing = (locale: 'de' | 'en', siteUrl = 'https://example.org', shots?: ReadonlySet<string>) =>
	renderLanding({
		locale,
		messages: allMessages[locale],
		siteUrl,
		catalog,
		plans: PLAN_VALUES,
		aiQuota: AI_ASSIST_MONTHLY_QUOTA,
		shots,
	});

/** Alle Blatt-Schlüssel eines Textobjekts als Pfade, damit de und en vergleichbar werden. */
const keyPaths = (value: unknown, prefix = ''): string[] =>
	value !== null && typeof value === 'object'
		? Object.entries(value).flatMap(([key, child]) => keyPaths(child, prefix ? `${prefix}.${key}` : key))
		: [prefix];

describe('Website-Texte', () => {
	it('de und en haben dieselben Schlüssel', () => {
		expect(keyPaths(en)).toEqual(keyPaths(de));
	});

	it('jede Feature-ID aus plans.ts hat in beiden Sprachen ein Label', () => {
		for (const messages of [de, en]) {
			for (const feature of FEATURE_IDS) {
				expect(messages.pricing.features[feature], feature).toBeTruthy();
			}
		}
	});

	it('jedes Paket aus plans.ts hat in beiden Sprachen einen Namen', () => {
		for (const messages of [de, en]) {
			for (const plan of PLAN_VALUES) {
				expect(messages.pricing.plans[plan], plan).toBeTruthy();
			}
		}
	});
});

describe('renderLanding', () => {
	it('setzt Sprache, canonical und hreflang für beide Sprachen', () => {
		const html = landing('en');
		expect(html).toContain('<html lang="en">');
		expect(html).toContain('<link rel="canonical" href="https://example.org/en/">');
		expect(html).toContain('hreflang="de" href="https://example.org/"');
		expect(html).toContain('hreflang="x-default" href="https://example.org/"');
	});

	it('führt jeden Start-CTA direkt in den Google-Login', () => {
		const html = landing('de');
		expect(html).toContain(`href="${LOGIN_PATH}"`);
		expect(html).toContain(de.hero.cta);
		expect(html).toContain(`href="${EMAIL_LOGIN_PATH}"`);
	});

	it('schickt nur auf der Startseite angemeldete Nutzer vor dem Stylesheet in die App', () => {
		const head = (html: string) => html.slice(0, html.indexOf('</head>'));
		const home = head(landing('en'));
		expect(home).toContain(SIGNED_IN_REDIRECT);
		expect(home.indexOf(SIGNED_IN_REDIRECT)).toBeLessThan(home.indexOf('styles.css'));
		expect(home).not.toContain('display-mode');
		expect(renderImprint({ locale: 'de', messages: de, siteUrl: '', operator: OPERATOR, allMessages })).not.toContain(
			'location.replace',
		);
	});

	it('zeigt Funktionen mit Bild als Zeile, ohne Bild als Karte', () => {
		const [withShot, withoutShot] = de.features.items;
		const html = landing('de', '', new Set(['dashboard', withShot.id]));
		expect(html).toContain(`src="/shots/${withShot.id}.jpg" alt="Screenshot aus der App: ${withShot.title}"`);
		expect(html).toContain('src="/shots/dashboard.jpg"');
		expect(html).not.toContain(`/shots/${withoutShot.id}.jpg`);
		expect(html).toContain(`<h4 class="kern-title">${withoutShot.title}</h4>`);
		// MCP zeigt ohne Screenshot einen Beispiel-Chat mit den aufgerufenen Werkzeugen.
		expect(html).toContain('<figure class="chat"');
		expect(html).toContain('<code>next_task</code>');
	});

	it('zeigt Preise und KI-Kontingente aus plans.ts', () => {
		const html = landing('de');
		expect(html).toContain('7,99 €');
		expect(html).toContain('14,99 €');
		expect(html).toContain('24,99 €');
		expect(html).toContain('239,90 €');
		for (const plan of PLAN_VALUES.filter((entry) => AI_ASSIST_MONTHLY_QUOTA[entry] > 0)) {
			expect(html).toContain(`${AI_ASSIST_MONTHLY_QUOTA[plan]} KI-Anfragen im Monat`);
		}
		for (const plan of PLAN_VALUES) {
			expect(html).toContain(`data-plan="${plan}"`);
		}
	});

	it('listet jedes Feature genau einmal, im kleinsten Paket, das es enthält', () => {
		const listed = PLAN_VALUES.flatMap((plan) => addedFeatures(catalog, PLAN_VALUES, plan));
		expect([...listed].sort()).toEqual([...FEATURE_IDS].sort());
		expect(addedFeatures(catalog, PLAN_VALUES, 'free')).toEqual(['voice_input']);
	});

	it('escaped Texte', () => {
		const html = renderLanding({
			locale: 'de',
			messages: { ...de, hero: { ...de.hero, title: '<script>x</script>' } },
			siteUrl: '',
			catalog,
			plans: PLAN_VALUES,
			aiQuota: AI_ASSIST_MONTHLY_QUOTA,
		});
		expect(html).toContain('&lt;script&gt;x&lt;/script&gt;');
	});

	/**
	 * #1618 AK5/AK6/AK7 (Vertrag: `docs/spec/issue-1618.md`) — die Landing Page stellt den
	 * geschärften USP heraus (objektiv/aufwandsgewichtet/graph-basiert, Gewichte je Aufgabe,
	 * Balance aus erledigtem Aufwand) und nennt weder Konkurrenten noch unausgelieferte Komponenten.
	 */
	it.each(['de', 'en'] as const)('%s: nennt objektiv/aufwandsgewichtet/graph-basiert (AK5)', (locale) => {
		const terms: Record<'de' | 'en', string[]> = {
			de: ['objektiv', 'aufwandsgewichtet', 'graph-basiert'],
			en: ['objective', 'effort-weighted', 'graph-based'],
		};
		const html = landing(locale).toLowerCase();
		for (const term of terms[locale]) {
			expect(html, `${locale}: „${term}" fehlt in hero/features`).toContain(term.toLowerCase());
		}
	});

	it.each(['de', 'en'] as const)(
		'%s: nennt weder Kadenz-/Befüllbarkeits-Komponente noch Strengste-Prinzip (AK7)',
		(locale) => {
			const html = landing(locale).toLowerCase();
			for (const forbidden of ['kadenz', 'befüllbarkeit', 'strengste', 'cadence', 'strictest']) {
				expect(html, `${locale}: enthält verbotenen Begriff „${forbidden}"`).not.toContain(forbidden);
			}
		},
	);
});

describe('renderImprint', () => {
	it('enthält die Anbieterdaten aus operator.ts und verweist auf die andere Sprache', () => {
		const html = renderImprint({ locale: 'de', messages: de, siteUrl: '', operator: OPERATOR, allMessages });
		expect(html).toContain(OPERATOR.name);
		expect(html).toContain(`mailto:${OPERATOR.email}`);
		expect(html).toContain('hreflang="en" href="/en/imprint/"');
	});
});

describe('robots und sitemap', () => {
	it('sperrt App, API und Auth und verlinkt die Sitemap nur mit Basis-URL', () => {
		expect(renderRobots('')).toContain('Disallow: /app/');
		expect(renderRobots('')).not.toContain('Sitemap:');
		expect(renderRobots('https://example.org')).toContain('Sitemap: https://example.org/sitemap.xml');
	});

	it('schreibt absolute URLs in die Sitemap', () => {
		expect(renderSitemap('https://example.org', ['/', '/en/'])).toContain('<loc>https://example.org/en/</loc>');
	});
});

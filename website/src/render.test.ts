import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FEATURE_IDS, PLAN_VALUES, getPlansCatalog } from '../../server/src/logics/plans.ts';
import { OPERATOR } from '../../frontend/src/lib/operator.ts';
import de from './i18n/de.json';
import en from './i18n/en.json';
import es from './i18n/es.json';
import fr from './i18n/fr.json';
import itMessages from './i18n/it.json';
import nl from './i18n/nl.json';
import pl from './i18n/pl.json';
import pt from './i18n/pt.json';
import ru from './i18n/ru.json';
import sv from './i18n/sv.json';
import {
	EMAIL_LOGIN_PATH,
	LOCALES,
	LOGIN_PATH,
	SIGNED_IN_REDIRECT,
	addedFeatures,
	renderAssetLinks,
	renderAccountDeletion,
	renderImprint,
	renderLanding,
	renderRobots,
	renderSitemap,
	type Locale,
	type Messages,
	type PageContext,
} from './render.ts';
import * as renderModule from './render.ts';

// #1672: `renderPrivacy` existiert als Export noch nicht (roter Spec-Zustand) — deshalb optional getippt.
const renderPrivacy = (
	renderModule as unknown as {
		renderPrivacy?: (context: PageContext & { allMessages: Record<Locale, Messages> }) => string;
	}
).renderPrivacy;

// #1891: `renderTerms` existiert als Export noch nicht (roter Spec-Zustand) — deshalb optional getippt.
const renderTerms = (
	renderModule as unknown as {
		renderTerms?: (context: PageContext & { allMessages: Record<Locale, Messages> }) => string;
	}
).renderTerms;

const catalog = getPlansCatalog();
const allMessages = { de, en, es, fr, it: itMessages, nl, pl, pt, ru, sv };

const landing = (locale: Locale, siteUrl = 'https://example.org', shots?: ReadonlySet<string>) =>
	renderLanding({
		locale,
		messages: allMessages[locale],
		siteUrl,
		catalog,
		plans: PLAN_VALUES,
		shots,
	});

/** Alle Blatt-Schlüssel eines Textobjekts als Pfade, damit de und en vergleichbar werden. */
const keyPaths = (value: unknown, prefix = ''): string[] =>
	value !== null && typeof value === 'object'
		? Object.entries(value).flatMap(([key, child]) => keyPaths(child, prefix ? `${prefix}.${key}` : key))
		: [prefix];

describe('Website-Texte', () => {
	it('alle Sprachen haben dieselben Schlüssel wie de', () => {
		for (const messages of Object.values(allMessages)) {
			expect(keyPaths(messages)).toEqual(keyPaths(de));
		}
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
	it('verlinkt jede Sprache per hreflang und rendert Preise im Format der Sprache', () => {
		for (const locale of LOCALES) {
			const html = landing(locale);
			expect(html).toContain(`<html lang="${locale}">`);
			for (const target of LOCALES) expect(html).toContain(`hreflang="${target}" href="https://example.org/`);
		}
		expect(landing('pl')).toMatch(/4,99\s€/u);
		expect(landing('en')).toContain('€4.99');
	});

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

	it('zeigt Preise aus plans.ts und die KI-Hilfe ohne Anzahl (#1783)', () => {
		const html = landing('de');
		expect(html).toContain('4,99 €');
		expect(html).toContain('9,99 €');
		expect(html).toContain('47,90 €');
		expect(html).toContain('95,90 €');
		expect(html).toContain('KI-Hilfe nach Fair Use');
		expect(html).not.toMatch(/\d+ KI-Anfragen/);
		for (const plan of PLAN_VALUES) {
			expect(html).toContain(`data-plan="${plan}"`);
		}
	});

	it('zeigt auf Plus/Pro das Monatsäquivalent der Jahreszahlung, auf Free nichts (#1898)', () => {
		const template = (de.pricing as { yearlyPerMonth?: string }).yearlyPerMonth;
		expect(template).toBeTypeOf('string');
		const html = landing('de');
		const card = (plan: string) => html.slice(html.indexOf(`data-plan="${plan}"`)).split('</article>')[0];
		expect(card('plus')).toContain(template!.replace('{price}', '3,99 €'));
		expect(card('pro')).toContain(template!.replace('{price}', '7,99 €'));
		expect(card('plus')).toContain('47,90 €');
		expect(card('pro')).toContain('95,90 €');
		expect(card('free')).not.toContain(template!.replace('{price}', ''));
	});

	it('listet jedes Feature genau einmal, im kleinsten Paket, das es enthält', () => {
		const listed = PLAN_VALUES.flatMap((plan) => addedFeatures(catalog, PLAN_VALUES, plan));
		expect([...listed].sort()).toEqual([...FEATURE_IDS].sort());
		expect(addedFeatures(catalog, PLAN_VALUES, 'free')).toEqual(['voice_input', 'graph_write']);
	});

	it('escaped Texte', () => {
		const html = renderLanding({
			locale: 'de',
			messages: { ...de, hero: { ...de.hero, title: '<script>x</script>' } },
			siteUrl: '',
			catalog,
			plans: PLAN_VALUES,
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

	/** #1754 — nur FAQ-Einträge mit href/linkText bekommen einen kern-link-Anker in der Antwort. */
	it('verlinkt genau den FAQ-Eintrag mit Download-Link als kern-link (#1754)', () => {
		const html = landing('de');
		const bodies = [
			...html.matchAll(/<div class="kern-accordion__body"><p class="kern-body">([\s\S]*?)<\/p><\/div>/g),
		].map((match) => match[1]);
		expect(bodies).toHaveLength(de.faq.items.length);
		const linked = bodies.filter((body) => body.includes('<a '));
		expect(linked).toHaveLength(1);
		const item = de.faq.items.find((item) => item.href && item.linkText);
		expect(linked[0]).toContain(`<a class="kern-link" href="${item?.href}">${item?.linkText}</a>`);
	});
});

describe('renderImprint', () => {
	it('enthält die Anbieterdaten aus operator.ts und verweist auf die andere Sprache', () => {
		const html = renderImprint({ locale: 'de', messages: de, siteUrl: '', operator: OPERATOR, allMessages });
		expect(html).toContain(OPERATOR.name);
		expect(html).toContain(`mailto:${OPERATOR.email}`);
		expect(html).toContain('hreflang="en" href="/en/imprint/"');
	});
});

describe('renderAccountDeletion (#1681)', () => {
	it('nennt den Weg in der App, gelöschte und aufbewahrte Daten und eine Kontaktadresse', () => {
		const html = renderAccountDeletion({ locale: 'de', messages: de, siteUrl: '', operator: OPERATOR, allMessages });
		expect(html).toContain('<h1 class="kern-heading-large">Konto löschen</h1>');
		expect(html).toContain('„Konto löschen“');
		expect(html).toContain('Was gelöscht wird');
		expect(html).toContain('Rechnungen und Abo-Datensätze');
		expect(html).toContain(`mailto:${OPERATOR.email}`);
		expect(html).toContain('hreflang="en" href="/en/delete-account/"');
	});

	it('ist in jeder Sprache aus dem Footer verlinkt', () => {
		for (const [locale, messages] of Object.entries(allMessages)) {
			const html = renderImprint({
				locale: locale as keyof typeof allMessages,
				messages,
				siteUrl: '',
				operator: OPERATOR,
				allMessages,
			});
			expect(html, locale).toContain(`${messages.footer.accountDeletionPath}">${messages.footer.accountDeletion}</a>`);
		}
	});
});

/**
 * #1672 AK1/AK2/AK3 (Vertrag: `docs/spec/issue-1672.md`) — die Datenschutzerklärung liegt als
 * deutsche Seite unter der festen URL `/datenschutz/`, nennt die vier Empfänger und vier
 * Grundsätze und ist aus dem Footer aller zehn Sprachen sowie der Sitemap erreichbar.
 */
describe('renderPrivacy (#1672)', () => {
	it('rendert H1 „Datenschutz“ mit Empfängern und Grundsätzen (AK1)', () => {
		expect(renderPrivacy, 'renderPrivacy existiert noch nicht (Export in render.ts)').toBeTypeOf('function');
		const html = renderPrivacy!({ locale: 'de', messages: de, siteUrl: '', allMessages });
		expect(html).toMatch(/<h1[^>]*>Datenschutz<\/h1>/);
		for (const recipient of ['PayPal', 'Google-Login', 'Firebase Cloud Messaging', 'Google Play']) {
			expect(html, `Empfänger „${recipient}“ fehlt`).toContain(recipient);
		}
		const lower = html.toLowerCase();
		for (const principle of ['sparsam', 'auswertung', 'weitergabe']) {
			expect(lower, `Grundsatz „${principle}“ fehlt`).toContain(principle);
		}
	});

	it('verlinkt /datenschutz/ aus dem Footer aller zehn Sprachen (AK2)', () => {
		for (const [locale, messages] of Object.entries(allMessages)) {
			const label = (messages.footer as { privacy?: string }).privacy;
			expect(label, `${locale}: i18n-Key footer.privacy fehlt`).toBeTruthy();
			expect(landing(locale as Locale), locale).toContain(`href="/datenschutz/">${label}</a>`);
		}
	});

	it('baut /datenschutz/ vor und nimmt die URL in die Sitemap auf (AK3)', { timeout: 120_000 }, () => {
		const websiteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
		execFileSync('pnpm', ['build'], {
			cwd: websiteRoot,
			env: { ...process.env, SITE_URL: 'https://example.org' },
			stdio: 'pipe',
		});
		expect(
			existsSync(join(websiteRoot, 'dist', 'datenschutz', 'index.html')),
			'dist/datenschutz/index.html fehlt',
		).toBe(true);
		expect(readFileSync(join(websiteRoot, 'dist', 'sitemap.xml'), 'utf8')).toContain(
			'<loc>https://example.org/datenschutz/</loc>',
		);
	});
});

/**
 * #1891 (Vertrag: `docs/spec/issue-1891.md`) — Nutzungsbedingungen als feste deutsche Seite unter
 * `/nutzungsbedingungen/`, Preise aus `plans.ts`, Footer-Link in allen zehn Sprachen, Sitemap.
 */
describe('renderTerms (#1891)', () => {
	const terms = () => {
		expect(renderTerms, 'renderTerms existiert noch nicht (Export in render.ts)').toBeTypeOf('function');
		return renderTerms!({ locale: 'de', messages: de, siteUrl: '', allMessages });
	};

	it('rendert lang="de" mit den vier Abschnittsüberschriften (AK1, AK3)', () => {
		const html = terms();
		expect(html).toContain('<html lang="de"');
		for (const heading of ['Konto', 'Pakete und Abo', 'Zahlungswege', 'Haftung']) {
			expect(html, `h2 „${heading}“ fehlt`).toMatch(new RegExp(`<h2[^>]*>\\s*${heading}\\s*</h2>`));
		}
	});

	it('nennt Laufzeit, Upgrade, Downgrade, Kündigung, PayPal und Google Play (AK3)', () => {
		const html = terms();
		for (const term of ['Laufzeit', 'Upgrade', 'Downgrade', 'Kündigung', 'PayPal', 'Google Play']) {
			expect(html, `Begriff „${term}“ fehlt`).toContain(term);
		}
	});

	it('bezieht Paketnamen und Preise aus plans.ts (AK4)', () => {
		const html = terms();
		const euro = (cents: number) => `${(cents / 100).toFixed(2).replace('.', ',')}`;
		for (const plan of ['plus', 'pro'] as const) {
			expect(html, `Monatspreis ${plan}`).toContain(euro(catalog.prices[plan].monthly));
			expect(html, `Jahrespreis ${plan}`).toContain(euro(catalog.prices[plan].yearly));
		}
		for (const name of ['Free', 'Plus', 'Pro']) {
			expect(html, `Paketname ${name}`).toContain(name);
		}
	});

	it('verlinkt /nutzungsbedingungen/ aus dem Footer aller zehn Sprachen (AK2)', () => {
		for (const [locale, messages] of Object.entries(allMessages)) {
			const label = (messages.footer as { terms?: string }).terms;
			expect(label, `${locale}: i18n-Key footer.terms fehlt`).toBeTruthy();
			expect(landing(locale as Locale), locale).toMatch(new RegExp(`href="/nutzungsbedingungen/"[^>]*>${label}</a>`));
			expect(landing(locale as Locale), `${locale}: Datenschutz-Link bleibt`).toContain('href="/datenschutz/"');
		}
	});

	it(
		'baut /nutzungsbedingungen/ nur einmal (de) und nimmt die URL in die Sitemap auf (AK1)',
		{ timeout: 120_000 },
		() => {
			const websiteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
			execFileSync('pnpm', ['build'], {
				cwd: websiteRoot,
				env: { ...process.env, SITE_URL: 'https://example.org' },
				stdio: 'pipe',
			});
			expect(
				existsSync(join(websiteRoot, 'dist', 'nutzungsbedingungen', 'index.html')),
				'dist/nutzungsbedingungen/index.html fehlt',
			).toBe(true);
			expect(existsSync(join(websiteRoot, 'dist', 'en', 'nutzungsbedingungen')), 'keine Sprachvariante').toBe(false);
			expect(readFileSync(join(websiteRoot, 'dist', 'sitemap.xml'), 'utf8')).toContain(
				'<loc>https://example.org/nutzungsbedingungen/</loc>',
			);
		},
	);
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

describe('asset links', () => {
	it('enthält Package-ID und alle Fingerprints', () => {
		const json = renderAssetLinks('de.balamentum.app', 'AA:01, BB:02\nCC:03');
		expect(JSON.parse(json ?? '')).toEqual([
			{
				relation: ['delegate_permission/common.handle_all_urls'],
				target: {
					namespace: 'android_app',
					package_name: 'de.balamentum.app',
					sha256_cert_fingerprints: ['AA:01', 'BB:02', 'CC:03'],
				},
			},
		]);
	});

	it('entfällt ohne Package-ID oder Fingerprint', () => {
		expect(renderAssetLinks('', 'AA:01')).toBeNull();
		expect(renderAssetLinks('de.balamentum.app', ' ')).toBeNull();
	});
});

/**
 * #1786 (Vertrag: `docs/spec/issue-1786.md`) — Preisseite in allen zehn Sprachen: genau Free/Plus/Pro,
 * Monats-/Quartals-/Jahrespreis aus `catalog.prices`, kein Max/Ultimate, keine KI-Anfragenzahl.
 */
describe('Preisseite Free/Plus/Pro (#1786)', () => {
	const eur = (locale: Locale, cents: number) =>
		new Intl.NumberFormat(locale === 'pt' ? 'pt-PT' : locale, { style: 'currency', currency: 'EUR' })
			.format(cents / 100)
			.replace(/[  ]/g, ' ');
	const normalized = (html: string) => html.replace(/&nbsp;|[  ]/g, ' ');

	it.each([...LOCALES])('%s: drei Karten, alle Periodenpreise, kein Max/Ultimate/Anfragenzahl (AK1-AK3)', (locale) => {
		const html = landing(locale);
		expect(html.match(/data-plan="/g)).toHaveLength(3);
		const text = normalized(html);
		for (const plan of ['plus', 'pro'] as const) {
			for (const period of ['monthly', 'quarterly', 'yearly'] as const) {
				expect(text).toContain(eur(locale, catalog.prices[plan][period]));
			}
		}
		expect(html).not.toMatch(/\b(Max|Ultimate)\b/);
		expect(allMessages[locale].pricing.aiQuota).not.toMatch(/\d/);
	});

	it('de: MCP-Zeile nennt Lesen ab Plus und Schreiben in Pro (AK3)', () => {
		const mcp = de.features.items.find((item) => item.id === 'mcp')?.points.at(-1) ?? '';
		expect(mcp).toMatch(/Plus/);
		expect(mcp).toMatch(/Pro/);
		expect(mcp).not.toMatch(/Max|Ultimate/);
	});

	it('leitet alle Periodenpreise aus dem übergebenen Katalog ab (AK4)', () => {
		const custom = {
			...catalog,
			prices: {
				...catalog.prices,
				plus: { monthly: 111, quarterly: 222, yearly: 333 },
				pro: { monthly: 444, quarterly: 555, yearly: 666 },
			},
		};
		const html = normalized(
			renderLanding({ locale: 'de', messages: de, siteUrl: '', catalog: custom, plans: PLAN_VALUES }),
		);
		for (const price of ['1,11 €', '2,22 €', '3,33 €', '4,44 €', '5,55 €', '6,66 €']) {
			expect(html).toContain(price);
		}
		expect(html).not.toContain('13,47 €');
	});
});

/**
 * #1892 AK1–AK3 (Vertrag: `docs/spec/issue-1892.md`) — vollständige Datenschutzerklärung: je Verarbeitung
 * ein eigener Abschnitt mit den vier Pflichtangaben, Verantwortlicher aus `operator.ts`, keine
 * Ende-zu-Ende-Zusage (löst die Assertion aus #1672 ab).
 */
describe('renderPrivacy vollständig (#1892)', () => {
	const html =
		renderPrivacy?.({ locale: 'de', messages: de, siteUrl: '', operator: OPERATOR, allMessages } as never) ?? '';
	/** Text je h2-Abschnitt, Schlüssel = Überschrift. */
	const sections = html
		.split(/<h2[^>]*>/)
		.slice(1)
		.map((chunk) => {
			const [heading, ...rest] = chunk.split('</h2>');
			return { heading: heading ?? '', text: rest.join('').replace(/<[^>]+>/g, ' ') };
		});
	const PROCESSINGS: [string, RegExp][] = [
		['Google-Login', /google-login|anmeldung/i],
		['Standort und Orte', /standort|orte/i],
		['Push', /push/i],
		['KI-Anbieter', /\bki\b|ki-anbieter/i],
		['PayPal', /paypal/i],
		['Google Play', /google play/i],
		['Rechnungen', /rechnung/i],
		['Feedback', /feedback/i],
		['MCP-Zugriff', /mcp|access-token/i],
		['Android-App', /android/i],
	];

	it('hat je Verarbeitung einen eigenen Abschnitt mit Zweck, Rechtsgrundlage, Speicherdauer, Empfänger (AK1)', () => {
		expect(renderPrivacy, 'renderPrivacy fehlt').toBeTypeOf('function');
		for (const [name, heading] of PROCESSINGS) {
			const section = sections.find((s) => heading.test(s.heading));
			expect(section, `${name}: kein h2-Abschnitt`).toBeDefined();
			for (const field of ['Zweck', 'Rechtsgrundlage', 'Speicherdauer', 'Empfänger']) {
				expect(section!.text, `${name}: „${field}“ fehlt`).toContain(field);
			}
		}
	});

	it('nimmt das Feedback nicht mehr von der Kontolöschung aus (#1922 AK4)', () => {
		const feedback = sections.find((s) => /feedback/i.test(s.heading));
		expect(feedback, 'Feedback-Abschnitt fehlt').toBeDefined();
		expect(feedback!.text).not.toContain('nicht automatisch');
		expect(feedback!.text).toMatch(/beim Löschen (des|deines) Kontos/);
	});

	it('nennt Verantwortlichen, Kontakt aus operator.ts, Betroffenenrechte und Aufsichtsbehörde (AK2)', () => {
		expect(html).toContain(OPERATOR.name);
		expect(html).toContain(OPERATOR.email);
		for (const right of [
			'Auskunft',
			'Berichtigung',
			'Löschung',
			'Einschränkung',
			'Datenübertragbarkeit',
			'Widerspruch',
			'Beschwerde',
		]) {
			expect(html, `Recht „${right}“ fehlt`).toContain(right);
		}
		expect(html).toContain('Aufsichtsbehörde');
	});

	it('enthält keine Ende-zu-Ende-Zusage, aber HTTPS und gehashte Tokens (AK3)', () => {
		expect(html).not.toMatch(/ende-zu-ende|e2e/i);
		expect(html).toContain('HTTPS');
		expect(html).toMatch(/gehasht|Hash/i);
	});
});

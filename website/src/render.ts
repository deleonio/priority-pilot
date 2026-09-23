/**
 * Renderer der öffentlichen Website (ADR 0015): reine Funktionen, die aus Texten, Paketkatalog und
 * Anbieterdaten statisches HTML erzeugen. Kein Framework, kein Client-JS.
 */
import type { FeatureId, Plan, PlansCatalog } from '../../server/src/logics/plans.ts';
import type { OPERATOR } from '../../frontend/src/lib/operator.ts';
import type de from './i18n/de.json';

export type Messages = typeof de;
export type Locale = 'de' | 'en';
export type Operator = typeof OPERATOR;

export const LOCALES: readonly Locale[] = ['de', 'en'];

/** Pfad der Startseite je Sprache; Deutsch liegt an der Wurzel. */
export const homePath = (locale: Locale): string => (locale === 'de' ? '/' : `/${locale}/`);

/** Einstieg in die App und direkter Google-Login (Redirect danach auf /app/, siehe routes/auth.ts). */
export const APP_PATH = '/app/';
export const LOGIN_PATH = '/auth/google';

export interface PageContext {
	locale: Locale;
	messages: Messages;
	/** Absolute Basis-URL ohne abschließenden Slash (z. B. `https://example.org`) oder '' für relative Links. */
	siteUrl: string;
}

export interface LandingContext extends PageContext {
	catalog: PlansCatalog;
	plans: readonly Plan[];
	aiQuota: Record<Plan, number>;
	/** Dateiname des App-Screenshots unter `/`, wenn vorhanden. */
	screenshot?: string;
}

const escapeHtml = (value: string): string =>
	value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');

/** Kurzform für escapte Texte im Template. */
const t = escapeHtml;

const fill = (template: string, values: Record<string, string>): string =>
	template.replace(/\{(\w+)\}/g, (_match, key: string) => values[key] ?? `{${key}}`);

const formatPrice = (cents: number, locale: Locale): string =>
	new Intl.NumberFormat(locale === 'de' ? 'de-DE' : 'en-IE', { style: 'currency', currency: 'EUR' }).format(
		cents / 100,
	);

/**
 * Features, die ein Paket gegenüber dem vorigen Paket der Rangfolge neu freischaltet. So zeigt jede
 * Paketkarte nur den Zugewinn („Alles aus Pro, dazu: …“) und bleibt auf dem Handy kurz.
 */
export const addedFeatures = (catalog: PlansCatalog, plans: readonly Plan[], plan: Plan): FeatureId[] => {
	const index = plans.indexOf(plan);
	const previous = index > 0 ? plans[index - 1] : undefined;
	return catalog.features
		.filter((entry) => entry.allowedPlans.includes(plan) && (!previous || !entry.allowedPlans.includes(previous)))
		.map((entry) => entry.feature);
};

const alternateLinks = ({ siteUrl }: PageContext, pathFor: (locale: Locale) => string): string =>
	[
		...LOCALES.map((locale) => `<link rel="alternate" hreflang="${locale}" href="${siteUrl}${pathFor(locale)}">`),
		`<link rel="alternate" hreflang="x-default" href="${siteUrl}${pathFor('de')}">`,
	].join('\n\t\t');

const otherLocale = (locale: Locale): Locale => (locale === 'de' ? 'en' : 'de');

interface ShellOptions {
	title: string;
	description: string;
	path: string;
	pathFor: (locale: Locale) => string;
	body: string;
}

/** Leerzeilen aus bedingten Template-Teilen entfernen, damit das ausgelieferte HTML sauber bleibt. */
const tidy = (html: string): string => html.replace(/\n[\t ]*(?=\n)/g, '');

const shell = (context: PageContext, { title, description, path, pathFor, body }: ShellOptions): string => {
	const { locale, messages, siteUrl } = context;
	const other = otherLocale(locale);
	return tidy(`<!doctype html>
<html lang="${locale}">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1">
		<title>${t(title)}</title>
		<meta name="description" content="${t(description)}">
		<link rel="canonical" href="${siteUrl}${path}">
		${alternateLinks(context, pathFor)}
		<meta property="og:type" content="website">
		<meta property="og:title" content="${t(title)}">
		<meta property="og:description" content="${t(description)}">
		<meta property="og:url" content="${siteUrl}${path}">
		<meta property="og:image" content="${siteUrl}/icon-512.png">
		<meta property="og:locale" content="${locale === 'de' ? 'de_DE' : 'en_US'}">
		<meta name="theme-color" content="#1b3a6b">
		<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
		<link rel="apple-touch-icon" href="/apple-touch-icon.png">
		<link rel="preload" href="/fonts/archivo-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
		<link rel="stylesheet" href="/styles.css">
	</head>
	<body>
		<a class="skip-link" href="#main">${t(messages.meta.skip)}</a>
		<header class="site-header">
			<div class="container site-header__inner">
				<a class="brand" href="${homePath(locale)}"><img src="/icon-192.png" alt="" width="36" height="36"><span>Balamentum</span></a>
				<nav aria-label="${t(messages.nav.label)}" class="site-nav">
					<a class="kern-link site-nav__anchor" href="${homePath(locale)}#features">${t(messages.nav.features)}</a>
					<a class="kern-link site-nav__anchor" href="${homePath(locale)}#pricing">${t(messages.nav.pricing)}</a>
					<a class="kern-link site-nav__anchor" href="${homePath(locale)}#faq">${t(messages.nav.faq)}</a>
					<a class="kern-link" href="${pathFor(other)}" hreflang="${other}" lang="${other}" aria-label="${t(messages.meta.switchLanguageLabel)}">${t(messages.meta.switchLanguage)}</a>
					<a class="kern-btn kern-btn--secondary" href="${APP_PATH}"><span class="kern-label">${t(messages.nav.openApp)}</span></a>
				</nav>
			</div>
		</header>
		<main id="main">
${body}
		</main>
		<footer class="site-footer">
			<div class="container site-footer__inner">
				<span>© ${new Date().getFullYear()} Balamentum</span>
				<a class="kern-link" href="${homePath(locale)}${messages.footer.imprintPath}">${t(messages.footer.imprint)}</a>
				<a class="kern-link" href="${pathFor(other)}" hreflang="${other}" lang="${other}">${t(messages.meta.switchLanguage)}</a>
			</div>
		</footer>
	</body>
</html>
`);
};

const ctaButton = (label: string): string =>
	`<a class="kern-btn kern-btn--primary cta" href="${LOGIN_PATH}"><span class="kern-label">${t(label)}</span></a>`;

const planCard = (context: LandingContext, plan: Plan): string => {
	const { messages, locale, catalog, plans, aiQuota } = context;
	const price = catalog.prices[plan];
	const index = plans.indexOf(plan);
	const features = addedFeatures(catalog, plans, plan);
	const items = [
		...(index === 0 ? [messages.pricing.basics] : []),
		...features.map((feature) =>
			feature === 'ai_assist'
				? `${messages.pricing.features[feature]} (${fill(messages.pricing.aiQuota, { count: String(aiQuota[plan]) })})`
				: messages.pricing.features[feature],
		),
		// Höheres KI-Kontingent ist auch ohne neues Feature ein Zugewinn.
		...(index > 0 && !features.includes('ai_assist') && aiQuota[plan] > aiQuota[plans[index - 1]]
			? [fill(messages.pricing.aiQuota, { count: String(aiQuota[plan]) })]
			: []),
	];
	const amount = price.monthly === 0 ? messages.pricing.free : formatPrice(price.monthly, locale);
	return `				<article class="kern-card plan" data-plan="${plan}">
					<div class="kern-card__container">
						<header class="kern-card__header">
							<hgroup>
								<h3 class="kern-title">${t(messages.pricing.plans[plan])}</h3>
							</hgroup>
						</header>
						<section class="kern-card__body">
							<p class="plan__price"><strong>${t(amount)}</strong>${price.monthly === 0 ? '' : ` <span>${t(messages.pricing.perMonth)}</span>`}</p>
							${price.yearly === 0 ? '' : `<p class="plan__yearly">${t(fill(messages.pricing.yearly, { price: formatPrice(price.yearly, locale) }))}</p>`}
							${index === 0 ? '' : `<p class="plan__includes">${t(fill(messages.pricing.includesPrevious, { plan: messages.pricing.plans[plans[index - 1]] }))}</p>`}
							<ul class="plan__features">
${items.map((item) => `								<li>${t(item)}</li>`).join('\n')}
							</ul>
						</section>
					</div>
				</article>`;
};

/** Startseite einer Sprache: Hero, drei Schritte, Selling Points, Pakete, FAQ, Schluss-CTA. */
export const renderLanding = (context: LandingContext): string => {
	const { messages: m, locale, plans, screenshot } = context;
	const body = `			<section class="hero">
				<div class="container hero__inner">
					<div class="hero__text">
						<p class="kern-preline">${t(m.hero.eyebrow)}</p>
						<h1 class="kern-heading-display">${t(m.hero.title)}</h1>
						<p class="kern-body kern-body--large">${t(m.hero.lead)}</p>
						<div class="hero__actions">
							${ctaButton(m.hero.cta)}
							<a class="kern-link" href="${APP_PATH}">${t(m.hero.secondary)}</a>
						</div>
						<p class="kern-body kern-body--small hero__note">${t(m.hero.ctaNote)}</p>
					</div>
${screenshot ? `					<img class="hero__shot" src="/${screenshot}" alt="${t(m.hero.screenshotAlt)}" width="750" height="1624">\n` : ''}				</div>
			</section>
			<section class="section" aria-labelledby="steps-title">
				<div class="container">
					<h2 id="steps-title" class="kern-heading-large">${t(m.steps.title)}</h2>
					<ol class="steps">
${m.steps.items.map((step) => `						<li><h3 class="kern-title">${t(step.title)}</h3><p class="kern-body">${t(step.text)}</p></li>`).join('\n')}
					</ol>
				</div>
			</section>
			<section class="section section--alt" id="features" aria-labelledby="features-title">
				<div class="container">
					<h2 id="features-title" class="kern-heading-large">${t(m.features.title)}</h2>
					<div class="grid">
${m.features.items
	.map(
		(feature) => `						<article class="kern-card">
							<div class="kern-card__container">
								<header class="kern-card__header"><hgroup><h3 class="kern-title">${t(feature.title)}</h3></hgroup></header>
								<section class="kern-card__body"><p class="kern-body">${t(feature.text)}</p></section>
							</div>
						</article>`,
	)
	.join('\n')}
					</div>
				</div>
			</section>
			<section class="section" id="pricing" aria-labelledby="pricing-title">
				<div class="container">
					<h2 id="pricing-title" class="kern-heading-large">${t(m.pricing.title)}</h2>
					<p class="kern-body kern-body--large">${t(m.pricing.lead)}</p>
					<div class="grid grid--plans">
${plans.map((plan) => planCard(context, plan)).join('\n')}
					</div>
					<p class="kern-body kern-body--small">${t(m.pricing.discounts)}</p>
					${ctaButton(m.pricing.cta)}
				</div>
			</section>
			<section class="section section--alt" id="faq" aria-labelledby="faq-title">
				<div class="container container--narrow">
					<h2 id="faq-title" class="kern-heading-large">${t(m.faq.title)}</h2>
${m.faq.items.map((item) => `					<details class="kern-accordion"><summary class="kern-accordion__header"><span class="kern-title">${t(item.q)}</span></summary><div class="kern-accordion__body"><p class="kern-body">${t(item.a)}</p></div></details>`).join('\n')}
				</div>
			</section>
			<section class="section final">
				<div class="container container--narrow">
					<h2 class="kern-heading-large">${t(m.final.title)}</h2>
					<p class="kern-body kern-body--large">${t(m.final.text)}</p>
					${ctaButton(m.hero.cta)}
				</div>
			</section>`;
	return shell(context, {
		title: m.meta.title,
		description: m.meta.description,
		path: homePath(locale),
		pathFor: homePath,
		body,
	});
};

/** Impressum je Sprache (Pflichtangabe nach § 5 DDG), Daten aus `frontend/src/lib/operator.ts`. */
export const renderImprint = (
	context: PageContext & { operator: Operator; allMessages: Record<Locale, Messages> },
): string => {
	const { messages: m, locale, operator, allMessages } = context;
	const pathFor = (target: Locale): string => `${homePath(target)}${allMessages[target].footer.imprintPath}`;
	const body = `			<section class="section">
				<div class="container container--narrow imprint">
					<h1 class="kern-heading-large">${t(m.imprint.title)}</h1>
					<h2 class="kern-title">${t(m.imprint.provider)}</h2>
					<p class="kern-body">${[operator.name, ...operator.address].map(t).join('<br>')}</p>
					<h2 class="kern-title">${t(m.imprint.contact)}</h2>
					<p class="kern-body">${t(m.imprint.email)}: <a class="kern-link" href="mailto:${t(operator.email)}">${t(operator.email)}</a></p>
					<h2 class="kern-title">${t(m.imprint.representative)}</h2>
					<p class="kern-body">${t(operator.representative)}</p>
${operator.ustId ? `					<h2 class="kern-title">${t(m.imprint.vatId)}</h2>\n					<p class="kern-body">${t(operator.ustId)}</p>\n` : ''}${operator.contentResponsible ? `					<h2 class="kern-title">${t(m.imprint.responsible)}</h2>\n					<p class="kern-body">${t(operator.contentResponsible)}</p>\n` : ''}					<h2 class="kern-title">${t(m.imprint.odrTitle)}</h2>
					<p class="kern-body">${t(m.imprint.odrText)} <a class="kern-link" href="https://ec.europa.eu/consumers/odr/" rel="noopener noreferrer">https://ec.europa.eu/consumers/odr/</a></p>
					<h2 class="kern-title">${t(m.imprint.consumerTitle)}</h2>
					<p class="kern-body">${t(m.imprint.consumerText)}</p>
					<p><a class="kern-link" href="${homePath(locale)}">${t(m.imprint.back)}</a></p>
				</div>
			</section>`;
	return shell(context, {
		title: `${m.imprint.title} – Balamentum`,
		description: m.meta.description,
		path: pathFor(locale),
		pathFor,
		body,
	});
};

/** robots.txt; die Sitemap wird nur mit bekannter Basis-URL verlinkt (sie braucht absolute URLs). */
export const renderRobots = (siteUrl: string): string =>
	`User-agent: *\nDisallow: /app/\nDisallow: /api/\nDisallow: /auth/\n${siteUrl ? `Sitemap: ${siteUrl}/sitemap.xml\n` : ''}`;

export const renderSitemap = (siteUrl: string, paths: readonly string[]): string =>
	`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths
		.map((path) => `\t<url><loc>${siteUrl}${path}</loc></url>`)
		.join('\n')}\n</urlset>\n`;

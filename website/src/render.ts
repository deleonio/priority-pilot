/**
 * Renderer der öffentlichen Website (ADR 0015): reine Funktionen, die aus Texten, Paketkatalog und
 * Anbieterdaten statisches HTML erzeugen. Kein Framework; einziges Client-JS ist der Sprung
 * angemeldeter Nutzer in die App ({@link SIGNED_IN_REDIRECT}).
 */
import {
	PLAN_VALUES,
	getPlansCatalog,
	yearlyMonthlyEquivalent,
	type FeatureId,
	type Plan,
	type PlansCatalog,
} from '../../server/src/logics/plans.ts';
import { OPERATOR } from '../../frontend/src/lib/operator.ts';
import { PRIVACY } from './privacy.ts';
import { TERMS } from './terms.ts';
import { WITHDRAWAL } from './withdrawal.ts';
import { MCP_GUIDE } from './mcp-guide.ts';
import { TEMPLATES } from './templates.ts';
import { CLIENT_SCRIPT, QUESTIONS, SCALE_LABELS } from './assessment.ts';
import { SEED_PILLARS } from '../../server/src/models/pillarData.ts';
import type { LifeTemplate } from './templates.ts';
import type de from './i18n/de.json';

export type Messages = typeof de;
export type Locale = 'de' | 'en' | 'es' | 'fr' | 'it' | 'nl' | 'pl' | 'pt' | 'ru' | 'sv';
export type Operator = typeof OPERATOR;

/** Dieselben zehn Sprachen wie die App (`frontend/src/i18n/locales`). */
export const LOCALES: readonly Locale[] = ['de', 'en', 'es', 'fr', 'it', 'nl', 'pl', 'pt', 'ru', 'sv'];

/** Sprachname in der eigenen Sprache (Sprachwahl), Intl-Locale für Preise und `og:locale`. */
const LOCALE_INFO: Record<Locale, { name: string; intl: string; og: string }> = {
	de: { name: 'Deutsch', intl: 'de-DE', og: 'de_DE' },
	en: { name: 'English', intl: 'en-IE', og: 'en_US' },
	es: { name: 'Español', intl: 'es-ES', og: 'es_ES' },
	fr: { name: 'Français', intl: 'fr-FR', og: 'fr_FR' },
	it: { name: 'Italiano', intl: 'it-IT', og: 'it_IT' },
	nl: { name: 'Nederlands', intl: 'nl-NL', og: 'nl_NL' },
	pl: { name: 'Polski', intl: 'pl-PL', og: 'pl_PL' },
	pt: { name: 'Português', intl: 'pt-PT', og: 'pt_PT' },
	ru: { name: 'Русский', intl: 'ru-RU', og: 'ru_RU' },
	sv: { name: 'Svenska', intl: 'sv-SE', og: 'sv_SE' },
};

/** Pfad der Startseite je Sprache; Deutsch liegt an der Wurzel. */
export const homePath = (locale: Locale): string => (locale === 'de' ? '/' : `/${locale}/`);

/** Einstieg in die App und direkter Google-Login (Redirect danach auf /app/, siehe routes/auth.ts). */
export const APP_PATH = '/app/';
export const LOGIN_PATH = '/auth/google';
/** App-Login mit Fokus auf den Anmeldelink per E-Mail (`LoginPage.tsx`, ohne stillen Google-Versuch). */
export const EMAIL_LOGIN_PATH = `${APP_PATH}?login=email`;

/**
 * Angemeldete Nutzer springen von der Startseite direkt in die App (ADR 0015, Punkt 4). Das Cookie
 * `bm_signed_in` setzt der Server bei jedem erfolgreichen `GET /auth/me` und löscht es bei 401 und
 * Logout (`server/src/express/routes/auth.ts`). Das Skript steht vor dem Stylesheet im `<head>`,
 * damit die Website gar nicht erst sichtbar wird. `?web` zeigt die Website trotzdem.
 */
export const SIGNED_IN_REDIRECT = `<script>if(/(?:^|; )bm_signed_in=1/.test(document.cookie)&&!new URLSearchParams(location.search).has('web'))location.replace('${APP_PATH}')</script>`;

export interface PageContext {
	locale: Locale;
	messages: Messages;
	/** Absolute Basis-URL ohne abschließenden Slash (z. B. `https://example.org`) oder '' für relative Links. */
	siteUrl: string;
}

export interface LandingContext extends PageContext {
	catalog: PlansCatalog;
	plans: readonly Plan[];
	/** Vorhandene App-Screenshots unter `/shots/<id>.jpg` (Feature-Ids plus `dashboard` für den Hero). */
	shots?: ReadonlySet<string>;
}

/** Maße der Screenshots aus `frontend/e2e/landing-shots.spec.ts` (375 × 812 CSS-Pixel, doppelte Dichte). */
const SHOT_WIDTH = 750;
const SHOT_HEIGHT = 1624;

const shotImage = (id: string, alt: string, className: string, lazy = true): string =>
	`<img class="${className}" src="/shots/${id}.jpg" alt="${t(alt)}" width="${SHOT_WIDTH}" height="${SHOT_HEIGHT}"${lazy ? ' loading="lazy"' : ''} decoding="async">`;

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
	new Intl.NumberFormat(LOCALE_INFO[locale].intl, { style: 'currency', currency: 'EUR' }).format(cents / 100);

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

/** Links auf dieselbe Seite in allen Sprachen, die aktuelle als `aria-current`. */
const languageLinks = (locale: Locale, pathFor: (locale: Locale) => string, indent: string): string =>
	LOCALES.map(
		(target) =>
			`${indent}<li><a class="kern-link" href="${pathFor(target)}" hreflang="${target}" lang="${target}"${target === locale ? ' aria-current="page"' : ''}>${LOCALE_INFO[target].name}</a></li>`,
	).join('\n');

interface ShellOptions {
	title: string;
	description: string;
	path: string;
	pathFor: (locale: Locale) => string;
	body: string;
	/** Zusätzliches Markup ganz am Anfang des `<head>`. */
	head?: string;
}

/** Leerzeilen aus bedingten Template-Teilen entfernen, damit das ausgelieferte HTML sauber bleibt. */
const tidy = (html: string): string => html.replace(/\n[\t ]*(?=\n)/g, '');

const shell = (context: PageContext, { title, description, path, pathFor, body, head = '' }: ShellOptions): string => {
	const { locale, messages, siteUrl } = context;
	return tidy(`<!doctype html>
<html lang="${locale}">
	<head>
		<meta charset="UTF-8">
		${head}
		<meta name="viewport" content="width=device-width, initial-scale=1">
		<title>${t(title)}</title>
		<meta name="description" content="${t(description)}">
		<link rel="canonical" href="${siteUrl}${path}">
		${alternateLinks(context, pathFor)}
		<meta property="og:type" content="website">
		<meta property="og:title" content="${t(title)}">
		<meta property="og:description" content="${t(description)}">
		<meta property="og:url" content="${siteUrl}${path}">
		<meta property="og:image" content="${siteUrl}/og-image.jpg">
		<meta property="og:image:width" content="1200">
		<meta property="og:image:height" content="630">
		<meta property="og:locale" content="${LOCALE_INFO[locale].og}">
		<meta name="theme-color" content="#1b3a6b" media="(prefers-color-scheme: light)">
		<meta name="theme-color" content="#12161c" media="(prefers-color-scheme: dark)">
		<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
		<link rel="apple-touch-icon" href="/apple-touch-icon.png">
		<link rel="preload" href="/fonts/archivo-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
		<link rel="preload" href="/fonts/archivo-latin-600-normal.woff2" as="font" type="font/woff2" crossorigin>
		<link rel="stylesheet" href="/styles.css">
	</head>
	<body>
		<a class="skip-link" href="#main">${t(messages.meta.skip)}</a>
		<header class="site-header">
			<div class="container site-header__inner">
				<a class="brand" href="${homePath(locale)}"><picture><source srcset="/logo-with-name.dark.svg" media="(prefers-color-scheme: dark)"><img src="/logo-with-name.svg" alt="Balamentum" width="151" height="22"></picture></a>
				<nav aria-label="${t(messages.nav.label)}" class="site-nav">
					<a class="kern-link site-nav__anchor" href="${homePath(locale)}#features">${t(messages.nav.features)}</a>
					<a class="kern-link site-nav__anchor" href="${homePath(locale)}#pricing">${t(messages.nav.pricing)}</a>
					<a class="kern-link site-nav__anchor" href="${homePath(locale)}#faq">${t(messages.nav.faq)}</a>
					<details class="lang-menu">
						<summary class="kern-link"><span class="visually-hidden">${t(messages.meta.language)}: ${LOCALE_INFO[locale].name}</span><span aria-hidden="true">${locale.toUpperCase()}</span></summary>
						<ul class="lang-menu__list">
${languageLinks(locale, pathFor, '\t\t\t\t\t\t\t')}
						</ul>
					</details>
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
				<a class="kern-link" href="${homePath(locale)}${messages.footer.accountDeletionPath}">${t(messages.footer.accountDeletion)}</a>
				<a class="kern-link" href="/datenschutz/" hreflang="de">${t(messages.footer.privacy)}</a>
				<a class="kern-link" href="/nutzungsbedingungen/" hreflang="de">${t(messages.footer.terms)}</a>
				<a class="kern-link" href="/widerruf/" hreflang="de">${t(messages.footer.withdrawal)}</a>
				<a class="kern-link" href="${locale === 'en' ? '/en/mcp/' : '/mcp/'}" hreflang="${locale === 'en' ? 'en' : 'de'}">${t(messages.footer.mcpGuide)}</a>
				<a class="kern-link" href="/vorlagen/" hreflang="de">${t(messages.footer.templates)}</a>
				<a class="kern-link" href="/balance-check/" hreflang="de">Balance-Check</a>
				${locale === 'de' ? '' : `<span class="site-footer__legal-note">${t(messages.footer.legalGermanOnly)}</span>`}
			</div>
			<nav class="container" aria-label="${t(messages.meta.language)}">
				<ul class="site-footer__languages">
${languageLinks(locale, pathFor, '\t\t\t\t\t')}
				</ul>
			</nav>
		</footer>
	</body>
</html>
`);
};

const ctaButton = (label: string): string =>
	`<a class="kern-btn kern-btn--primary cta" href="${LOGIN_PATH}"><span class="kern-label">${t(label)}</span></a>`;

/** Die MCP-Funktion zeigt statt eines Screenshots einen Beispiel-Chat — der Chat läuft im Assistenten, nicht in der App. */
const CHAT_FEATURE = 'mcp';

const chatMock = ({ label, caption, you, assistant, tool, messages }: Messages['features']['chat']): string => {
	const sender: Record<string, string> = { user: you, assistant, tool };
	return `<figure class="chat" aria-label="${t(label)}">
								<figcaption class="chat__caption">${t(caption)}</figcaption>
								<ol class="chat__list">
${messages
	.map((message) =>
		message.sender === 'tool'
			? `									<li class="chat__tool">${t(tool)}: <code>${t(message.text)}</code></li>`
			: `									<li class="chat__msg chat__msg--${message.sender}"><span class="visually-hidden">${t(sender[message.sender])}: </span>${t(message.text)}</li>`,
	)
	.join('\n')}
								</ol>
							</figure>`;
};

const featureRow = (
	context: LandingContext,
	feature: Messages['features']['items'][number],
): string => `						<article class="feature-row">
							<div class="feature-row__text">
								<h3 class="kern-heading-medium">${t(feature.title)}</h3>
								<p class="kern-body">${t(feature.text)}</p>
								<ul class="checklist">
${feature.points.map((point) => `									<li>${t(point)}</li>`).join('\n')}
								</ul>
							</div>
							${
								feature.id === CHAT_FEATURE
									? chatMock(context.messages.features.chat)
									: shotImage(feature.id, fill(context.messages.features.shotAlt, { title: feature.title }), 'shot')
							}
						</article>`;

const featureCard = (feature: Messages['features']['items'][number]): string => `						<article class="kern-card">
							<div class="kern-card__container">
								<header class="kern-card__header"><h4 class="kern-title">${t(feature.title)}</h4></header>
								<section class="kern-card__body">
									<p class="kern-body">${t(feature.text)}</p>
									<ul class="checklist">
${feature.points.map((point) => `										<li>${t(point)}</li>`).join('\n')}
									</ul>
								</section>
							</div>
						</article>`;

const planCard = (context: LandingContext, plan: Plan): string => {
	const { messages, locale, catalog, plans } = context;
	const price = catalog.prices[plan];
	const index = plans.indexOf(plan);
	const features = addedFeatures(catalog, plans, plan);
	const items = [
		...(index === 0 ? [messages.pricing.basics] : []),
		...features.map((feature) =>
			feature === 'ai_assist'
				? `${messages.pricing.features[feature]} (${messages.pricing.aiQuota})`
				: messages.pricing.features[feature],
		),
	];
	const amount = price.monthly === 0 ? messages.pricing.free : formatPrice(price.monthly, locale);
	const perMonth = yearlyMonthlyEquivalent(price.yearly);
	return `				<article class="kern-card plan" data-plan="${plan}">
					<div class="kern-card__container">
						<header class="kern-card__header">
							<h3 class="kern-title">${t(messages.pricing.plans[plan])}</h3>
						</header>
						<section class="kern-card__body">
							<p class="plan__price"><strong>${t(amount)}</strong>${price.monthly === 0 ? '' : ` <span>${t(messages.pricing.perMonth)}</span>`}</p>
							${price.quarterly === 0 ? '' : `<p class="plan__yearly">${t(fill(messages.pricing.quarterly, { price: formatPrice(price.quarterly, locale) }))}</p>`}
							${price.yearly === 0 ? '' : `<p class="plan__yearly">${t(fill(messages.pricing.yearly, { price: formatPrice(price.yearly, locale) }))}</p>`}
							${perMonth === null ? '' : `<p class="plan__yearly">${t(fill(messages.pricing.yearlyPerMonth, { price: formatPrice(perMonth, locale) }))}</p>`}
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
	const { messages: m, locale, plans, shots = new Set<string>() } = context;
	const hasVisual = (feature: Messages['features']['items'][number]): boolean =>
		feature.id === CHAT_FEATURE || shots.has(feature.id);
	const shown = m.features.items.filter(hasVisual);
	const more = m.features.items.filter((feature) => !hasVisual(feature));
	const body = `			<section class="hero">
				<div class="container hero__inner">
					<div class="hero__text">
						<p class="kern-preline">${t(m.hero.eyebrow)}</p>
						<h1 class="kern-heading-display">${t(m.hero.title)}</h1>
						<p class="kern-body kern-body--large">${t(m.hero.lead)}</p>
						<div class="hero__actions">
							${ctaButton(m.hero.cta)}
							<a class="kern-btn kern-btn--secondary" href="${EMAIL_LOGIN_PATH}"><span class="kern-label">${t(m.hero.emailCta)}</span></a>
						</div>
						<p class="kern-body kern-body--small hero__note">${t(m.hero.ctaNote)}</p>
						<p class="kern-body kern-body--small hero__note">${t(m.hero.purpose)}</p>
						<p class="kern-body"><a class="kern-link" href="${APP_PATH}">${t(m.hero.secondary)}</a></p>
					</div>
${shots.has('dashboard') ? `					${shotImage('dashboard', m.hero.screenshotAlt, 'shot hero__shot', false)}\n` : ''}				</div>
			</section>
			<section class="usp" aria-labelledby="usp-title">
				<div class="container">
					<h2 id="usp-title" class="visually-hidden">${t(m.usp.title)}</h2>
					<ul class="usp__list checklist">
${m.usp.items.map((item) => `						<li>${t(item)}</li>`).join('\n')}
					</ul>
				</div>
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
					<div class="features">
${shown.map((feature) => featureRow(context, feature)).join('\n')}
					</div>
${
	more.length > 0
		? `					<h3 class="kern-heading-medium">${t(m.features.moreTitle)}</h3>
					<div class="grid">
${more.map(featureCard).join('\n')}
					</div>`
		: ''
}
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
${m.faq.items.map((item) => `					<details class="kern-accordion"><summary class="kern-accordion__header"><span class="kern-title">${t(item.q)}</span></summary><div class="kern-accordion__body"><p class="kern-body">${t(item.a)}${item.href && item.linkText ? ` <a class="kern-link" href="${t(item.href)}">${t(item.linkText)}</a>` : ''}</p></div></details>`).join('\n')}
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
		head: SIGNED_IN_REDIRECT,
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

/**
 * Konto löschen (Pflichtseite für den Play-Store-Eintrag, ADR 0016): Weg in der App, gelöschte und
 * aufbewahrte Daten, Kontakt für eine Löschung ohne Zugang zur App.
 */
export const renderAccountDeletion = (
	context: PageContext & { operator: Operator; allMessages: Record<Locale, Messages> },
): string => {
	const { messages: m, locale, operator, allMessages } = context;
	const pathFor = (target: Locale): string => `${homePath(target)}${allMessages[target].footer.accountDeletionPath}`;
	const d = m.accountDeletion;
	const body = `			<section class="section">
				<div class="container container--narrow imprint">
					<h1 class="kern-heading-large">${t(d.title)}</h1>
					<p class="kern-body kern-body--large">${t(d.intro)}</p>
					<h2 class="kern-title">${t(d.inAppTitle)}</h2>
					<ol class="kern-body">
${d.steps.map((step) => `						<li>${t(step)}</li>`).join('\n')}
					</ol>
					<p class="kern-body">${t(d.blocked)}</p>
					<h2 class="kern-title">${t(d.deletedTitle)}</h2>
					<p class="kern-body">${t(d.deleted)}</p>
					<h2 class="kern-title">${t(d.keptTitle)}</h2>
					<p class="kern-body">${t(d.kept)}</p>
					<h2 class="kern-title">${t(d.noAccessTitle)}</h2>
					<p class="kern-body">${t(d.noAccess)} <a class="kern-link" href="mailto:${t(operator.email)}">${t(operator.email)}</a></p>
					<p><a class="kern-link" href="${homePath(locale)}">${t(d.back)}</a></p>
				</div>
			</section>`;
	return shell(context, {
		title: `${d.title} – Balamentum`,
		description: d.intro,
		path: pathFor(locale),
		pathFor,
		body,
	});
};

/**
 * Datenschutzerklärung (#1672): nur Deutsch unter der festen URL `/datenschutz/` (Play-Store-Eintrag,
 * PO-Entscheidung), deshalb zeigt `pathFor` für jede Sprache dasselbe Ziel.
 */
export const renderPrivacy = (context: PageContext & { allMessages: Record<Locale, Messages> }): string => {
	const { locale } = context;
	const pathFor = (): string => '/datenschutz/';
	const body = `			<section class="section">
					<div class="container container--narrow imprint">
						<h1 class="kern-heading-large">Datenschutz</h1>
						<p class="kern-body kern-body--large">${t(PRIVACY.intro)}</p>
${PRIVACY.sections
	.flatMap((section) => [
		`					<h2 class="kern-title">${t(section.heading)}</h2>`,
		...section.paragraphs.map((paragraph) => `					<p class="kern-body">${t(paragraph)}</p>`),
		...(section.facts
			? [
					`					<ul class="kern-body">
${(
	[
		['Zweck', section.facts.purpose],
		['Rechtsgrundlage', section.facts.legalBasis],
		['Speicherdauer', section.facts.retention],
		['Empfänger', section.facts.recipients],
	] as [string, string][]
)
	.map(([label, text]) => `						<li><strong>${label}:</strong> ${t(text)}</li>`)
	.join('\n')}
					</ul>`,
				]
			: []),
	])
	.join('\n')}				</div>
			</section>`;
	return shell(context, {
		title: 'Datenschutz – Balamentum',
		description: PRIVACY.description,
		path: pathFor(),
		pathFor,
		body,
	});
};

/**
 * Nutzungsbedingungen (#1891): nur Deutsch unter der festen URL `/nutzungsbedingungen/`, Muster
 * {@link renderPrivacy}. Paketnamen und Preise kommen aus `plans.ts`, nicht aus dem Text.
 */
export const renderTerms = (context: PageContext & { allMessages: Record<Locale, Messages> }): string => {
	const { locale, messages } = context;
	const pathFor = (): string => '/nutzungsbedingungen/';
	const { prices } = getPlansCatalog();
	const priceList = PLAN_VALUES.map((plan) => {
		const price = prices[plan];
		const amount =
			price.monthly === 0
				? messages.pricing.free
				: `${formatPrice(price.monthly, locale)} im Monat, ${formatPrice(price.quarterly, locale)} im Quartal oder ${formatPrice(price.yearly, locale)} im Jahr`;
		return `						<li>${t(`${messages.pricing.plans[plan]}: ${amount}`)}</li>`;
	});
	const body = `			<section class="section">
					<div class="container container--narrow imprint">
						<h1 class="kern-heading-large">Nutzungsbedingungen</h1>
						<p class="kern-body kern-body--large">${t(TERMS.intro)}</p>
${TERMS.sections
	.flatMap((section) => [
		`					<h2 class="kern-title">${t(section.heading)}</h2>`,
		...(section.priceLead
			? [
					`					<p class="kern-body">${t(section.priceLead)}</p>`,
					`					<ul class="kern-body">
${priceList.join('\n')}
					</ul>`,
				]
			: []),
		...section.paragraphs.map((paragraph) => `					<p class="kern-body">${t(paragraph)}</p>`),
	])
	.join('\n')}				</div>
			</section>`;
	return shell(context, {
		title: 'Nutzungsbedingungen – Balamentum',
		description: TERMS.description,
		path: pathFor(),
		pathFor,
		body,
	});
};

/**
 * Widerrufsbelehrung mit Muster-Widerrufsformular (#2307): nur Deutsch unter der festen URL
 * `/widerruf/`, Muster {@link renderTerms}. Die Betreiberangaben stammen aus `OPERATOR`.
 */
export const renderWithdrawal = (context: PageContext & { allMessages: Record<Locale, Messages> }): string => {
	const pathFor = (): string => '/widerruf/';
	const anbieter = `${OPERATOR.name}, ${OPERATOR.address.join(', ')}, E-Mail: ${OPERATOR.email}`;
	const body = `			<section class="section">
					<div class="container container--narrow imprint">
						<h1 class="kern-heading-large">Widerrufsbelehrung</h1>
						<p class="kern-body kern-body--large">${t(WITHDRAWAL.intro)}</p>
${WITHDRAWAL.sections
	.flatMap((section) => [
		`					<h2 class="kern-title">${t(section.heading)}</h2>`,
		...section.paragraphs.map((paragraph) => `					<p class="kern-body">${t(fill(paragraph, { anbieter }))}</p>`),
	])
	.join('\n')}				</div>
			</section>`;
	return shell(context, {
		title: 'Widerrufsbelehrung – Balamentum',
		description: WITHDRAWAL.description,
		path: pathFor(),
		pathFor,
		body,
	});
};

/**
 * MCP-Anleitung (#1978): Deutsch unter `/mcp/`, Englisch unter `/en/mcp/`, `pathFor` der übrigen
 * Sprachen zeigt auf die deutsche Seite (deutsches x-default wie bei der Startseite). Muster
 * {@link renderPrivacy}. Der Claude-Ein-Klick-Link trägt die kodierte Endpunkt-URL
 * (claude.com/docs/connectors/building/directory-vs-custom).
 */
export const renderMcpGuide = (context: PageContext & { allMessages: Record<Locale, Messages> }): string => {
	const { locale, siteUrl } = context;
	const pathFor = (target: Locale): string => (target === 'en' ? '/en/mcp/' : '/mcp/');
	const d = MCP_GUIDE[locale === 'en' ? 'en' : 'de'];
	const endpoint = `${siteUrl}/mcp/v1`;
	const fillEndpoint = (value: string): string => t(fill(value, { endpoint }));
	const claudeLink = `https://claude.ai/customize/connectors?modal=add-custom-connector&amp;connectorName=Balamentum&amp;connectorUrl=${encodeURIComponent(endpoint)}`;
	const body = `			<section class="section">
					<div class="container container--narrow imprint">
						<h1 class="kern-heading-large">${t(d.title)}</h1>
						<p class="kern-body kern-body--large">${fillEndpoint(d.intro)}</p>
${d.sections
	.flatMap((section) => [
		`						<h2 class="kern-title">${t(section.heading)}</h2>`,
		...section.paragraphs.map((paragraph) => `						<p class="kern-body">${fillEndpoint(paragraph)}</p>`),
		...(section.code ? [`						<pre><code>${fillEndpoint(section.code)}</code></pre>`] : []),
		...(section.claudeCta
			? [`						<p><a class="kern-btn kern-btn--primary" href="${claudeLink}" rel="noopener">${t(section.claudeCta)}</a></p>`]
			: []),
		...(section.items
			? [`						<ul class="kern-body">`, ...section.items.map((item) => `							<li>${fillEndpoint(item)}</li>`), `						</ul>`]
			: []),
	])
	.join('\n')}						<p><a class="kern-link" href="${homePath(locale)}">${t(d.back)}</a></p>
					</div>
			</section>`;
	return shell(context, {
		title: `${d.title} – Balamentum`,
		description: d.description,
		path: pathFor(locale),
		pathFor,
		body,
	});
};

/** Vorlagen-Seiten (#1976): nur Deutsch, `pathFor` aller Sprachen zeigt auf die deutsche Seite (Muster {@link renderPrivacy}). */
const templatePage = (
	context: PageContext,
	path: string,
	title: string,
	description: string,
	content: string,
): string =>
	shell(context, {
		title: `${title} – Balamentum`,
		description,
		path,
		pathFor: () => path,
		body: `			<section class="section">
					<div class="container container--narrow imprint">
${content}
					</div>
			</section>`,
	});

const templateCta = (label: string): string =>
	`						<p><a class="kern-btn kern-btn--primary" href="${APP_PATH}"><span class="kern-label">${t(label)}</span></a></p>`;

export const renderTemplateIndex = (context: PageContext): string =>
	templatePage(
		context,
		'/vorlagen/',
		'Vorlagen für Lebensprojekte',
		'Checklisten für Hausbau, Umzug, Steuererklärung und weitere Lebensprojekte in sinnvoller Reihenfolge.',
		`						<h1 class="kern-heading-large">Vorlagen für Lebensprojekte</h1>
						<p class="kern-body kern-body--large">Checklisten in Abhängigkeitsreihenfolge – jeder Schritt steht nach dem, was davor erledigt sein muss.</p>
						<ul class="kern-body">
${TEMPLATES.map(
	(template) =>
		`							<li><a class="kern-link" href="/vorlagen/${template.slug}/">${t(template.title)}</a> – ${t(template.description)} (${template.steps.length} Schritte)</li>`,
).join('\n')}
						</ul>
${templateCta('In der App starten')}`,
	);

export const renderTemplatePage = (context: PageContext & { template: LifeTemplate }): string => {
	const { template } = context;
	const titleOf = (id: string): string => template.steps.find((step) => step.id === id)?.title ?? id;
	const cta = templateCta('In der App starten');
	return templatePage(
		context,
		`/vorlagen/${template.slug}/`,
		`${template.title}-Checkliste`,
		template.description,
		`						<h1 class="kern-heading-large">${t(template.title)}-Checkliste</h1>
						<p class="kern-body kern-body--large">${t(template.description)}</p>
${cta}
						<h2 class="kern-title">Checkliste</h2>
						<ol class="kern-body">
${template.steps
	.map(
		(step) =>
			`							<li>${t(step.title)}${step.after.length ? `<br><small>nach: ${step.after.map((id) => t(titleOf(id))).join(', ')}</small>` : ''}</li>`,
	)
	.join('\n')}
						</ol>
${cta}
						<p><a class="kern-link" href="/vorlagen/">Alle Vorlagen</a></p>`,
	);
};

/** robots.txt; die Sitemap wird nur mit bekannter Basis-URL verlinkt (sie braucht absolute URLs). */
export const renderRobots = (siteUrl: string): string =>
	`User-agent: *\nDisallow: /app/\nDisallow: /api/\nDisallow: /auth/\n${siteUrl ? `Sitemap: ${siteUrl}/sitemap.xml\n` : ''}`;

/**
 * Digital Asset Links für die Android-App (ADR 0016); ohne Package-ID oder Fingerprint `null`.
 * `fingerprints`: SHA-256-Fingerprints, getrennt durch Komma oder Leerraum.
 */
export const renderAssetLinks = (packageId: string, fingerprints: string): string | null => {
	const certs = fingerprints.split(/[\s,]+/).filter(Boolean);
	if (!packageId.trim() || certs.length === 0) return null;
	const statement = {
		relation: ['delegate_permission/common.handle_all_urls'],
		target: { namespace: 'android_app', package_name: packageId.trim(), sha256_cert_fingerprints: certs },
	};
	return `${JSON.stringify([statement], null, 2)}\n`;
};

export const renderSitemap = (siteUrl: string, paths: readonly string[]): string =>
	`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths
		.map((path) => `\t<url><loc>${siteUrl}${path}</loc></url>`)
		.join('\n')}\n</urlset>\n`;

/** Balance-Check (#1979): nur Deutsch, `pathFor` aller Sprachen zeigt auf die deutsche Seite (Muster {@link templatePage}). */
export const renderAssessment = (context: PageContext & { allMessages: Record<Locale, Messages> }): string =>
	templatePage(
		context,
		'/balance-check/',
		'Balance-Check',
		'Fünf Fragen ohne Konto: eine erste Einordnung, wohin deine Aufmerksamkeit zuletzt geflossen ist.',
		`						<h1 class="kern-heading-large">Balance-Check</h1>
						<p class="kern-body kern-body--large">Fünf Fragen, keine Anmeldung. Denk an die letzten Wochen und antworte aus dem Bauch.</p>
						<form data-form>
${SEED_PILLARS.map(
	(pillar, index) => `							<fieldset class="scale">
								<legend class="kern-body">${t(pillar.name)}: ${t(QUESTIONS[index])}</legend>
${SCALE_LABELS.map(
	(label, value) =>
		`								<label class="scale__option"><input type="radio" name="q${index}" value="${value}"><span>${t(label)}</span></label>`,
).join('\n')}
							</fieldset>`,
).join('\n')}
						</form>
						<p class="kern-body kern-body--small" data-progress aria-live="polite">0 von ${SEED_PILLARS.length} beantwortet</p>
						<section data-result hidden class="result" aria-labelledby="result-title">
							<h2 class="kern-title" id="result-title">Dein Ergebnis</h2>
							<p class="kern-body" data-summary aria-live="polite"></p>
							<ul class="result__list" data-list>
${SEED_PILLARS.map(
	(pillar) => `								<li data-row data-name="${t(pillar.name)}">
									<span>${t(pillar.name)}: <span data-percent></span></span>
									<span class="bar" aria-hidden="true"><span class="bar__fill" data-fill></span></span>
								</li>`,
).join('\n')}
							</ul>
							<p><a class="kern-btn kern-btn--primary" href="${APP_PATH}"><span class="kern-label">Kostenlos starten</span></a></p>
							<p><button type="button" class="kern-btn kern-btn--secondary" data-share><span class="kern-label">Ergebnis teilen</span></button></p>
							<p class="kern-body kern-body--small" data-status role="status"></p>
							<p class="kern-body kern-body--small">Wird nirgends gespeichert. Der Link enthält deine Antworten – teile ihn nur, wenn du magst.</p>
						</section>
						<script>${CLIENT_SCRIPT}</script>`,
	);

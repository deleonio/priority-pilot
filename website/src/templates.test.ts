import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PLAN_VALUES, getPlansCatalog } from '../../server/src/logics/plans.ts';
import de from './i18n/de.json';
import * as renderModule from './render.ts';
import { APP_PATH, renderLanding, renderRobots } from './render.ts';
import type { Locale, Messages, PageContext } from './render.ts';
import { TEMPLATES } from './templates.ts';

type Context = PageContext & { allMessages: Record<Locale, Messages> };
type Template = (typeof TEMPLATES)[number];

// #1976: die Renderer existieren noch nicht (roter Spec-Zustand) — deshalb optional getippt.
const { renderTemplateIndex, renderTemplatePage } = renderModule as unknown as {
	renderTemplateIndex?: (context: Context) => string;
	renderTemplatePage?: (context: Context & { template: Template }) => string;
};

const allMessages = { de } as unknown as Record<Locale, Messages>;
const context: Context = { locale: 'de', messages: de, siteUrl: 'https://example.org', allMessages };
const index = () => renderTemplateIndex?.(context) ?? '';
const page = (template: Template) => renderTemplatePage?.({ ...context, template }) ?? '';
const strip = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const hasLink = (html: string, href: string) => html.includes(`href="${href}"`);

describe('Vorlagen-Daten (#1976 AK1, Vertrag: docs/spec/issue-1976.md)', () => {
	it('mindestens sechs Vorlagen mit eindeutigen Slugs und je mindestens fünf Schritten', () => {
		expect(TEMPLATES.length).toBeGreaterThanOrEqual(6);
		expect(new Set(TEMPLATES.map((template) => template.slug)).size).toBe(TEMPLATES.length);
		for (const template of TEMPLATES) {
			expect(template.steps.length, template.slug).toBeGreaterThanOrEqual(5);
		}
	});

	it('after zeigt auf Vorgänger derselben Vorlage, die davor stehen (topologisch, keine Zyklen)', () => {
		for (const template of TEMPLATES) {
			const seen = new Set<string>();
			const ids = template.steps.map((step) => step.id);
			expect(new Set(ids).size, `${template.slug}: Schritt-ids eindeutig`).toBe(ids.length);
			for (const step of template.steps) {
				for (const predecessor of step.after) {
					expect(ids, `${template.slug}/${step.id}: unbekannter Vorgänger ${predecessor}`).toContain(predecessor);
					expect(seen.has(predecessor), `${template.slug}/${step.id} steht vor ${predecessor}`).toBe(true);
				}
				seen.add(step.id);
			}
		}
	});
});

describe('Vorlagen-Seiten (#1976 AK3–AK5)', () => {
	it('Renderer existieren als Export in render.ts', () => {
		expect(renderTemplateIndex, 'renderTemplateIndex fehlt').toBeTypeOf('function');
		expect(renderTemplatePage, 'renderTemplatePage fehlt').toBeTypeOf('function');
	});

	it('jede Seite hat title, Meta-Description, Canonical und genau eine h1', () => {
		const pages: [string, string][] = [
			['/vorlagen/', index()],
			...TEMPLATES.map((template): [string, string] => [`/vorlagen/${template.slug}/`, page(template)]),
		];
		for (const [path, html] of pages) {
			expect(html.match(/<title>([^<]*)<\/title>/)?.[1]?.trim(), path).toBeTruthy();
			expect(html.match(/<meta name="description" content="([^"]*)"/)?.[1]?.trim(), path).toBeTruthy();
			expect(html, path).toContain(`<link rel="canonical" href="https://example.org${path}"`);
			expect(html.match(/<h1[\s>]/g)?.length, path).toBe(1);
		}
	});

	it('Schritte stehen als ol > li in Datenreihenfolge, Vorgänger sichtbar mit Namen', () => {
		for (const template of TEMPLATES) {
			const list = page(template).match(/<ol[\s>][\s\S]*?<\/ol>/)?.[0] ?? '';
			const items = [...list.matchAll(/<li[\s>][\s\S]*?<\/li>/g)].map((match) => strip(match[0]));
			expect(items.length, template.slug).toBe(template.steps.length);
			template.steps.forEach((step, position) => {
				const text = items[position] ?? '';
				expect(text, `${template.slug}/${step.id}`).toContain(step.title);
				for (const predecessor of step.after) {
					const title = template.steps.find((candidate) => candidate.id === predecessor)?.title ?? '';
					expect(text, `${template.slug}/${step.id}: nach`).toMatch(new RegExp(`nach:.*${title}`, 's'));
				}
			});
		}
	});

	it('Seiten verlinken die App, die Übersicht alle Vorlagen, die Startseite die Übersicht', () => {
		const indexHtml = index();
		expect(hasLink(indexHtml, APP_PATH), 'App-Link in der Übersicht').toBe(true);
		for (const template of TEMPLATES) {
			expect(hasLink(indexHtml, `/vorlagen/${template.slug}/`), template.slug).toBe(true);
			expect(hasLink(page(template), APP_PATH), template.slug).toBe(true);
		}
		const home = renderLanding({
			locale: 'de',
			messages: de,
			siteUrl: 'https://example.org',
			catalog: getPlansCatalog(),
			plans: PLAN_VALUES,
		});
		expect(hasLink(home, '/vorlagen/'), 'Startseite/Footer-Link fehlt').toBe(true);
	});
});

describe('Vorlagen im Build (#1976 AK2)', () => {
	it('robots.txt sperrt /vorlagen/ nicht', () => {
		expect(renderRobots('https://example.org')).not.toContain('Disallow: /vorlagen');
	});

	it('baut Übersicht und je Vorlage vor und trägt alle Pfade in die Sitemap ein', { timeout: 120_000 }, () => {
		const websiteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
		execFileSync('pnpm', ['build'], {
			cwd: websiteRoot,
			env: { ...process.env, SITE_URL: 'https://example.org' },
			stdio: 'pipe',
		});
		const sitemap = readFileSync(join(websiteRoot, 'dist', 'sitemap.xml'), 'utf8');
		const paths = ['/vorlagen/', ...TEMPLATES.map((template) => `/vorlagen/${template.slug}/`)];
		for (const path of paths) {
			expect(existsSync(join(websiteRoot, 'dist', path, 'index.html')), `dist${path}index.html fehlt`).toBe(true);
			expect(sitemap, path).toContain(`<loc>https://example.org${path}</loc>`);
		}
	});
});

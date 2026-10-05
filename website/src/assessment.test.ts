import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PLAN_VALUES, getPlansCatalog } from '../../server/src/logics/plans.ts';
import { SEED_PILLARS } from '../../server/src/models/pillarData.ts';
import de from './i18n/de.json';
import * as renderModule from './render.ts';
import { renderLanding } from './render.ts';
import type { Locale, Messages, PageContext } from './render.ts';

type Context = PageContext & { allMessages: Record<Locale, Messages> };

// #1979: Modul und Renderer existieren noch nicht (roter Spec-Zustand) — deshalb dynamisch/optional getippt.
type Assessment = {
	evaluateAssessment?: (answers: readonly number[]) => { shares: number[]; focus: number | null };
	encodeAnswers?: (answers: readonly number[]) => string;
	decodeAnswers?: (raw: string | null) => number[] | null;
};
const ASSESSMENT_MODULE = './assessment.ts';
const assessment: Assessment = await import(/* @vite-ignore */ ASSESSMENT_MODULE).catch(() => ({}));
const { renderAssessment } = renderModule as unknown as { renderAssessment?: (context: Context) => string };

const allMessages = { de } as unknown as Record<Locale, Messages>;
const context: Context = { locale: 'de', messages: de, siteUrl: 'https://example.org', allMessages };
const page = () => renderAssessment?.(context) ?? '';
const evaluate = (answers: number[]) => assessment.evaluateAssessment?.(answers);

describe('Auswertung (#1979 AK3, Vertrag: docs/spec/issue-1979.md)', () => {
	it('liefert Anteile je Säule, Summe 100 und benennt den Schwerpunkt', () => {
		expect(evaluate([4, 3, 2, 1, 0])).toEqual({ shares: [40, 30, 20, 10, 0], focus: 0 });
		expect(evaluate([0, 0, 4, 0, 0])).toEqual({ shares: [0, 0, 100, 0, 0], focus: 2 });
	});

	it('rundet auf Summe 100 und ist deterministisch', () => {
		const first = evaluate([1, 1, 1, 0, 0]);
		expect(first?.shares.reduce((sum, share) => sum + share, 0)).toBe(100);
		expect(evaluate([1, 1, 1, 0, 0])).toEqual(first);
	});

	it('Gleichstand: erster höchster Wert ist der Schwerpunkt', () => {
		expect(evaluate([2, 2, 2, 2, 2])).toEqual({ shares: [20, 20, 20, 20, 20], focus: 0 });
	});

	it('alle Antworten 0: definierte Einordnung ohne Schwerpunkt, kein NaN', () => {
		expect(evaluate([0, 0, 0, 0, 0])).toEqual({ shares: [0, 0, 0, 0, 0], focus: null });
	});
});

describe('URL-Kodierung (#1979 AK4)', () => {
	it('kodiert fünf Ziffern und dekodiert sie wieder', () => {
		expect(assessment.encodeAnswers?.([4, 0, 1, 2, 3])).toBe('40123');
		expect(assessment.decodeAnswers?.('40123')).toEqual([4, 0, 1, 2, 3]);
	});

	it.each(['50123', '4012', '401234', '4a123', '-1012', '', null])('verwirft ungültigen Wert %j', (raw) => {
		expect(assessment.decodeAnswers).toBeTypeOf('function');
		expect(assessment.decodeAnswers?.(raw)).toBeNull();
	});
});

describe('renderAssessment (#1979 AK2, AK5, AK6)', () => {
	it('zeigt fünf Fragen mit den Säulennamen und je fünf Skalenstufen', () => {
		const html = page();
		expect(html.match(/<h1[ >]/g)).toHaveLength(1);
		expect(html.match(/type="radio"/g)).toHaveLength(25);
		for (const [index] of SEED_PILLARS.entries()) {
			for (let value = 0; value <= 4; value++) {
				expect(html, `q${index}=${value}`).toMatch(
					new RegExp(`name="q${index}"[^>]*value="${value}"|value="${value}"[^>]*name="q${index}"`),
				);
			}
		}
		for (const pillar of SEED_PILLARS) expect(html).toContain(pillar.name);
	});

	it('verlinkt die App, ohne Angemeldete weiterzuleiten', () => {
		expect(page()).toContain('href="/app/"');
		expect(page()).not.toContain('bm_signed_in');
	});

	it('deutsche Startseite verlinkt die Seite', () => {
		const html = renderLanding({
			locale: 'de',
			messages: de,
			siteUrl: 'https://example.org',
			catalog: getPlansCatalog(),
			plans: PLAN_VALUES,
		});
		expect(html).toContain('href="/balance-check/"');
	});

	it('baut die Seite vor, trägt sie in die Sitemap ein und erzeugt keine Sprachvariante', { timeout: 120_000 }, () => {
		const websiteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
		execFileSync('pnpm', ['build'], {
			cwd: websiteRoot,
			env: { ...process.env, SITE_URL: 'https://example.org' },
			stdio: 'pipe',
		});
		const sitemap = readFileSync(join(websiteRoot, 'dist', 'sitemap.xml'), 'utf8');
		expect(existsSync(join(websiteRoot, 'dist', 'balance-check', 'index.html'))).toBe(true);
		expect(sitemap).toContain('<loc>https://example.org/balance-check/</loc>');
		expect(sitemap).not.toMatch(/\/[a-z]{2}\/balance-check\//);
	});
});

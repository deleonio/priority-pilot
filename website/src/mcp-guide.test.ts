import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import de from './i18n/de.json';
import en from './i18n/en.json';
import * as renderModule from './render.ts';
import type { Locale, Messages, PageContext } from './render.ts';

// #1978: `renderMcpGuide` existiert als Export noch nicht (roter Spec-Zustand) — deshalb optional getippt.
const renderMcpGuide = (
	renderModule as unknown as {
		renderMcpGuide?: (context: PageContext & { allMessages: Record<Locale, Messages> }) => string;
	}
).renderMcpGuide;

// Nur DE+EN werden getestet; der Record-Typ verlangt alle Locales, deshalb der Cast.
const allMessages = { de, en } as unknown as Record<Locale, Messages>;

const mcpGuide = (locale: Locale, siteUrl = 'https://example.org') =>
	renderMcpGuide?.({ locale, messages: allMessages[locale], siteUrl, allMessages });

describe('renderMcpGuide (#1978, Vertrag: docs/spec/issue-1978.md)', () => {
	it('existiert als Export in render.ts', () => {
		expect(renderMcpGuide, 'renderMcpGuide existiert noch nicht (Export in render.ts)').toBeTypeOf('function');
	});

	it('deutsche Seite enthält Endpunkt, Token-Schritt, Paketgrenzen und beide Beispiel-Prompts', () => {
		const html = mcpGuide('de');
		expect(html).toContain('/mcp/v1');
		expect(html).toMatch(/API-?Tokens?/);
		expect(html).toContain('Plus');
		expect(html).toContain('Pro');
		expect(html).toContain('Frag deine Balance');
		expect(html).toContain('Plane meine Woche nach meiner Balance');
		expect(html).toContain('ChatGPT');
	});

	it('Claude-Deep-Link bettet die kodierte Endpunkt-URL ein (DE und EN)', () => {
		for (const html of [mcpGuide('de'), mcpGuide('en')]) {
			expect(html).toContain('claude.ai');
			expect(html).toContain(encodeURIComponent('https://example.org/mcp/v1'));
		}
	});

	it('englische Seite (/en/mcp/) enthält Endpunkt, Token-Schritt und beide Anbieter', () => {
		const html = mcpGuide('en');
		expect(html).toContain('/mcp/v1');
		expect(html).toMatch(/API-?Tokens?/);
		expect(html).toContain('Plus');
		expect(html).toContain('Pro');
		expect(html).toContain('ChatGPT');
		expect(html).toContain('claude.ai');
	});

	it('verlinkt die jeweils andere Sprache über hreflang-Alternates (/mcp/ und /en/mcp/)', () => {
		expect(mcpGuide('de')).toContain('https://example.org/en/mcp/');
		expect(mcpGuide('en')).toContain('https://example.org/mcp/');
	});
});

describe('MCP-Seiten im Build (#1978, AK5)', () => {
	it('Build schreibt /mcp/ und /en/mcp/ und nimmt beide in die Sitemap auf', { timeout: 180_000 }, () => {
		const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
		execFileSync('pnpm', ['run', 'build'], { cwd: root, stdio: 'pipe' });
		const deHtml = join(root, 'dist', 'mcp', 'index.html');
		const enHtml = join(root, 'dist', 'en', 'mcp', 'index.html');
		expect(existsSync(deHtml), 'dist/mcp/index.html fehlt (build.ts schreibt die deutsche MCP-Seite nicht)').toBe(true);
		expect(existsSync(enHtml), 'dist/en/mcp/index.html fehlt (build.ts schreibt die englische MCP-Seite nicht)').toBe(
			true,
		);
		expect(readFileSync(deHtml, 'utf8')).toContain('/mcp/v1');
		const sitemap = readFileSync(join(root, 'dist', 'sitemap.xml'), 'utf8');
		expect(sitemap).toMatch(/<loc>[^<]*\/mcp\/<\/loc>/);
		expect(sitemap).toMatch(/<loc>[^<]*\/en\/mcp\/<\/loc>/);
	});
});

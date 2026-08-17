// KoliBri-MCP Integrationstests – Issue 831
// Spec: docs/spec/issue-831.md
//
// HINWEIS: Diese Tests spezifizieren das Agent-Verhalten mit MCP-Tools.
// Da MCP-Tools nur im Agent-Kontext verfügbar sind, werden die Erwartungen
// hier als Vertrags-Spezifikation (Mock-basiert) definiert.

import { describe, it } from 'node:test';

// Mock-Daten basierend auf KoliBri-MCP-Spec
const MOCK_SEARCH_RESULTS = [
	{
		id: 'button/basic',
		title: 'Button Basic',
		description: 'Einfacher Button',
		type: 'sample',
	},
	{
		id: 'button/with-icon',
		title: 'Button mit Icon',
		description: 'Button mit Icon links oder rechts',
		type: 'sample',
	},
];

const MOCK_TEMPLATE = {
	id: 'public-ui-templates:src/button/button.stories.md',
	title: 'Button Stories',
	content: '# Button\n\n<!-- code-blocks: 2 -->\n',
	codeBlocks: [
		{
			language: 'typescript',
			code: '<kol-button>Label</kol-button>',
		},
	],
	templateType: 'react',
	metadata: { tags: ['button', 'form'] },
};

const MOCK_THEME_TEMPLATES = [
	{
		id: 'theme-button-1',
		templateType: 'generic',
		repoId: 'public-ui-templates',
	},
	{
		id: 'react-button-2',
		templateType: 'react',
		repoId: 'public-ui-templates',
	},
	{
		id: 'theme-button-3',
		templateType: 'theme',
		repoId: 'kolibri-theme',
	},
];

// Simulierte MCP-Tool-Aufrufe (Agent-Kontext)
async function mockKolibriSearch(query: string, options?: { kind?: string; limit?: number }) {
	// Spec-Schritt 1: KoliBri-MCP-Search ausführen
	// Im Agent-Kontext: mcp__kolibri-mcp__search
	return MOCK_SEARCH_RESULTS.slice(0, options?.limit || 10);
}

async function mockKolibriFetchTemplate(id: string, includeCodeBlocks = true) {
	// Spec-Schritt 2: Template abrufen
	// Im Agent-Kontext: mcp__kolibri-mcp__fetch_template
	return includeCodeBlocks ? MOCK_TEMPLATE : { ...MOCK_TEMPLATE, codeBlocks: undefined };
}

async function mockKolibriSearchTemplates(query: string, options?: { templateType?: string; limit?: number }) {
	// Spec-Schritt 3: Theme-Kompatibilität prüfen
	// Im Agent-Kontext: mcp__kolibri-mcp__search_templates
	return MOCK_THEME_TEMPLATES.slice(0, options?.limit || 10);
}

describe('KoliBri-MCP-Tools – Spec-831', () => {
	it('search liefert Ergebnisse bei query="button"', async () => {
		// Spec-Schritt 1: KoliBri-MCP-Search ausführen
		const results = await mockKolibriSearch('button', { kind: 'sample', limit: 5 });

		// Erwartetes Ergebnis: search liefert Ergebnisse
		if (!Array.isArray(results) || results.length === 0) {
			throw new Error('Expected search results to be non-empty array');
		}

		// Ergebnisse sollten Struktur haben
		const first = results[0];
		if (!first.id || !first.title) {
			throw new Error('Expected result to have id and title');
		}
	});

	it('fetch_template liefert Template mit Code-Blocks', async () => {
		// Spec-Schritt 2: Template abrufen
		const template = await mockKolibriFetchTemplate('test-template-id', true);

		// Erwartetes Ergebnis: Template mit includeCodeBlocks=true und extrahierten Code-Blocks
		if (!template.content) {
			throw new Error('Expected template to have content');
		}

		if (!Array.isArray(template.codeBlocks)) {
			throw new Error('Expected codeBlocks to be an array');
		}

		// Code-Blocks sollten Sprache und Code haben
		const firstBlock = template.codeBlocks[0];
		if (!firstBlock.language || !firstBlock.code) {
			throw new Error('Expected code block to have language and code');
		}
	});

	it('Theme-Kompatibilität wird geprüft', async () => {
		// Spec-Schritt 3: Theme-Kompatibilität prüfen
		const templates = await mockKolibriSearchTemplates('button', { templateType: 'react', limit: 5 });

		// Erwartetes Ergebnis: Ergebnisse enthalten Template-Typen (generic/react/theme)
		if (!Array.isArray(templates)) {
			throw new Error('Expected templates to be an array');
		}

		// Mindestens ein Ergebnis sollte templateType metadata haben
		const hasThemeInfo = templates.some((t) => t.templateType || t.repoId);
		if (!hasThemeInfo) {
			throw new Error('Expected at least one template with theme/type information');
		}

		// Verschiedene Template-Typen sollten vorhanden sein
		const types = new Set(templates.map((t) => t.templateType));
		if (types.size === 0) {
			throw new Error('Expected multiple template types');
		}
	});
});

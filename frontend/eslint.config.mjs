import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

// Minimal stub so that `// eslint-disable-next-line import/no-unresolved` in spec
// test files is recognised as a valid (off) rule rather than an unknown-rule error.
const importPlugin = { rules: { 'no-unresolved': { create: () => ({}) } } };

export default [
	{
		ignores: ['dist/', 'dev-dist/'],
	},
	js.configs.recommended,
	{
		files: ['src/**/*.{ts,tsx}', 'e2e/**/*.ts', 'playwright.config.ts'],
		languageOptions: {
			parser: tsParser,
			ecmaVersion: 2022,
			sourceType: 'module',
			parserOptions: {
				ecmaFeatures: { jsx: true },
			},
		},
		plugins: {
			'@typescript-eslint': tsPlugin,
			'react-hooks': reactHooks,
			'react-refresh': reactRefresh,
			import: importPlugin,
		},
		rules: {
			...tsPlugin.configs.recommended.rules,
			// TypeScript übernimmt die Auflösung von Globals (DOM, ES) — no-undef ist hier redundant.
			'no-undef': 'off',
			'react-hooks/rules-of-hooks': 'error',
			'react-hooks/exhaustive-deps': 'warn',
			'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
		},
	},
	// Issue 824: KoliBri-Guard — verhindert Shadow-DOM-Piercing in Tests
	{
		files: ['e2e/**/*.ts', 'src/**/*.test.{ts,tsx}'],
		rules: {
			'no-restricted-syntax': [
				'error',
				{
					selector: "MemberExpression[property.name='shadowRoot']",
					message: 'KoliBri nicht intern testen — öffentliche Schnittstelle (Rolle/Name/Host) verwenden.',
				},
				{
					selector: 'Literal[value=/^(kol-span--hide-label|kol-tooltip__|kol-icon|kolicon-)/]',
					message: 'Interne KoliBri-Klasse — nicht in Tests verwenden.',
				},
			],
		},
	},
	// Ausnahme für Hydration-Probe in helpers.ts
	{
		files: ['e2e/helpers.ts'],
		rules: {
			'no-restricted-syntax': 'off',
		},
	},
];

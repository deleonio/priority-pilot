import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
	{
		ignores: ['dist/', 'src/generated/', 'src/api.d.ts'],
	},
	js.configs.recommended,
	{
		files: ['src/**/*.ts'],
		languageOptions: {
			parser: tsParser,
			ecmaVersion: 2022,
			sourceType: 'module',
			globals: {
				console: 'readonly',
				process: 'readonly',
				fetch: 'readonly',
				Response: 'readonly',
				AbortController: 'readonly',
				setTimeout: 'readonly',
				clearTimeout: 'readonly',
			},
		},
		plugins: {
			'@typescript-eslint': tsPlugin,
		},
		rules: {
			...tsPlugin.configs.recommended.rules,
			// Aus: typescript-eslint empfiehlt dies explizit — das Core-`no-undef` kennt TS-Globals
			// wie `Express.User`/`NodeJS.Timeout` nicht und meldet dafür False Positives. `tsc` prüft
			// undefinierte Bezeichner bereits zuverlässig.
			'no-undef': 'off',
			// Bewusst ungenutzte Bindungen erlauben: `_`-Präfix (Konvention) sowie der
			// Rest-Sibling-Auslass-Idiom `const { weg: _omit, ...rest } = obj` (Feld weglassen).
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					caughtErrorsIgnorePattern: '^_',
					ignoreRestSiblings: true,
				},
			],
		},
	},
	{
		// Test files: allow unused node:test helper imports imported for convenience/forward-compat
		files: ['src/**/*.test.ts'],
		rules: {
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_|^(before|after|beforeEach|afterEach|describe|it|test)$',
					caughtErrorsIgnorePattern: '^_',
					ignoreRestSiblings: true,
				},
			],
		},
	},
];

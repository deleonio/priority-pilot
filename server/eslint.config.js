import tseslint from '@typescript-eslint/eslint-plugin';
import parser from '@typescript-eslint/parser';

export default [
	{
		files: ['**/*.ts'],
		languageOptions: {
			parser,
			parserOptions: {
				project: './tsconfig.json',
				tsconfigRootDir: new URL('.', import.meta.url),
			},
		},
		plugins: {
			'@typescript-eslint': tseslint,
		},
		rules: {},
	},
];

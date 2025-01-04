module.exports = {
	parser: '@typescript-eslint/parser',
	parserOptions: {
		project: './tsconfig.json', // Stelle sicher, dass der Pfad korrekt ist
		tsconfigRootDir: __dirname, // Basisverzeichnis
	},
	extends: [
		'eslint:recommended',
		'plugin:@typescript-eslint/recommended',
		'plugin:@typescript-eslint/recommended-requiring-type-checking',
	],
	rules: {
		// Deine benutzerdefinierten ESLint-Regeln
	},
};

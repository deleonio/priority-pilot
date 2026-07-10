import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Rote Spec-Tests für #165 — Lefthook + Knip als pre-commit-Hooks einrichten.
//
// Vertrag: Die roten Tests prüfen die Konfigurationsdateien und package.json-Einträge,
// die nach der Implementierung vorhanden sein müssen. Die Tests werden grün, sobald
// lefthook.yml, knip-Abhängigkeit und prepare-Skript im Root existieren.
// Keinen Produktivcode schreiben — nur Vertragsbestimmung.

// Root: zwei Verzeichnisse über server/src/
const ROOT = resolve(fileURLToPath(import.meta.url), '../../..');

describe('Issue #165 — Lefthook + Knip Dev-Tooling-Konfiguration', () => {
	describe('AK 1 + AK 5 — Root package.json: devDependencies und Skripte', () => {
		it('hat @evilmartians/lefthook in devDependencies', () => {
			const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8'));
			assert.ok(
				pkg.devDependencies?.['@evilmartians/lefthook'],
				'@evilmartians/lefthook muss in root devDependencies stehen',
			);
		});

		it('hat knip in devDependencies', () => {
			const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8'));
			assert.ok(pkg.devDependencies?.['knip'], 'knip muss in root devDependencies stehen');
		});

		it('hat ein "knip"-Skript in package.json', () => {
			const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8'));
			assert.ok(pkg.scripts?.['knip'], 'root package.json muss ein "knip"-Skript besitzen');
		});

		it('hat ein "prepare"-Skript, das lefthook install aufruft', () => {
			const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8'));
			assert.ok(pkg.scripts?.['prepare'], 'root package.json muss ein "prepare"-Skript besitzen');
			assert.match(pkg.scripts['prepare'], /lefthook install/, '"prepare"-Skript muss "lefthook install" enthalten');
		});
	});

	describe('AK 2 + AK 3 + AK 4 — lefthook.yml pre-commit-Hooks', () => {
		const lefthookPath = resolve(ROOT, 'lefthook.yml');

		it('lefthook.yml existiert im Repository-Root', () => {
			assert.ok(existsSync(lefthookPath), 'lefthook.yml muss im Repository-Root vorhanden sein');
		});

		it('lefthook.yml enthält einen pre-commit-Block', () => {
			assert.ok(existsSync(lefthookPath), 'lefthook.yml fehlt');
			const content = readFileSync(lefthookPath, 'utf-8');
			assert.match(content, /pre-commit/, 'lefthook.yml muss einen pre-commit-Block definieren');
		});

		it('lefthook.yml pre-commit führt Prettier aus (pnpm format oder pnpm exec prettier)', () => {
			assert.ok(existsSync(lefthookPath), 'lefthook.yml fehlt');
			const content = readFileSync(lefthookPath, 'utf-8');
			// Issue #417: format-Schritt wurde von pnpm format (--check) auf pnpm exec prettier --write umgestellt.
			assert.match(content, /prettier/, 'lefthook.yml pre-commit muss einen Prettier-Schritt enthalten');
		});

		it('lefthook.yml pre-commit führt Lint aus (pnpm lint)', () => {
			assert.ok(existsSync(lefthookPath), 'lefthook.yml fehlt');
			const content = readFileSync(lefthookPath, 'utf-8');
			assert.match(content, /pnpm lint/, 'lefthook.yml pre-commit muss einen pnpm-lint-Schritt enthalten');
		});

		it('lefthook.yml pre-commit führt Knip aus (pnpm knip)', () => {
			assert.ok(existsSync(lefthookPath), 'lefthook.yml fehlt');
			const content = readFileSync(lefthookPath, 'utf-8');
			assert.match(content, /pnpm knip/, 'lefthook.yml pre-commit muss einen pnpm-knip-Schritt enthalten');
		});
	});
});

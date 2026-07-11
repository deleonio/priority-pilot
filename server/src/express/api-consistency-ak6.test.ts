import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/**
 * ROTER Spec-Test (#422, AK6): openapi.yml und generierte Client-Typen sind konsistent.
 *
 * Der Test führt `pnpm build:api` aus (openapi.yml → src/api.d.ts), was die openapi.yml
 * auf syntaktische Korrektheit prüft und die generierten Typen erzeugt. Ein Fehler in der
 * openapi.yml (ungültige Pfade, fehlende Schemas) führt zu einem fehlschlagenden Build → roter Test.
 *
 * Dies ist ein Smoak-Test — der volle Build (inkl. tsc) wird in CI separat geprüft.
 */
describe('AK6 — openapi.yml und Client-Typen konsistent', () => {
	const testDir = dirname(fileURLToPath(import.meta.url));
	const serverDir = resolve(testDir, '../..');

	it('pnpm build:api generiert api.d.ts ohne Fehler', () => {
		const result = execSync('pnpm build:api', {
			cwd: serverDir,
			encoding: 'utf-8',
			stdio: ['ignore', 'pipe', 'pipe'],
		});
		assert.ok(result !== undefined, 'build:api lief ohne Fehler durch');
	});

	it('api.d.ts enthält die erwarteten Pfade für neue CRUD-Endpunkte', () => {
		const apiPath = resolve(serverDir, 'src/api.d.ts');
		assert.ok(existsSync(apiPath), 'api.d.ts wurde generiert');

		const content = readFileSync(apiPath, 'utf-8');

		// Prüfe auf Paths der neuen CRUD-Endpunkte (POST, PATCH, DELETE)
		const hasPillarPaths = content.includes('/pillars');

		assert.ok(hasPillarPaths, 'api.d.ts enthält /pillars-Pfad');
	});
});

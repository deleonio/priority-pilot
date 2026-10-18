import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * Spiegel-Test: `.sh`-Skripte bleiben mit der macOS-Default-bash 3.2 lauffähig (#2731).
 * `mapfile`/`readarray` sind bash 4+ — Arrays werden stattdessen per while-read gefüllt
 * (Vorzeige-Muster: pr-doc-facts.sh). Läuft über `pnpm test:scripts`.
 */

const dir = fileURLToPath(new URL('.', import.meta.url));

describe('bash-compat: keine bash-4-Array-Intrinsics in Skripten', () => {
	const scripts = readdirSync(dir).filter((f) => f.endsWith('.sh'));

	it('findet .sh-Dateien im scripts-Verzeichnis', () => {
		assert.ok(scripts.length > 0);
	});

	for (const name of scripts) {
		it(`${name} nutzt weder mapfile noch readarray`, () => {
			const content = readFileSync(join(dir, name), 'utf8');
			assert.ok(!/\bmapfile\b/.test(content), `${name} enthält "mapfile" — while-read-Muster nutzen (pr-doc-facts.sh)`);
			assert.ok(
				!/\breadarray\b/.test(content),
				`${name} enthält "readarray" — while-read-Muster nutzen (pr-doc-facts.sh)`,
			);
		});
	}
});

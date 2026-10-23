import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Spiegel gegen stillen Rueckfall (#2559, docs/spec/issue-2559.md): Mobil-E2E-Specs pruefen
 * die verbindliche Groesse 375x812 (.ai-knowledge/project.md, Mobile-First) ueber die geteilte
 * Konstante `MOBILE` aus `frontend/e2e/helpers.ts`. Die alte Hoehe 667 liess alles zwischen
 * 667 und 812 px ungeprueft und faellt in keinem einzelnen Spec auf.
 */

const E2E_DIR = join(import.meta.dirname, '..', '..', 'frontend', 'e2e');

const listFiles = (dir: string): string[] =>
	readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
		e.isDirectory() ? listFiles(join(dir, e.name)) : [join(dir, e.name)],
	);

const specs = listFiles(E2E_DIR).filter((f) => f.endsWith('.spec.ts'));

/** "667" als eigenstaendige Zahl; die PLZ 81667 (issue-1061) bleibt ausgenommen. */
const HEIGHT_667 = /(?<!\d)667(?!\d)/;

describe('E2E-Mobil-Viewport (#2559)', () => {
	it('AK1: keine Spec enthaelt die Viewport-Hoehe 667', () => {
		const hits = specs.flatMap((file) =>
			readFileSync(file, 'utf8')
				.split('\n')
				.flatMap((line, i) => (HEIGHT_667.test(line) ? [`${file.slice(E2E_DIR.length + 1)}:${i + 1}`] : [])),
		);
		assert.deepEqual(hits, []);
	});

	it('AK2: helpers.ts exportiert MOBILE mit 375x812', () => {
		const helpers = readFileSync(join(E2E_DIR, 'helpers.ts'), 'utf8');
		assert.match(helpers, /export const MOBILE\s*=\s*\{\s*width:\s*375,\s*height:\s*812\s*\}\s*as const/);
	});

	it('AK2: keine Spec definiert MOBILE lokal neu', () => {
		const dupes = specs.filter((file) => /^\s*(export\s+)?const MOBILE\b/m.test(readFileSync(file, 'utf8')));
		assert.deepEqual(
			dupes.map((f) => f.slice(E2E_DIR.length + 1)),
			[],
		);
	});
});

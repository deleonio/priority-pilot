import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lookupPrice } from './cost-from-transcript.ts';

const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const modelIds: Record<string, string> = readJson('.github/model-ids.json');
const piAliases: Record<string, Record<string, string>> = readJson('.github/pi/model-aliases.json');

describe('.github/model-ids.json — einzige Alias→ID-Tabelle', () => {
	it('deckt genau die Allowlist fable | opus | sonnet | haiku ab', () => {
		assert.deepEqual(Object.keys(modelIds).sort(), ['fable', 'haiku', 'opus', 'sonnet']);
	});

	it('pi-Tabelle (Provider claude) spiegelt dieselben IDs', () => {
		for (const [alias, id] of Object.entries(modelIds)) {
			assert.equal(piAliases.claude[alias], `anthropic/${id}`, `pi-Alias '${alias}' weicht ab`);
		}
	});

	it('jede ID hat einen Preis mit dem längsten passenden Präfix', () => {
		for (const id of Object.values(modelIds)) {
			assert.ok(lookupPrice(id), `kein Preis für ${id}`);
		}
		assert.deepEqual(lookupPrice(modelIds.opus)?.slice(1), [4.0, 20.0]);
	});
});

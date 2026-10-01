import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Roter Spec-Test für #2048 (Spec docs/spec/issue-2048.md, AK4/AK5) — die Cancel-Route antwortet
 * künftig auch 409; openapi.yml muss das dokumentieren. String-Matching im YAML-Rohformat
 * (Muster `openapi-billing-subscriptions.test.ts`). Rot, bis die Impl-Phase den Vertrag ergänzt.
 * KEIN Produktivcode.
 */
describe('#2048 OpenAPI: Cancel-Route dokumentiert 409', () => {
	const yml = readFileSync(join(import.meta.dirname, '..', '..', '..', 'openapi.yml'), 'utf-8');

	const cancelBlock = (): string => {
		const start = yml.search(/\n {2}\/billing\/subscriptions\/cancel:\s*\n/);
		if (start === -1) return '';
		const nextPath = yml.indexOf('\n  /', start + 1);
		return yml.slice(start, nextPath === -1 ? undefined : nextPath);
	};

	it('POST /billing/subscriptions/cancel definiert 409 (bereits gekündigt)', () => {
		const block = cancelBlock();
		assert.ok(block.length > 0, '/billing/subscriptions/cancel muss im Vertrag existieren');
		assert.match(block, /'409':/, 'Die Cancel-Route muss 409 (bereits gekündigt) definieren');
	});
});

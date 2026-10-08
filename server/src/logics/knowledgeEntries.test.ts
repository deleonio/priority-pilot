import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { selectRelevantKnowledge } from './knowledgeEntries.js';

/**
 * Rote Spec-Tests für #1936 AK3 (Spec docs/spec/issue-1936.md): deterministischer Relevanzfilter
 * `selectRelevantKnowledge(entries, context)`. Rot, bis `knowledgeEntries.ts` existiert.
 */

const entry = (id: number, text: string) => ({ id, text });
const ids = (list: { id: number }[]) => list.map((e) => e.id);
const ctx = (over: Partial<Parameters<typeof selectRelevantKnowledge>[1]> = {}) => ({
	title: 'Etwas anderes',
	pillars: [{ id: 1, name: 'Körper' }],
	...over,
});

describe('selectRelevantKnowledge (#1936 AK3)', () => {
	it('trifft über gemeinsames 5-Zeichen-Präfix („trainiere“/„Training“)', () => {
		const e = entry(1, 'Ich trainiere dienstags im Verein.');
		assert.deepEqual(ids(selectRelevantKnowledge([e], ctx({ title: 'Training planen' }))), [1]);
	});

	it('trifft über Beschreibung und Kontext', () => {
		const e = entry(1, 'Mein Hund braucht Auslauf.');
		assert.deepEqual(ids(selectRelevantKnowledge([e], ctx({ description: 'Hundeschule buchen' }))), [1]);
		assert.deepEqual(ids(selectRelevantKnowledge([e], ctx({ context: 'Hundespaziergang' }))), [1]);
	});

	it('trifft über einen Säulennamen („Säule Sinn“/Säule „Sinn“, kurze Wörter nur bei Gleichheit)', () => {
		const e = entry(1, 'Säule Sinn: Ich engagiere mich ehrenamtlich.');
		assert.deepEqual(ids(selectRelevantKnowledge([e], ctx({ pillars: [{ id: 3, name: 'Sinn' }] }))), [1]);
	});

	it('liefert Einträge ohne Wortbezug nicht', () => {
		const e = entry(1, 'Ich esse gern Pasta.');
		assert.deepEqual(selectRelevantKnowledge([e], ctx({ title: 'Steuererklärung abgeben' })), []);
	});

	it('ignoriert Wörter unter 4 Zeichen und Stoppwörter', () => {
		const e = entry(1, 'Ich und der die das mit');
		assert.deepEqual(selectRelevantKnowledge([e], ctx({ title: 'Ich und der Rest, die das mit' })), []);
	});

	it('liefert höchstens 10 Einträge', () => {
		const entries = Array.from({ length: 15 }, (_, i) => entry(i + 1, `Training Nummer ${i}`));
		assert.equal(selectRelevantKnowledge(entries, ctx({ title: 'Training' })).length, 10);
	});
});

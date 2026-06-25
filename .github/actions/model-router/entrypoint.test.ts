import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
// ROTE Tests (#153) — der CI-Entrypoint des Modell-Routers (Smoke + Aufbereitung der Ausgaben).
//
// Der Entrypoint ist die Brücke zwischen Sonnet-Klassifikation und dem deterministischen
// `resolveModel`-Vertrag. Getestet wird der reine, deterministische Teil: die Effort-Kopplung und
// die Aufbereitung der Step-Outputs / des Loggings — inklusive des AK3-Smoke-Tests (leeres/
// ungültiges Token → Default-Modell, kein Throw). Der LLM-Klassifikationsschritt selbst sowie der
// CI-Aufrufpfad (Step-Output `model`) werden per Workflow-Lauf an einem Scratch-Issue verifiziert.
import { buildRouterOutputs, EFFORT_IDS } from './entrypoint.js';

describe('entrypoint: Effort-Kopplung (#153, M2/3)', () => {
	it('koppelt haiku→low, sonnet→medium, opus→high', () => {
		assert.equal(EFFORT_IDS.haiku, 'low');
		assert.equal(EFFORT_IDS.sonnet, 'medium');
		assert.equal(EFFORT_IDS.opus, 'high');
	});
});

describe('buildRouterOutputs: gültiges Token (AK1–AK3, AK4-Logging)', () => {
	it('opus → model/token/effort gesetzt, kein Fallback im Log', () => {
		const { outputs, summary, notice } = buildRouterOutputs('opus');
		assert.equal(outputs.model, 'claude-opus-4-8');
		assert.equal(outputs.token, 'opus');
		assert.equal(outputs.effort, 'high');
		assert.ok(summary.includes('claude-opus-4-8'), 'Job-Summary nennt das Modell');
		assert.ok(notice.includes('fallback=false'), 'notice trägt das Fallback-Flag');
	});

	it('haiku → effort low; Job-Summary trägt Modell, Effort und Begründung (AK4)', () => {
		const { summary } = buildRouterOutputs('haiku');
		assert.ok(summary.includes('claude-haiku-4-5'), 'Modell in der Summary');
		assert.ok(summary.includes('low'), 'Effort in der Summary');
		assert.ok(summary.includes('Begründung'), 'Begründung in der Summary');
	});

	it('normalisiert umgebenden Whitespace/Newline + Groß-/Kleinschreibung (kein Fallback)', () => {
		const { outputs, notice } = buildRouterOutputs('  OPUS\n');
		assert.equal(outputs.model, 'claude-opus-4-8');
		assert.equal(outputs.effort, 'high');
		assert.ok(notice.includes('fallback=false'));
	});
});

describe('buildRouterOutputs: AK3-Smoke — leeres/ungültiges Token → Default, kein Throw', () => {
	const ungueltig: (string | null | undefined)[] = ['', '   ', 'gpt', 'sonnet weil mittel', null, undefined];
	for (const raw of ungueltig) {
		it(`fällt für ${JSON.stringify(raw)} definiert auf claude-sonnet-4-6 (effort=medium, Exit 0)`, () => {
			let out!: ReturnType<typeof buildRouterOutputs>;
			assert.doesNotThrow(() => {
				out = buildRouterOutputs(raw);
			}, 'der Entrypoint darf nicht hart abbrechen (set -e-fest)');
			assert.equal(out.outputs.model, 'claude-sonnet-4-6');
			assert.equal(out.outputs.token, 'sonnet');
			assert.equal(out.outputs.effort, 'medium');
			assert.ok(out.notice.includes('fallback=true'), 'Fallback wird im Log markiert');
			assert.ok(out.summary.includes('Fallback'), 'Job-Summary markiert den Fallback');
		});
	}
});

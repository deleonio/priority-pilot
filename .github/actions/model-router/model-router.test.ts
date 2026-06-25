import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
// ROTE Spec-Tests (#149) — der Modell-Router-Baustein.
//
// Kontext: Die KI-Workflows verdrahten heute `--model claude-opus-4-8` fest. Dieser Sub-Task baut
// den Router, der die Komplexität einer Aufgabe einschätzt und das Ausführungsmodell wählt. Die
// LLM-Klassifikation selbst (ein Sonnet-Prompt, der EIN Token `haiku|sonnet|opus` liefert) wird per
// Workflow-Lauf an einem Scratch-Issue verifiziert (AK1–AK3, AK5 — Sichtprüfung der Job-Summary).
//
// Der hier eingeklagte, deterministische Vertrag ist die **Validierung + das Mapping + der
// Fallback** des Router-Outputs auf eine volle Modell-ID. Genau dieser Teil ist testbar und wird
// als testbares Modul ausgelagert (Issue-Vorschlag). Es wird KEIN Produktivcode geschrieben; die
// Tests werden grün, sobald `model-router.ts` die hier eingeklagte Schnittstelle bereitstellt.
import { resolveModel, ALLOWED_TOKENS, MODEL_IDS, DEFAULT_MODEL } from './model-router.js';

// Die vollen Modell-IDs aus dem Ticket — die Allowlist mappt genau hierauf.
const HAIKU = 'claude-haiku-4-5';
const SONNET = 'claude-sonnet-4-6';
const OPUS = 'claude-opus-4-8';

describe('model-router: Konstanten / Vertrag', () => {
	it('Allowlist ist exakt {haiku, sonnet, opus}', () => {
		assert.deepEqual([...ALLOWED_TOKENS].sort(), ['haiku', 'opus', 'sonnet']);
	});

	it('mappt jedes erlaubte Token auf die im Ticket fixierte volle Modell-ID', () => {
		assert.equal(MODEL_IDS.haiku, HAIKU);
		assert.equal(MODEL_IDS.sonnet, SONNET);
		assert.equal(MODEL_IDS.opus, OPUS);
	});

	it('Default-Modell ist das ausgewogene Sonnet (Fallback-Ziel)', () => {
		assert.equal(DEFAULT_MODEL, SONNET);
	});
});

describe('resolveModel: gültige Tokens (Mapping)', () => {
	// ── AK1: triviale Aufgabe → Token `haiku` → claude-haiku-4-5 ────────────────────────────────
	it('AK1: Token "haiku" mappt ohne Fallback auf claude-haiku-4-5', () => {
		const decision = resolveModel('haiku');
		assert.equal(decision.model, HAIKU);
		assert.equal(decision.token, 'haiku');
		assert.equal(decision.fallback, false);
	});

	// ── AK2: Standard-Aufgabe → Token `sonnet` → claude-sonnet-4-6 ──────────────────────────────
	it('AK2: Token "sonnet" mappt ohne Fallback auf claude-sonnet-4-6', () => {
		const decision = resolveModel('sonnet');
		assert.equal(decision.model, SONNET);
		assert.equal(decision.token, 'sonnet');
		assert.equal(decision.fallback, false);
	});

	// ── AK3: komplexe Aufgabe → Token `opus` → claude-opus-4-8 ──────────────────────────────────
	it('AK3: Token "opus" mappt ohne Fallback auf claude-opus-4-8', () => {
		const decision = resolveModel('opus');
		assert.equal(decision.model, OPUS);
		assert.equal(decision.token, 'opus');
		assert.equal(decision.fallback, false);
	});

	// Robustheit: ein LLM-Token kommt mit umgebendem Whitespace/Newline und variabler Groß-/
	// Kleinschreibung — das ist gültiges Soll-Verhalten, kein Fallback.
	it('normalisiert umgebenden Whitespace und Newline (kein Fallback)', () => {
		const decision = resolveModel('  opus\n');
		assert.equal(decision.model, OPUS);
		assert.equal(decision.token, 'opus');
		assert.equal(decision.fallback, false);
	});

	it('ist gegenüber Groß-/Kleinschreibung tolerant (kein Fallback)', () => {
		const decision = resolveModel('HAIKU');
		assert.equal(decision.model, HAIKU);
		assert.equal(decision.token, 'haiku');
		assert.equal(decision.fallback, false);
	});
});

describe('resolveModel: AK4 — Fallback bei leerem/ungültigem Output', () => {
	// Jeder ungültige Output muss exit-fest (kein Throw) auf das Default-Modell zurückfallen.
	const ungueltig: { label: string; input: string | null | undefined }[] = [
		{ label: 'leerer String', input: '' },
		{ label: 'nur Whitespace', input: '   ' },
		{ label: 'unbekanntes Modell', input: 'gpt' },
		{ label: 'null', input: null },
		{ label: 'undefined', input: undefined },
	];

	for (const { label, input } of ungueltig) {
		it(`AK4: ${label} → Default-Modell, fallback=true, kein Throw`, () => {
			let decision!: ReturnType<typeof resolveModel>;
			assert.doesNotThrow(() => {
				decision = resolveModel(input);
			}, 'Validierung darf nicht hart abbrechen (set -e-fest, Exit 0)');
			assert.equal(decision.model, DEFAULT_MODEL);
			assert.equal(decision.token, 'sonnet');
			assert.equal(decision.fallback, true);
		});
	}

	it('AK4: ein gültiges, aber von Müll umgebenes Token gilt NICHT als gültig (Fallback)', () => {
		// Der Router soll GENAU ein Token liefern; mehrdeutiger Output ist ungültig → Default.
		const decision = resolveModel('sonnet weil mittelschwer');
		assert.equal(decision.model, DEFAULT_MODEL);
		assert.equal(decision.fallback, true);
	});
});

describe('resolveModel: AK5 — Logging-Felder für die Job-Summary', () => {
	// Die Entscheidung muss die für `$GITHUB_STEP_SUMMARY` / `::notice::` nötigen Felder tragen:
	// gewähltes Modell + Begründung + Fallback-Flag.
	it('liefert bei gültigem Token eine nicht-leere Begründung und fallback=false', () => {
		const decision = resolveModel('opus');
		assert.equal(typeof decision.reason, 'string');
		assert.ok(decision.reason.length > 0, 'Begründung darf nicht leer sein');
		assert.equal(decision.fallback, false);
	});

	it('liefert bei Fallback eine Begründung und fallback=true', () => {
		const decision = resolveModel('gpt');
		assert.equal(typeof decision.reason, 'string');
		assert.ok(decision.reason.length > 0, 'auch der Fallback wird begründet');
		assert.equal(decision.fallback, true);
	});
});

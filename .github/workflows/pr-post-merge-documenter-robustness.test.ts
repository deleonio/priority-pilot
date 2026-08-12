import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Statische Robustheits-Tests für den PR-Post-Merge-Documenter (jetzt LLM-Phase 6).
//
// Der Workflow wurde von einem 12-PR-Batch mit deterministischer grep/jq-Pipeline auf EINEN PR
// pro Lauf mit Claude-Analyse umgebaut. Damit entfallen die Batch-/Search-/pr_count-spezifischen
// Fehlerquellen (alte /search/issues-GET-only-, pr_count-Guarding-, Search-Guarding-Tests).
// Dieser Test sichert die REGRESSION-GUARDS, deren Ursache auch im LLM-Betrieb greift:
//   - Fehler-Strenge bleibt (#519: set -euo pipefail; keine ungesicherten 2>/dev/null gh-Calls)
//   - grep -vE fail-tolerant (#532)
//   - --add-label als EIN komma-separierter String (kein Array, keine Mehrfach-Args)
//   - Phase-0 legt alle Labels an, die Claude setzen kann (Runde-3-Fix)
//   - ai:documented (Idempotät) ist nicht mit release:* in einem --add-label gekoppelt
// sowie die NEUE LLM-Verkabelung (setup-claude, claude -p, memory-load, Phasen-Modell) und die
// Label-Post-Assertion (Erfolgskriterium = ai:documented am PR).
//
// Dedup: Trigger-Struktur, concurrency, dispatch-Input, App-Token, Ticket-Memory-Drain liegen in
// pr-post-merge-trigger.test.ts; tools-tier in permission-tiers.test.ts.

const HERE = dirname(fileURLToPath(import.meta.url));
const WF = readFileSync(join(HERE, 'pr-post-merge-documentation.yml'), 'utf8');

// Kommentarzeilen raus — Inline-Kommentare im Bash duerfen nicht als Code durchgehen.
const code = WF.split('\n')
	.filter((l) => !/^\s*#/.test(l))
	.join('\n');

// Extrahiert den gesamten GHA-Step, der `needle` enthaelt (Step-Grenze = Zeile "^      - ").
// Im Workflow enthaelt kein run-Block eine Zeile mit genau 6 Leerzeichen + "-" (Bash steht tiefer),
// daher ist "\n      - " ein zuverlaessiger Step-Begrenzer.
const stepContaining = (needle: string): string => {
	const idx = code.search(new RegExp(needle));
	assert.ok(idx !== -1, `"${needle}" nicht im Workflow gefunden`);
	const startMarker = code.lastIndexOf('\n      - ', idx);
	const endMarker = code.indexOf('\n      - ', idx + 1);
	return code.slice(startMarker + 1, endMarker === -1 ? undefined : endMarker);
};

describe('Issue #519 — Fehler-Strenge bleibt (Ursachen-Behebung, kein symptomatisches set -e weg)', () => {
	// AK2 aus #519: die Fehler-Strenge (`set -euo pipefail`) bleibt erhalten; stattdessen werden
	// fehlerfähige Kommandos abgesichert. Der Documenter behält `set -euo pipefail` im Phase-0-Step.
	it('der Workflow enthält set -euo pipefail (Fehler-Strenge nicht symptomatisch entfernt)', () => {
		assert.match(
			code,
			/set\s+-euo\s+pipefail/,
			'Workflow enthält nicht mehr `set -euo pipefail` — vermutlich symptomatisch entfernt. ' +
				'#519/AK2 verlangt Ursachen-Behebung (Absicherung fehlerfähiger Kommandos), nicht Beseitigung der Strenge.',
		);
	});

	// Ein per `2>/dev/null` gedämpfter gh-Aufruf, dessen Exit-Code trotzdem aktiv bleibt, ist die
	// stille exit-1-Falle aus #519. Kein gh-Aufruf mit `2>/dev/null` darf ohne `||`/`if` dastehen.
	it('kein gh-Aufruf mit 2>/dev/null ohne ||-Fallback oder if-Bewachung', () => {
		const bare = code
			.split('\n')
			.filter((l) => /\bgh\s+/.test(l) && /2>\/dev\/null/.test(l))
			.filter((l) => !/(\|\||\bif\s+)/.test(l));
		assert.equal(
			bare.length,
			0,
			'gh-Aufrufe mit `2>/dev/null`, die weder `||`-Fallback noch `if`-Bewachung haben: stderr ist ' +
				'gedämpft, der Exit-Code propagiert aber via pipefail → stiller exit 1. Betroffen: ' +
				JSON.stringify(bare),
		);
	});
});

describe('Issue #532 — grep -vE bleibt fail-tolerant (kein exit 1 wenn der Filter alles entfernt)', () => {
	// Root-Cause #532: `$(… | grep -vE …)` endet mit Exit 1, wenn der Filter alle Pfade entfernt
	// (z. B. reine Test-/Spec-PR); unter `set -euo pipefail` bricht das den Job. Jede solche
	// Zuweisung braucht einen `||`-Fallback. Im LLM-Documenter gibt es kein main_file-grep -vE mehr
	// (Claude klassifiziert) — der Guard bleibt als Netz, falls jemand es wieder einführt.
	it('keine `$(… grep -vE …)`-Zuweisung ohne ||-Fallback', () => {
		const unguarded = code
			.split('\n')
			.filter((l) => /=\s*\$\([^)]*grep\s+-vE/.test(l))
			.filter((l) => !/\|\|/.test(l));
		assert.equal(
			unguarded.length,
			0,
			'`$(… | grep -vE …)`-Zuweisung ohne `||`-Fallback: filtert grep -vE alle Pfade heraus, endet mit ' +
				'Exit 1 → bricht unter `set -euo pipefail` den Job. Erwartet: `|| true`. Betroffen: ' +
				JSON.stringify(unguarded),
		);
	});
});

describe('PR-Dokumentation: --add-label akzeptiert nur EINEN komma-separierten String (kein Array, keine Mehrfach-Args)', () => {
	// `--add-label` nimmt genau EINEN Wert (ggf. komma-separiert). Array-Expandierung oder zwei
	// separate Args → "accepts at most 1 arg(s)" → Crash, ai:documented geht verloren. Claude wird
	// im Prompt angewiesen, je EINEN Wert zu übergeben; der Guard sichert das statisch ab.
	it('kein --add-label mit Array-Expandierung "${...[@]}" (erzeugt mehrere Args → Crash)', () => {
		const arrayExpand = code.split('\n').filter((l) => /--add-label\s+["']?\$\{[^}]+\[@\]\}/.test(l));
		assert.equal(
			arrayExpand.length,
			0,
			'`--add-label "${…[@]}"` gefunden: Array-Expandierung erzeugt mehrere positionale Argumente → ' +
				'"accepts at most 1 arg(s)". Erwartet: EINEN komma-separierten Wert. Betroffen: ' +
				JSON.stringify(arrayExpand),
		);
	});

	it('kein --add-label mit zwei separaten gequoteten Label-Args (gleicher Crash)', () => {
		const twoArgs = code.split('\n').filter((l) => /--add-label\s+"[^"]+"\s+"[^"]+"/.test(l));
		assert.equal(
			twoArgs.length,
			0,
			'`--add-label "a" "b"` (zwei separate Args) gefunden → Crash. Erwartet: `--add-label "a,b"`. ' +
				'Betroffen: ' +
				JSON.stringify(twoArgs),
		);
	});
});

describe('PR-Dokumentation: Phase 0 stellt alle benötigten Labels sicher (kein "X not found")', () => {
	// gh pr edit --add-label bricht hart ab, wenn ein Label fehlt. Phase 0 legt idempotent alle
	// Labels an, die Claude setzen kann (Runde-3-Fix). Der Guard prüft das über die create_label-
	// Aufrufe (jedes Label gequotet).
	it('Phase 0 legt alle fünf release:*-Labels an', () => {
		const required = [
			'release:feature',
			'release:fix',
			'release:improvement',
			'release:breaking-change',
			'release:engineering',
		];
		const missing = required.filter((label) => !code.includes(`"${label}"`));
		assert.equal(
			missing.length,
			0,
			'Phase 0 legt nicht alle release:*-Labels an — gh pr edit --add-label crasht mit "X not found", ' +
				'wenn ein Label fehlt. Fehlend: ' +
				JSON.stringify(missing),
		);
	});

	it('Phase 0 legt auch ai:documented und release:ignore an', () => {
		// ai:documented = Idempotät-Invariante; release:ignore = Bot-Kurzbehandlung (im Claude-Prompt).
		for (const label of ['ai:documented', 'release:ignore']) {
			assert.ok(
				code.includes(`"${label}"`),
				`Phase 0 legt '${label}' nicht an — wird im Workflow gesetzt, aber nicht sichergestellt.`,
			);
		}
	});
});

describe('PR-Dokumentation: ai:documented (Idempotät) ist nicht mit release:* gekoppelt', () => {
	// Symptom: ein kombiniertes `--add-label "ai:documented,release:fix"` crasht als GANZES, falls
	// release:fix fehlt — dann geht ai:documented verloren und der PR taucht wieder auf. Phase 0
	// legt zwar alle Labels an (oben gesichert), aber die Entkopplung bleibt der robustere Zustand:
	// ai:documented in einem eigenen --add-label, release:* separat/best-effort.
	it('ai:documented und release:* werden NICHT gemeinsam in einem --add-label komma-join gesetzt', () => {
		const coupled = code
			.split('\n')
			.filter((l) => /--add-label\s+"[^"]*ai:documented[^"]*,/.test(l))
			.filter((l) => /release:/.test(l));
		assert.equal(
			coupled.length,
			0,
			'`--add-label "...,ai:documented,...,release:..."` gefunden: ai:documented ist mit dem release:*-' +
				'Label gekoppelt. Erwartet: ai:documented separat, release:* best-effort. Betroffen: ' +
				JSON.stringify(coupled),
		);
	});
});

describe('LLM-Phase verkabelt — Documenter nutzt Claude Code (wie 01–05)', () => {
	it('der Workflow ruft ./.github/actions/setup-claude auf', () => {
		assert.match(
			code,
			/uses:\s*\.\/\.github\/actions\/setup-claude/,
			'Workflow nutzt setup-claude nicht — der Documenter ist keine LLM-Phase (Abweichung von 01–05).',
		);
	});

	it('der Workflow ruft Claude via invoke-cmd auf (claude -p)', () => {
		assert.match(
			code,
			/steps\.setup\.outputs\.invoke-cmd/,
			'Workflow referenziert invoke-cmd nicht — der Claude-Aufruf fehlt (Documenter läuft nicht als LLM).',
		);
	});

	it('setup-claude wird mit memory-load: true aufgerufen (liest Ticket-Memory der Vor-Phasen)', () => {
		const setupStep = stepContaining('uses: ./.github/actions/setup-claude');
		assert.match(
			setupStep,
			/memory-load:\s*'true'/,
			'setup-claude ohne memory-load: true — der Documenter sieht das ticketspezifische Gedächtnis ' +
				'aus Spec/Implement/Review nicht.',
		);
	});

	it('der Workflow reicht vars.CLAUDE_MODEL_DOCUMENTATION als Phasen-Modell durch', () => {
		assert.match(
			code,
			/model:\s*\$\{\{\s*vars\.CLAUDE_MODEL_DOCUMENTATION\b[^}]*\}\}/,
			'Workflow reicht vars.CLAUDE_MODEL_DOCUMENTATION nicht an setup-claude durch — die Phase läuft ' +
				'still mit dem settings.json-Default statt dem Documenter-Modell.',
		);
	});
});

describe('Label-Post-Assertion — Erfolgskriterium ist ai:documented am PR', () => {
	// Der Documenter hat (anders als Review/Fixup) kein Verdict-Label als Output, sondern pflegt
	// ai:documented selbst. Die Assertion nach Claudes Lauf stellt sicher, dass ai:documented
	// tatsächlich am PR hängt — fehlt es, hat Claude nicht gearbeitet → harter Fehler (kein still grün).
	it('die Assertion prüft ai:documented am PR und scheitert hart, wenn es fehlt', () => {
		const assertion = stepContaining('Label-Post-Assertion');
		assert.match(assertion, /ai:documented/, 'Label-Post-Assertion referenziert ai:documented nicht.');
		assert.match(
			assertion,
			/exit 1/,
			'Label-Post-Assertion bricht nicht hart (exit 1) ab, wenn ai:documented fehlt — ein stiller ' +
				'Erfolg maskiert, dass Claude die Idempotät-Invariante nicht gesetzt hat.',
		);
	});
});

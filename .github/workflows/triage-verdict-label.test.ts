import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtempSync, writeFileSync, readFileSync as readFn } from 'node:fs';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Issue #538 — Der Analyser-Job (Triage) setzt `ai:spec-ready` auch bei gelber (🟡)
// bzw. roter (🔴) Umsetzbarkeit. Laut .ai-knowledge/ticket-triage.md (Schritt 5) darf
// `ai:spec-ready` NUR bei grün (🟢) gesetzt werden.
//
// Root Cause: Im Step „Label-Post-Assertion" (01-claude-triage.yml) bestimmt die Bash-
// Variable `final`, ob `ai:spec-ready` addiert oder entfernt wird. Die if/elif/else-Leiter
// macht die Phase aber von `HAS_AK` (Akzeptanzkriterien im Body) abhängig — nicht vom
// `verdict`. Da der Triage-Agent immer AKs in den Body schreibt (`HAS_AK=true`), wird für
// JEDES verdict (auch „analyzed" / leer) `final="spec-ready"` → fail-open statt fail-safe.
//
// Verdict-Vokabular (Prompt 01-claude-triage.yml Z. 104–106):
//   VERDICT: spec-ready  (🟢 grün)
//   VERDICT: analyzed    (🟡 gelb ODER 🔴 rot — beide landen auf demselben Wert)
//
// Testebene: der ECHTE Bash-`run`-Block wird mit gestubptem `gh` ausgeführt (keine YAML-
// Heuristik). Für jedes Szenario wird das VERDICT in ein Log geschrieben und der Body über
// den `gh issue view`-Stub eingespeist; aufgezeichnet werden alle `--add-label`/`--remove-
// label`-Operationen. So sind AK1–AK4 echte, ausführbare Verträge (node:test via tsx, ci.yml
// Z. 103: ".github/workflows/"*.test.ts).

const HERE = dirname(fileURLToPath(import.meta.url));
const YML = readFileSync(join(HERE, '01-claude-triage.yml'), 'utf8');

// ── Label-Post-Assertion-Step und dessen run-Block extrahieren ──────────────────────────
const STEP = YML.match(/name:\s*Label-Post-Assertion[\s\S]*?(?=\n {6}- name:)/)?.[0] ?? '';
assert.ok(STEP, 'Label-Post-Assertion-Step nicht gefunden — Struktur geändert?');

// run: |  → danach folgt der 10-Leerzeichen-eingerückte Bash-Block. Genau 10 Spaces
// abziehen, relativen Einzug (12/14) aber erhalten → gültiges Bash.
const RUN_BLOCK = (STEP.match(/run:\s*\|\n([\s\S]*)/)?.[1] ?? '').replace(/^ {10}/gm, '');
assert.ok(RUN_BLOCK.includes('final='), 'run-Block enthält keine final=-Logik');

// ── Stub-`gh`: view→Body aus Env, edit→Label-Ops ins Log, label create→noop ────────────
const STUB_GH = `#!/usr/bin/env bash
log="\${GH_STUB_LOG:?}"
if [ "\${1:-}" = "issue" ] && [ "\${2:-}" = "view" ]; then
  printf '%s' "\${STUB_BODY:-}"
  exit 0
fi
if [ "\${1:-}" = "label" ] && [ "\${2:-}" = "create" ]; then
  exit 0
fi
if [ "\${1:-}" = "issue" ] && [ "\${2:-}" = "edit" ]; then
  mode=""
  shift 2
  for a in "$@"; do
    case "$a" in
      --add-label) mode="add" ;;
      --remove-label) mode="remove" ;;
      ai:analyzed|ai:spec-ready|ai:ready) [ -n "$mode" ] && printf '%s:%s\\n' "$mode" "$a" >> "$log" ;;
    esac
  done
  exit 0
fi
exit 0
`;

const BODY_WITH_AK = [
	'<!-- KI-ANALYSE:START stand=2026-08-10 -->',
	'**Ampel: 🟡 gelb**',
	'',
	'## Akzeptanzkriterien',
	'- AK1: bei gelb kein spec-ready',
	'- AK2: bei rot kein spec-ready',
	'<!-- KI-ANALYSE:END -->',
].join('\n');

const BODY_NO_AK = ['<!-- KI-ANALYSE:START stand=2026-08-10 -->', '**Ampel: 🟡 gelb**', '<!-- KI-ANALYSE:END -->'].join(
	'\n',
);

type Opts = { verdict: '' | 'spec-ready' | 'analyzed'; hasAk: boolean; rawVerdict?: string };

// Führt den echten run-Block aus und liefert die aufgezeichneten Label-Ops
// (z.B. ["remove:ai:analyzed","add:ai:analyzed","remove:ai:spec-ready","remove:ai:ready"]).
const runTriage = (opts: Opts): string[] => {
	const dir = mkdtempSync(join(tmpdir(), 'triage-538-'));
	const log = join(dir, 'ops.log');
	writeFileSync(log, '');
	writeFileSync(join(dir, 'gh'), STUB_GH, { mode: 0o755 });

	const verdictFile = join(dir, 'claude-output.log');
	writeFileSync(verdictFile, opts.rawVerdict ?? (opts.verdict ? `VERDICT: ${opts.verdict}\n` : ''));

	// Log-Pfad im Block auf Temp-Datei umbiegen (Logik unangetastet).
	const script = RUN_BLOCK.replace('/tmp/claude-output.log', verdictFile);

	execFileSync('bash', ['-c', script], {
		env: {
			...process.env,
			PATH: `${dir}:${process.env.PATH}`,
			ISSUE: '538',
			GITHUB_REPOSITORY: 'acme/priority-pilot',
			GH_STUB_LOG: log,
			STUB_BODY: opts.hasAk ? BODY_WITH_AK : BODY_NO_AK,
		},
	});

	return readFn(log, 'utf8').split('\n').filter(Boolean);
};

const has = (ops: string[], op: string): boolean => ops.includes(op);

// ── AK1 — Bei 🟡 (gelb) wird NICHT ai:spec-ready gesetzt ───────────────────────────────
describe('AK1 — 🟡 gelb (verdict=analyzed): kein ai:spec-ready', () => {
	it('gesetzt wird ai:analyzed, NICHT addiert ai:spec-ready, stattdessen wird ai:spec-ready entfernt', () => {
		const ops = runTriage({ verdict: 'analyzed', hasAk: true });
		assert.ok(has(ops, 'add:ai:analyzed'), 'ai:analyzed muss immer gesetzt werden');
		assert.ok(
			!has(ops, 'add:ai:spec-ready'),
			'Bei 🟡 darf ai:spec-ready NICHT addiert werden (Bug: HAS_AK-promoviert aktuell trotzdem)',
		);
		assert.ok(has(ops, 'remove:ai:spec-ready'), 'Bei 🟡 muss ai:spec-ready entfernt werden (fail-safe)');
	});
});

// ── AK2 — Bei 🔴 (rot) wird NICHT ai:spec-ready gesetzt ────────────────────────────────
// 🔴 wird vom Agenten genauso wie 🟡 als VERDICT: analyzed ausgegeben (Prompt Z. 106).
describe('AK2 — 🔴 rot (verdict=analyzed): kein ai:spec-ready', () => {
	it('auch bei rot kein ai:spec-ready; ai:analyzed bleibt die einzige Phasenmarkierung', () => {
		const ops = runTriage({ verdict: 'analyzed', hasAk: true });
		assert.ok(has(ops, 'add:ai:analyzed'));
		assert.ok(!has(ops, 'add:ai:spec-ready'), 'Bei 🔴 darf ai:spec-ready NICHT addiert werden');
		assert.ok(has(ops, 'remove:ai:spec-ready'), 'Bei 🔴 muss ai:spec-ready entfernt werden');
	});
});

// ── AK3 — Bei 🟢 (grün) WIRD ai:spec-ready gesetzt (Freigabe in die Spec-Stufe) ─────────
// Dieser Vertrag sichert den funktionierenden 🟢-Pfad gegen Regressionen durch den Fix.
describe('AK3 — 🟢 grün (verdict=spec-ready): ai:spec-ready wird gesetzt', () => {
	it('ai:spec-ready wird addiert und nicht entfernt', () => {
		const ops = runTriage({ verdict: 'spec-ready', hasAk: true });
		assert.ok(has(ops, 'add:ai:spec-ready'), 'Bei 🟢 muss ai:spec-ready gesetzt werden');
		assert.ok(!has(ops, 'remove:ai:spec-ready'), 'Bei 🟢 darf ai:spec-ready nicht entfernt werden');
	});
});

// ── AK4 — Re-Triage: Kippt die Ampel auf 🟡/🔴 und das Issue trägt bereits ai:spec-ready,
//         wird dieses Label AUTOMATISCH entfernt (Label-Entzug). ──────────────────────────
describe('AK4 — Re-Triage 🟡/🔴 entfernt ein bestehendes ai:spec-ready (und ai:ready)', () => {
	it('bei verdict=analyzed werden ai:spec-ready UND ai:ready entfernt, nichts addiert', () => {
		const ops = runTriage({ verdict: 'analyzed', hasAk: true });
		assert.ok(has(ops, 'remove:ai:spec-ready'), 'Bestehendes ai:spec-ready muss bei Kippen auf 🟡/🔴 entfernt werden');
		assert.ok(has(ops, 'remove:ai:ready'), 'Auch ai:ready muss entfernt werden (kein Phasen-Durchreichen)');
		assert.ok(!has(ops, 'add:ai:spec-ready'), 'Trotz bereits vorhandenem Label darf es nicht erneut addiert werden');
	});
});

// ── TF3 (Hardening) — Fehlendes/fehlerhaftes verdict → fail-safe „analyzed" ─────────────
// Der Agent hat kein/kein gültiges VERDICT geliefert. Aktuell fail-open (HAS_AK=true →
// spec-ready); erwartungsgemäß fail-safe: bei 🟡/🔴-Unsicherheit beim Menschen bleiben.
describe('TF3 — verdict leer/ungültig: fail-safe analyzed (kein spec-ready)', () => {
	it('ohne VERDICT wird kein ai:spec-ready addiert (fail-safe, nicht fail-open)', () => {
		const ops = runTriage({ verdict: '', hasAk: true });
		assert.ok(has(ops, 'add:ai:analyzed'));
		assert.ok(!has(ops, 'add:ai:spec-ready'), 'Fehlendes verdict darf NICHT zu spec-ready führen (fail-open-Bug)');
		assert.ok(has(ops, 'remove:ai:spec-ready'));
	});

	it('der if/elif/else-leitet das verdict AUTORITATIV — HAS_AK allein promoviert nicht zu spec-ready', () => {
		// Drift-Schutz: HAS_AK darf höchstens als Guard (zusätzlich nötig), nie als alleiniger
		// Promoter wirken. Mit verdict=analyzed + HAS_AK=true muss final=analyzed bleiben.
		const ops = runTriage({ verdict: 'analyzed', hasAk: true });
		assert.ok(!has(ops, 'add:ai:spec-ready'));
	});
});

// ── TF4 (Issue #582) — VERDICT mit Markdown-Dekoration (**…**) → trotzdem erkannt ────────
// Claude hüllt die VERDICT-Zeile gern in Markdown-Bold: `**VERDICT: spec-ready**`. Der Parser
// (tr -d -c 'A-Za-z0-9-') muss die Dekoration streifen, sonst wird "spec-ready**" != "spec-ready"
// → fälschlich fail-safe "analyzed" → ai:spec-ready fehlt (Issue #582). Im echten Run #31574943850
// genau so passiert: Claude-Verdict aus Output: 'spec-ready**'.
describe('TF4 — **VERDICT: spec-ready** (Markdown-Dekoration): ai:spec-ready wird gesetzt (Issue #582)', () => {
	it('trotz **…**-Dekoration wird spec-ready korrekt erkannt und addiert', () => {
		const ops = runTriage({ verdict: 'spec-ready', hasAk: true, rawVerdict: '**VERDICT: spec-ready**\n' });
		assert.ok(has(ops, 'add:ai:spec-ready'), 'Markdown-** darf verdict nicht verfälschen (spec-ready** != spec-ready)');
	});
});

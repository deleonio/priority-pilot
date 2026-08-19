import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Tests für resolve-model-label.sh — die Modellwahl, die VOR dem Claude-Start feststehen
 * muss (`--model` gilt nur für die Session, mit der es gestartet wird).
 *
 * Schwerpunkt sind die Abbruchfälle: kein Label und mehrere Labels dürfen NICHT still das
 * erste oder das teuerste Modell nehmen. Ein stillschweigend geratenes Modell ist genau
 * das Verhalten, gegen das der Umbau antritt.
 *
 * `gh` wird per PATH-Stub ersetzt; das Skript läuft unangetastet als Subprozess.
 * Läuft über `pnpm test:scripts` (node:test + tsx, wie check-phase-label.test.ts).
 */

const script = join(fileURLToPath(new URL('.', import.meta.url)), 'resolve-model-label.sh');

let stubDir: string;

type Out = { model: string; abort: string; escalated: string; reason: string };

/**
 * Der Stub verzweigt über die `gh`-Argumente auf je eine Fixture-Env-Variable:
 *   GH_PR_LABELS / GH_ISSUE_LABELS / GH_LINKED / GH_COMMENTS
 * Ein leerer Wert bedeutet „leere Antwort"; `FAIL` bedeutet „API nicht erreichbar"
 * (exit 1, keine Ausgabe) — so lässt sich der Fail-closed-Pfad prüfen.
 */
const stub = [
	'#!/usr/bin/env bash',
	'args="$*"',
	'case "$args" in',
	'  *"pr view"*closingIssuesReferences*) v="${GH_LINKED-}" ;;',
	'  *"pr view"*comments*)                v="${GH_COMMENTS-}" ;;',
	'  *"pr view"*labels*)                  v="${GH_PR_LABELS-}" ;;',
	'  *"issue view"*labels*)               v="${GH_ISSUE_LABELS-}" ;;',
	'  *) v="" ;;',
	'esac',
	'[ "$v" = "FAIL" ] && exit 1',
	'printf "%s" "$v"',
].join('\n');

const labels = (...names: string[]) => JSON.stringify({ labels: names.map((name) => ({ name })) });

const run = (args: string[], env: Record<string, string> = {}): Out => {
	const res = spawnSync('bash', [script, '--repo', 'o/r', ...args], {
		env: { ...process.env, PATH: `${stubDir}:${process.env.PATH}`, ...env },
		encoding: 'utf8',
	});
	assert.equal(res.status, 0, `Skript crashte: ${res.stderr}`);
	const pick = (key: string) => res.stdout.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1] ?? '';
	return { model: pick('model'), abort: pick('abort'), escalated: pick('escalated'), reason: pick('reason') };
};

before(() => {
	stubDir = mkdtempSync(join(tmpdir(), 'rml-test-'));
	const gh = join(stubDir, 'gh');
	writeFileSync(gh, stub);
	chmodSync(gh, 0o755);
});

after(() => rmSync(stubDir, { recursive: true, force: true }));

describe('resolve-model-label.sh — Normalfall', () => {
	it('löst genau ein ai:model:*-Label auf', () => {
		const out = run(['--ticket', '42', '--kind', 'issue'], {
			GH_ISSUE_LABELS: labels('ai:needs-impl', 'ai:model:haiku'),
		});
		assert.equal(out.model, 'haiku');
		assert.equal(out.abort, 'false');
		assert.equal(out.escalated, 'false');
	});

	it('ignoriert Nicht-Modell-Labels vollständig', () => {
		const out = run(['--ticket', '42', '--kind', 'issue'], {
			GH_ISSUE_LABELS: labels('bug', 'ai:analysed', 'ai:model:opus', 'good first issue'),
		});
		assert.equal(out.model, 'opus');
	});
});

describe('resolve-model-label.sh — Abbruchfälle (kein stilles Raten)', () => {
	it('bricht ab, wenn KEIN Label gesetzt ist', () => {
		const out = run(['--ticket', '42', '--kind', 'issue'], { GH_ISSUE_LABELS: labels('ai:needs-impl') });
		assert.equal(out.abort, 'true');
		assert.equal(out.model, '', 'ohne Label darf kein Modell herauskommen');
		assert.match(out.reason, /Kein 'ai:model:\*'-Label/);
	});

	it('bricht bei MEHREREN Labels ab, statt das erste zu nehmen', () => {
		const out = run(['--ticket', '42', '--kind', 'issue'], {
			GH_ISSUE_LABELS: labels('ai:model:haiku', 'ai:model:opus'),
		});
		assert.equal(out.abort, 'true');
		assert.equal(out.model, '');
		assert.match(out.reason, /Mehrdeutige Modellwahl/);
	});

	it('bricht bei unbekanntem Alias ab', () => {
		const out = run(['--ticket', '42', '--kind', 'issue'], { GH_ISSUE_LABELS: labels('ai:model:gpt') });
		assert.equal(out.abort, 'true');
		assert.match(out.reason, /Unbekannter Modell-Alias/);
	});

	it('ist fail-CLOSED, wenn die API nicht erreichbar ist', () => {
		const out = run(['--ticket', '42', '--kind', 'issue'], { GH_ISSUE_LABELS: 'FAIL' });
		assert.equal(out.abort, 'true', 'ohne gesicherte Wahl liefe der Start auf dem Default-Modell');
		assert.match(out.reason, /fail-closed/);
	});

	it('lehnt eine unbekannte --kind ab (Tippfehler laut scheitern lassen)', () => {
		const res = spawnSync('bash', [script, '--repo', 'o/r', '--ticket', '42', '--kind', 'pull'], {
			env: { ...process.env, PATH: `${stubDir}:${process.env.PATH}` },
			encoding: 'utf8',
		});
		assert.equal(res.status, 2);
	});
});

describe('resolve-model-label.sh — PR erbt vom verknüpften Issue', () => {
	it('nimmt das Issue-Label, wenn der PR keines trägt', () => {
		const out = run(['--ticket', '7', '--kind', 'pr'], {
			GH_PR_LABELS: labels('ai:needs-review'),
			GH_LINKED: '42',
			GH_ISSUE_LABELS: labels('ai:model:sonnet'),
		});
		assert.equal(out.model, 'sonnet');
		assert.equal(out.abort, 'false');
	});

	it('gibt dem PR-eigenen Label Vorrang (manuelles Hochstufen)', () => {
		const out = run(['--ticket', '7', '--kind', 'pr'], {
			GH_PR_LABELS: labels('ai:model:opus'),
			GH_LINKED: '42',
			GH_ISSUE_LABELS: labels('ai:model:haiku'),
		});
		assert.equal(out.model, 'opus', 'am PR gesetzt schlägt das Issue');
	});

	it('bricht ab, wenn weder PR noch verknüpftes Issue ein Label tragen', () => {
		const out = run(['--ticket', '7', '--kind', 'pr'], {
			GH_PR_LABELS: labels('ai:needs-review'),
			GH_LINKED: '42',
			GH_ISSUE_LABELS: labels('ai:analysed'),
		});
		assert.equal(out.abort, 'true');
	});
});

describe('resolve-model-label.sh — Auto-Eskalation (Hypothese 4)', () => {
	// Der Stub liefert für `--json comments --jq '… | length'` direkt das Ergebnis:
	// die Anzahl der `<!-- ai-review -->`-Kommentare, also der Review-Runden.
	it('stuft ab der ZWEITEN Review-Runde eine Stufe hoch', () => {
		const out = run(['--ticket', '7', '--kind', 'pr', '--auto-escalate'], {
			GH_PR_LABELS: labels('ai:model:haiku'),
			GH_COMMENTS: '2',
		});
		assert.equal(out.model, 'sonnet');
		assert.equal(out.escalated, 'true');
	});

	it('lässt die erste Runde unangetastet', () => {
		const out = run(['--ticket', '7', '--kind', 'pr', '--auto-escalate'], {
			GH_PR_LABELS: labels('ai:model:haiku'),
			GH_COMMENTS: '1',
		});
		assert.equal(out.model, 'haiku');
		assert.equal(out.escalated, 'false');
	});

	it('deckelt bei opus (höher geht es nicht)', () => {
		const out = run(['--ticket', '7', '--kind', 'pr', '--auto-escalate'], {
			GH_PR_LABELS: labels('ai:model:opus'),
			GH_COMMENTS: '5',
		});
		assert.equal(out.model, 'opus');
		assert.equal(out.escalated, 'false');
	});

	it('eskaliert NICHT ohne --auto-escalate', () => {
		const out = run(['--ticket', '7', '--kind', 'pr'], {
			GH_PR_LABELS: labels('ai:model:haiku'),
			GH_COMMENTS: '9',
		});
		assert.equal(out.model, 'haiku');
		assert.equal(out.escalated, 'false');
	});
});

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Tests für resolve-escalation.sh — Eskalation bei Fortsetzungs-Läufen (ai:continued).
 *
 * Die falsche Entscheidung ist in BEIDEN Richtungen teuer: Eine Eskalation, die ein
 * ungültiges Modell liefert, bricht den Folgelauf hart im Setup (Allowlist in
 * setup-claude: fable | opus | sonnet | haiku — 'opus:high' wäre exit 1); eine
 * Eskalation, die gar nicht feuert, wiederholt denselben zu schwachen Versuch.
 *
 * Läuft über `pnpm test:scripts` (node:test + tsx); gh wird wie in
 * fixup-rounds.test.ts durch einen Stub mit Fixture-Datei ersetzt.
 */

const script = join(fileURLToPath(new URL('.', import.meta.url)), 'resolve-escalation.sh');

let stubDir: string;
let fixturePath: string;
let outFile: string;

/** Stub für `gh issue/pr view … --json labels --jq any(…ai:continued…)`:
 *  GH_FIXTURE enthält das Labels-JSON, GH_STUB_FAIL=1 simuliert gh-Ausfall. */
const stub = `#!/usr/bin/env bash
if [ "\${GH_STUB_FAIL:-}" = "1" ]; then echo "gh: unavailable" >&2; exit 1; fi
printf '%s' "$*" | grep -qE '(issue|pr) view' || { echo "gh: unsupported call" >&2; exit 1; }
if grep -q 'ai:continued' "$GH_FIXTURE"; then echo true; else echo false; fi
`;

const esc = (opts: { fixture: string; model?: string; effort?: string; kind?: string; fail?: boolean }) => {
	writeFileSync(fixturePath, opts.fixture, 'utf8');
	writeFileSync(outFile, '', 'utf8');
	const args = ['--repo', 'o/r', '--ticket', '42', '--kind', opts.kind ?? 'issue'];
	if (opts.model !== undefined) args.push('--current-model', opts.model);
	if (opts.effort !== undefined) args.push('--current-effort', opts.effort);
	const res = spawnSync('bash', [script, ...args], {
		env: {
			...process.env,
			PATH: `${stubDir}:${process.env.PATH}`,
			GH_FIXTURE: fixturePath,
			GH_STUB_FAIL: opts.fail ? '1' : '',
			GITHUB_OUTPUT: outFile,
		},
		encoding: 'utf8',
	});
	const out = readFileSync(outFile, 'utf8');
	return { status: res.status, out };
};

const kv = (out: string, key: string) => out.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1] ?? undefined;

const CONTINUED = '{"labels":[{"name":"ai:needs-impl"},{"name":"ai:continued"}]}';
const PLAIN = '{"labels":[{"name":"ai:needs-impl"}]}';

before(() => {
	stubDir = mkdtempSync(join(tmpdir(), 'esc-stub-'));
	fixturePath = join(stubDir, 'fixture.json');
	outFile = join(stubDir, 'github-output');
	const stubPath = join(stubDir, 'gh');
	writeFileSync(stubPath, stub, 'utf8');
	chmodSync(stubPath, 0o755);
});

after(() => rmSync(stubDir, { recursive: true, force: true }));

describe('resolve-escalation.sh — Passthrough ohne ai:continued', () => {
	it('lässt Modell+Effort unverändert und meldet escalated=false', () => {
		const { status, out } = esc({ fixture: PLAIN, model: 'sonnet', effort: 'medium' });
		assert.strictEqual(status, 0);
		assert.strictEqual(kv(out, 'model'), 'sonnet');
		assert.strictEqual(kv(out, 'effort'), 'medium');
		assert.strictEqual(kv(out, 'escalated'), 'false');
	});

	it('fällt bei gh-Ausfall fail-open auf Passthrough zurück', () => {
		const { status, out } = esc({ fixture: CONTINUED, model: 'opus', effort: 'high', fail: true });
		assert.strictEqual(status, 0);
		assert.strictEqual(kv(out, 'model'), 'opus');
		assert.strictEqual(kv(out, 'effort'), 'high');
		assert.strictEqual(kv(out, 'escalated'), 'false');
	});
});

describe('resolve-escalation.sh — Eskalation mit ai:continued', () => {
	it('stuft haiku/low auf sonnet/medium', () => {
		const { out } = esc({ fixture: CONTINUED, model: 'haiku', effort: 'low' });
		assert.strictEqual(kv(out, 'model'), 'sonnet');
		assert.strictEqual(kv(out, 'effort'), 'medium');
		assert.strictEqual(kv(out, 'escalated'), 'true');
	});

	it('stuft sonnet/medium auf opus/high', () => {
		const { out } = esc({ fixture: CONTINUED, model: 'sonnet', effort: 'medium' });
		assert.strictEqual(kv(out, 'model'), 'opus');
		assert.strictEqual(kv(out, 'effort'), 'high');
	});

	it('behält opus als Modell (Allowlist-Ende) und erhöht nur den Effort', () => {
		// Regressionstest: 'opus:high' als Modell würde setup-claude hart abbrechen.
		const { out } = esc({ fixture: CONTINUED, model: 'opus', effort: 'high' });
		assert.strictEqual(kv(out, 'model'), 'opus');
		assert.strictEqual(kv(out, 'effort'), 'xhigh');
	});

	it('behält fable als Modell und erhöht nur den Effort', () => {
		const { out } = esc({ fixture: CONTINUED, model: 'fable', effort: 'high' });
		assert.strictEqual(kv(out, 'model'), 'fable');
		assert.strictEqual(kv(out, 'effort'), 'xhigh');
	});

	it('lässt leeren Effort leer (kein Phantom-Default erfinden)', () => {
		const { out } = esc({ fixture: CONTINUED, model: 'sonnet', effort: '' });
		assert.strictEqual(kv(out, 'model'), 'opus');
		assert.strictEqual(kv(out, 'effort'), '');
	});

	it('meldet Maximum, wenn Modell und Effort bereits oben sind', () => {
		const { out } = esc({ fixture: CONTINUED, model: 'opus', effort: 'max' });
		assert.strictEqual(kv(out, 'model'), 'opus');
		assert.strictEqual(kv(out, 'effort'), 'max');
	});
});

describe('resolve-escalation.sh — PR-Eingang', () => {
	it('PR-Eingang ist immer Passthrough — ai:continued ist ein Issue-Marker', () => {
		// Selbst mit (manuell) gesetztem Label am PR: kein gh-Call, keine Eskalation —
		// der Soft-Abort-Continuation-Mechanismus existiert nur am Issue.
		const { status, out } = esc({ fixture: CONTINUED, kind: 'pr', model: 'sonnet', effort: 'medium' });
		assert.strictEqual(status, 0);
		assert.strictEqual(kv(out, 'model'), 'sonnet');
		assert.strictEqual(kv(out, 'effort'), 'medium');
		assert.strictEqual(kv(out, 'escalated'), 'false');
	});
});

describe('resolve-escalation.sh — Aufruf-Contract', () => {
	it('bricht mit Exit 2 bei fehlenden Pflicht-Argumenten ab', () => {
		const res = spawnSync('bash', [script, '--repo', 'o/r'], { encoding: 'utf8' });
		assert.strictEqual(res.status, 2);
	});
});

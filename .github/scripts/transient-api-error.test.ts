import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Tests für transient-api-error.sh (Issue #960) — die Klassifikation, die den B1-Crash-Pfad
 * zwischen "automatisch 1× neu starten" und "beim Menschen parken" entscheidet.
 *
 * Die falsche Entscheidung ist in BEIDEN Richtungen teuer: Ein transienter Crash, der
 * geparkt wird, kostet einen menschlichen Klick (Fall #957: API 500 → ai:needs-human);
 * ein echter Blocker, der re-armt wird, erzeugt einen sinnlosen Folgelauf. Und der
 * Marker-Check ist die Exactly-once-Sicherung — "irgendein Kommentar" statt "letzter
 * Kommentar" würde den Re-Arm nach einem erfolgreichen Folgelauf dauerhaft blockieren.
 *
 * Läuft über `pnpm test:scripts` (node:test + tsx, Harness wie phase-crash-park.test.ts).
 */

const script = join(fileURLToPath(new URL('.', import.meta.url)), 'transient-api-error.sh');

let dir: string;

const run = (args: string[], env: Record<string, string> = {}) => {
	const res = spawnSync('bash', [script, ...args], {
		env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, ...env },
		encoding: 'utf8',
	});
	assert.equal(res.status, 0, `Skript crashte: ${res.stderr}`);
	return {
		transient: res.stdout.match(/^transient=(.*)$/m)?.[1] ?? '',
		cause: res.stdout.match(/^cause=(.*)$/m)?.[1] ?? '',
		marker: res.stdout.match(/^marker=(.*)$/m)?.[1] ?? '',
		prevRun: res.stdout.match(/^prev_run=(.*)$/m)?.[1] ?? '',
		prevCause: res.stdout.match(/^prev_cause=(.*)$/m)?.[1] ?? '',
	};
};

/** gh-Stub: gibt GH_LAST_COMMENT als letzten Kommentar aus (gleicher jq-Kontrakt wie echt). */
const ghOk = [
	'#!/usr/bin/env bash',
	'case "$*" in',
	'  *"--json comments"*) printf "%s" "${GH_LAST_COMMENT-}" ;;',
	'esac',
	'exit 0',
].join('\n');
/** gh-Stub, der an der API scheitert (Netzwerk/Token) — Lesefehler-Fall. */
const ghFail = ['#!/usr/bin/env bash', 'exit 1'].join('\n');

const installGh = (content: string) => {
	writeFileSync(join(dir, 'gh'), content);
	chmodSync(join(dir, 'gh'), 0o755);
};

before(() => {
	dir = mkdtempSync(join(tmpdir(), 'transient-err-'));
});

after(() => rmSync(dir, { recursive: true, force: true }));

const logWith = (name: string, content: string) => {
	const p = join(dir, name);
	writeFileSync(p, content);
	return p;
};

describe('transient-api-error.sh detect — TF1: transiente Muster', () => {
	it('erkennt API 500 (Fall #957)', () => {
		const out = run([
			'detect',
			'--log',
			logWith('500.log', ' …\nAPI Error: 500 {"type":"api_error"} … please try again later\n'),
		]);
		assert.equal(out.transient, 'true');
		assert.match(out.cause, /API Error: 500/);
	});

	it('erkennt 429 und 402 (Rate-Limit / Credits) — nur mit API-Error-Anker', () => {
		for (const code of ['429', '402']) {
			const out = run(['detect', '--log', logWith(`${code}.log`, `API Error: ${code} …\n`)]);
			assert.equal(out.transient, 'true', code);
			assert.match(out.cause, new RegExp(`API Error: ${code}`));
		}
	});

	it('erkennt [1313] Fair Usage und Network error', () => {
		for (const [name, line] of [
			['1313', 'Request rejected (429) · [1313][Fair Usage Policy]'],
			['network', 'Network error. Check your connection and try again.'],
		] as const) {
			const out = run(['detect', '--log', logWith(`${name}.log`, `${line}\n`)]);
			assert.equal(out.transient, 'true', name);
		}
	});
});

describe('transient-api-error.sh detect — TF2: echte Blocker & Safe-Defaults', () => {
	it('bewertet 1310/Limit Exhausted NICHT als transient (Reset erst Tage später)', () => {
		// Der genaue reale Verlauf aus phase-crash-park.test.ts: 429 als HTTP-Status,
		// aber die Ursache ist das Tage gültige Kontingent — darf KEIN Re-Arm auslösen.
		const out = run([
			'detect',
			'--log',
			logWith(
				'1310.log',
				'API Error: Request rejected (429) · [1310][Weekly/Monthly Limit Exhausted] · reset at 2026-08-25\n',
			),
		]);
		assert.equal(out.transient, 'false');
	});

	it('bewertet beliebig andere Fehler nicht als transient', () => {
		const out = run([
			'detect',
			'--log',
			logWith('blocker.log', 'SyntaxError: Unexpected token }\n    at compile (x.ts:12)\n'),
		]);
		assert.equal(out.transient, 'false');
	});

	it('liefert transient=false bei fehlender und bei leerer Log-Datei (Safe-Default = parken)', () => {
		assert.equal(run(['detect', '--log', join(dir, 'fehlt.log')]).transient, 'false');
		assert.equal(run(['detect', '--log', logWith('leer.log', '')]).transient, 'false');
	});
});

describe('transient-api-error.sh marker — TF3: Exactly-once-Sicherung', () => {
	it('liefert absent, wenn der letzte Kommentar KEIN Marker ist (→ Re-Arm erlaubt)', () => {
		installGh(ghOk);
		const out = run(['marker', '--repo', 'o/r', '--pr', '957'], {
			GH_LAST_COMMENT: '🛑 **Fixup #957: Claude-Schritt `failure` (Crash)** — Checkliste …',
		});
		assert.equal(out.marker, 'absent');
	});

	it('liefert present samt prev_run/prev_cause, wenn der Marker der letzte Kommentar ist (→ parken)', () => {
		installGh(ghOk);
		const out = run(['marker', '--repo', 'o/r', '--pr', '957'], {
			GH_LAST_COMMENT: [
				'<!-- ai-transient-rearm -->',
				'🔁 **Fixup #957: transienter Crash — automatisch 1× neu gestartet**',
				'**Ursache:** `API Error: 500 … please try again later`',
				'Gestoppter Lauf: https://github.com/o/r/actions/runs/123456 — via `ai:needs-fixup` neu gestartet.',
			].join('\n'),
		});
		assert.equal(out.marker, 'present');
		assert.equal(out.prevRun, 'https://github.com/o/r/actions/runs/123456');
		assert.match(out.prevCause, /API Error: 500/);
	});

	it('behandelt einen Marker weiter oben im Verlauf als absent (erfolgreicher Folgelauf hebt die Sperre)', () => {
		installGh(ghOk);
		const out = run(['marker', '--repo', 'o/r', '--pr', '957'], {
			GH_LAST_COMMENT: '✅ Fixup erledigt, alles grün — der Marker steht weiter oben im Verlauf.',
		});
		assert.equal(out.marker, 'absent');
	});

	it('fällt bei gh-Lesefehler auf present (Safe-Default = parken, Exactly-once geht vor)', () => {
		installGh(ghFail);
		assert.equal(run(['marker', '--repo', 'o/r', '--pr', '957']).marker, 'present');
	});
});

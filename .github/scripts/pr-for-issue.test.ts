import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Tests für pr-for-issue.sh — welche offenen PRs zu einem Issue gehören.
 *
 * Schwerpunkt ist der Fallback. Er existiert, weil GitHub `closingIssuesReferences` nur
 * bei „Closes #123" MIT Raute befüllt; „Closes 123" bleibt unreferenziert (PR #585).
 * Früher suchte er per Volltext nach der blossen Nummer — und traf damit auch PRs, die
 * das Issue nur ERWÄHNEN. Die Spec-Phase schliesst mit diesem Ergebnis „verwaiste
 * Drafts": So verlor der Harness am 2026-08-20 die Draft-PRs #921 und #924, die den
 * Vorfall zu #912 lediglich beschrieben.
 *
 * `gh` wird per PATH-Stub durch Fixture-JSON ersetzt; das Skript läuft unangetastet.
 * Läuft über `pnpm test:scripts` (node:test + tsx, wie check-phase-label.test.ts).
 */

const script = join(fileURLToPath(new URL('.', import.meta.url)), 'pr-for-issue.sh');

let stubDir: string;
let fixturePath: string;

type PR = { number: number; isDraft: boolean; body: string; closes?: number[] };

const fixture = (prs: PR[]) =>
	JSON.stringify(
		prs.map((p) => ({
			number: p.number,
			isDraft: p.isDraft,
			body: p.body,
			closingIssuesReferences: (p.closes ?? []).map((number) => ({ number })),
		})),
	);

const run = (prs: PR[], args: string[]): string => {
	writeFileSync(fixturePath, fixture(prs));
	const res = spawnSync('bash', [script, '--repo', 'o/r', ...args], {
		env: { ...process.env, PATH: `${stubDir}:${process.env.PATH}`, GH_FIXTURE: fixturePath },
		encoding: 'utf8',
	});
	assert.equal(res.status, 0, `Skript crashte: ${res.stderr}`);
	return res.stdout.trim();
};

before(() => {
	stubDir = mkdtempSync(join(tmpdir(), 'pr-for-issue-'));
	fixturePath = join(stubDir, 'prs.json');
	const gh = join(stubDir, 'gh');
	writeFileSync(gh, '#!/usr/bin/env bash\ncat "$GH_FIXTURE"\n');
	chmodSync(gh, 0o755);
});

after(() => rmSync(stubDir, { recursive: true, force: true }));

describe('pr-for-issue.sh — Primärpfad closingIssuesReferences', () => {
	it('findet den PR über die GitHub-Referenz', () => {
		const prs: PR[] = [{ number: 7, isDraft: true, body: 'Closes #912', closes: [912] }];
		assert.equal(run(prs, ['--issue', '912', '--out', 'first']), '7');
	});

	it('ignoriert PRs, die ein anderes Issue schliessen', () => {
		const prs: PR[] = [{ number: 7, isDraft: true, body: 'Closes #999', closes: [999] }];
		assert.equal(run(prs, ['--issue', '912', '--out', 'count']), '0');
	});
});

describe('pr-for-issue.sh — Fallback verlangt ein Closing-Keyword (Regression #921/#924)', () => {
	// DER Fall, der die beiden PRs gekostet hat: Der Body beschreibt das Issue,
	// schliesst es aber nicht. Früher traf ihn die Volltextsuche.
	it('greift NICHT bei blosser Erwähnung der Nummer', () => {
		const prs: PR[] = [
			{ number: 921, isDraft: true, body: 'Zwei Befunde aus dem Referenzlauf zu Issue #912. Siehe #912.' },
		];
		assert.equal(run(prs, ['--issue', '912', '--out', 'count']), '0', 'eine Erwähnung darf keinen Treffer erzeugen');
	});

	it('greift bei "Closes 912" ohne Raute (der eigentliche Zweck, PR #585)', () => {
		const prs: PR[] = [{ number: 8, isDraft: true, body: 'Umsetzung.\n\nCloses 912' }];
		assert.equal(run(prs, ['--issue', '912', '--out', 'first']), '8');
	});

	it('akzeptiert alle GitHub-Keywords und Schreibweisen', () => {
		for (const body of ['closes #912', 'Fixes 912', 'RESOLVED: #912', 'fix 912', 'Resolve #912']) {
			const prs: PR[] = [{ number: 5, isDraft: true, body }];
			assert.equal(run(prs, ['--issue', '912', '--out', 'first']), '5', `"${body}" muss greifen`);
		}
	});

	it('verwechselt 912 nicht mit 9123', () => {
		const prs: PR[] = [{ number: 9, isDraft: true, body: 'Closes #9123' }];
		assert.equal(run(prs, ['--issue', '912', '--out', 'count']), '0');
	});

	it('trennt sauber zwischen erwähnendem und schliessendem PR', () => {
		const prs: PR[] = [
			{ number: 921, isDraft: true, body: 'Beschreibt den Vorfall auf #912 ausführlich.' },
			{ number: 8, isDraft: true, body: 'Closes 912' },
		];
		assert.equal(run(prs, ['--issue', '912', '--out', 'all']), '8', 'nur der schliessende PR darf zurückkommen');
	});
});

describe('pr-for-issue.sh — Draft-Filter und Ausgabeformen', () => {
	const prs: PR[] = [
		{ number: 10, isDraft: true, body: 'Closes #912', closes: [912] },
		{ number: 11, isDraft: false, body: 'Closes #912', closes: [912] },
	];

	it('--draft yes liefert nur Drafts', () => {
		assert.equal(run(prs, ['--issue', '912', '--draft', 'yes', '--out', 'all']), '10');
	});

	it('--draft no liefert nur Nicht-Drafts', () => {
		assert.equal(run(prs, ['--issue', '912', '--draft', 'no', '--out', 'all']), '11');
	});

	it('--out count zählt beide', () => {
		assert.equal(run(prs, ['--issue', '912', '--out', 'count']), '2');
	});

	it('liefert bei count immer eine Zahl, nie leer', () => {
		assert.equal(run([], ['--issue', '912', '--out', 'count']), '0');
	});
});

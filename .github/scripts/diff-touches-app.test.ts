import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Tests für diff-touches-app.sh — der Pfad-Filter, der über die E2E-Shards entscheidet.
 *
 * Die teure Fehlrichtung ist `app=false` bei echtem Anwendungscode: dann geht eine Regression
 * ungetestet nach main. Deshalb prüfen die Fälle vor allem, dass jeder unklare Zustand
 * (API stumm, leere Liste, fehlende Argumente) auf `true` fällt.
 */

const script = join(fileURLToPath(new URL('.', import.meta.url)), 'diff-touches-app.sh');

let stubDir: string;

/** Pfadliste direkt füttern (ohne gh). */
const forFiles = (...files: string[]) => {
	const res = spawnSync('bash', [script, '--files-from', '-'], { input: files.join('\n'), encoding: 'utf8' });
	assert.equal(res.status, 0, `Skript crashte: ${res.stderr}`);
	return res.stdout.match(/^app=(.*)$/m)?.[1] ?? '';
};

/** Über den gh-Stub: `payload` ist die Ausgabe, die `gh api --jq` liefern würde. */
const forPr = (payload: string, ghFails = false) => {
	writeFileSync(join(stubDir, 'payload'), payload);
	writeFileSync(join(stubDir, 'fail'), ghFails ? '1' : '0');
	const res = spawnSync('bash', [script, '--repo', 'o/r', '--pr', '42'], {
		env: { ...process.env, PATH: `${stubDir}:${process.env.PATH}`, STUB_DIR: stubDir },
		encoding: 'utf8',
	});
	assert.equal(res.status, 0, `Skript crashte: ${res.stderr}`);
	return res.stdout.match(/^app=(.*)$/m)?.[1] ?? '';
};

before(() => {
	stubDir = mkdtempSync(join(tmpdir(), 'dta-test-'));
	const gh = join(stubDir, 'gh');
	writeFileSync(
		gh,
		['#!/usr/bin/env bash', '[ "$(cat "$STUB_DIR/fail")" = "1" ] && exit 1', 'cat "$STUB_DIR/payload"'].join('\n'),
	);
	chmodSync(gh, 0o755);
});

after(() => rmSync(stubDir, { recursive: true, force: true }));

describe('diff-touches-app.sh', () => {
	it('erkennt Anwendungscode in frontend/server/client', () => {
		assert.equal(forFiles('frontend/src/App.tsx'), 'true');
		assert.equal(forFiles('server/src/express/session.ts'), 'true');
		assert.equal(forFiles('client/src/index.ts'), 'true');
	});

	it('erkennt E2E-Specs und Playwright-Config (liegen unter frontend/)', () => {
		assert.equal(forFiles('frontend/e2e/tasks.spec.ts'), 'true');
		assert.equal(forFiles('frontend/playwright.config.ts'), 'true');
	});

	it('erkennt Vertrag, Wurzel-Manifeste und die CI-Definition selbst', () => {
		assert.equal(forFiles('openapi.yml'), 'true');
		assert.equal(forFiles('pnpm-lock.yaml'), 'true');
		assert.equal(forFiles('package.json'), 'true');
		assert.equal(forFiles('.nvmrc'), 'true');
		assert.equal(forFiles('.github/workflows/verify.yml'), 'true');
	});

	it('lässt reine Doku-, Workflow- und Wissens-Diffs durchfallen', () => {
		assert.equal(forFiles('docs/ci-architecture.md', 'AGENTS.md', '.ai-knowledge/project.md'), 'false');
		assert.equal(forFiles('.github/workflows/05-review.yml', '.github/scripts/wait-for-checks.sh'), 'false');
		assert.equal(forFiles('.claude/skills/review-kreuzverhoer/SKILL.md'), 'false');
	});

	it('reicht EIN Anwendungstreffer in einem sonst reinen Doku-Diff', () => {
		assert.equal(forFiles('docs/testing.md', 'README.md', 'server/src/logics/score.ts'), 'true');
	});

	it('verwechselt Namenspräfixe nicht mit Verzeichnissen', () => {
		// `package.json` ist ein EXAKTER Eintrag — `packages/…` und `frontend-docs/…` sind es nicht.
		assert.equal(forFiles('packages/foo/index.ts', 'frontend-docs/guide.md'), 'false');
	});

	it('liest die Dateiliste über gh, wenn --pr übergeben wird', () => {
		assert.equal(forPr('docs/a.md\ndocs/b.md'), 'false');
		assert.equal(forPr('docs/a.md\nfrontend/src/main.tsx'), 'true');
	});

	it('ist fail-closed: gh-Fehler, leere Liste und fehlende Argumente lassen E2E laufen', () => {
		assert.equal(forPr('', true), 'true');
		assert.equal(forPr(''), 'true');
		const res = spawnSync('bash', [script, '--repo', 'o/r'], { encoding: 'utf8' });
		assert.equal(res.status, 0);
		assert.match(res.stdout, /^app=true$/m);
	});
});

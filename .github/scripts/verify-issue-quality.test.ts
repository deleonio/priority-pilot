import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Regressionstests fuer die Entscheidungslogik des Vorab-Checks:
 * verify-issue-quality.sh entscheidet, ob ein Ticket `ticket:incomplete` bekommt.
 * Ein stiller Ausfall (Check meldet ok trotz fehlendem Pflichtfeld) wuerde die
 * Analyse auf ein vagues Ticket loslassen; ein Fehlalarm blockiert jedes neue
 * Ticket still. Die Logik ist Entscheidungslogik in .github/scripts und damit
 * testpflichtig (TDD-Strategie).
 *
 * Reiner --body-file-Modus: kein gh, kein Netz — das Skript laeuft unangetastet
 * als Subprozess. Anders als der Geschwister-Check (verify-template-structure.sh)
 * schreibt es seine Outputs in die Datei $GITHUB_OUTPUT, nicht auf stdout — der
 * Test setzt env GITHUB_OUTPUT auf eine Temp-Datei und parst sie. Laeuft ueber
 * `pnpm test:scripts` (node:test + tsx).
 */

const script = join(fileURLToPath(new URL('.', import.meta.url)), 'verify-issue-quality.sh');

let workDir: string;

const run = (body: string, bodyFile?: string) => {
	const file = bodyFile ?? join(workDir, 'body.md');
	if (!bodyFile) writeFileSync(file, body, 'utf8');
	const out = join(workDir, 'github-output.txt');
	rmSync(out, { force: true });
	const res = spawnSync('bash', [script, '--body-file', file], {
		encoding: 'utf8',
		env: { ...process.env, GITHUB_OUTPUT: out },
	});
	assert.equal(res.status, 0, `Skript crashte: ${res.stderr}`);
	const output = readFileSync(out, 'utf8');
	return {
		ok: output.match(/^ok=(.*)$/m)?.[1] ?? '',
		reason: output.match(/^reason=(.*)$/m)?.[1] ?? '',
		skipped: output.match(/^skipped=(.*)$/m)?.[1] ?? '',
		details: output.match(/^details<<VERIFY_EOF\n([\s\S]*?)\nVERIFY_EOF$/m)?.[1] ?? '',
	};
};

/** Body im GitHub-Forms-Format (H3-Labels, so wie das Ticket-Template sie erzeugt). */
const formBody = (sections: Record<string, string>) =>
	Object.entries(sections)
		.map(([heading, content]) => `### ${heading}\n${content}`)
		.join('\n\n');

before(() => {
	workDir = mkdtempSync(join(tmpdir(), 'viq-test-'));
});

after(() => rmSync(workDir, { recursive: true, force: true }));

describe('verify-issue-quality.sh — vollstaendiger Body', () => {
	it('akzeptiert einen Forms-Body (H3) mit allen Pflichtfeldern und Kriterien-Bullet', () => {
		const { ok, skipped } = run(
			formBody({
				'Was ist das Problem?': 'Der Speichern-Button ist zu schmal.',
				'Wie soll es sein?': 'Volle Breite, 44px hoch.',
				'Wo tritt es auf?': 'frontend/src/components/TicketForm.tsx',
				'Woran messen wir das?': '- Bei 375px füllt der Button die Formularbreite',
			}),
		);
		assert.equal(ok, 'true');
		assert.equal(skipped, 'false');
	});
});

describe('verify-issue-quality.sh — fehlendes Pflichtfeld', () => {
	it('weist einen Body ohne den Abschnitt „Woran messen wir das?“ ab und nennt den Feldnamen', () => {
		const { ok, skipped, details } = run(
			formBody({
				'Was ist das Problem?': 'Der Speichern-Button ist zu schmal.',
				'Wie soll es sein?': 'Volle Breite, 44px hoch.',
				'Wo tritt es auf?': 'frontend/src/components/TicketForm.tsx',
			}),
		);
		assert.equal(ok, 'false');
		assert.equal(skipped, 'false');
		assert.match(details, /Woran messen wir das/);
	});
});

describe('verify-issue-quality.sh — Sammelticket (Container)', () => {
	it('skippt die Template-Pruefung bei einem Body mit Container-Satz', () => {
		const { ok, skipped } = run(
			formBody({
				'Was ist das Problem?': 'Sammelticket ohne eigene Umsetzung.',
				'Wie soll es sein?': 'Umsetzung je Sub-Issue.',
				'Wo tritt es auf?': 'nicht anwendbar',
				'Woran messen wir das?': '- Alle Sub-Issues sind umgesetzt',
			}),
		);
		assert.equal(ok, 'true');
		assert.equal(skipped, 'true');
	});
});

describe('verify-issue-quality.sh — fail-safe', () => {
	it('meldet ok bei unlesbarer Body-Datei (Pruefung darf nie blockieren)', () => {
		const { ok } = run('', join(workDir, 'existiert-nicht.md'));
		assert.equal(ok, 'true');
	});
});

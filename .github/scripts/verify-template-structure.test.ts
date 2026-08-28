import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Regressionstests fuer den Template-Struktur-Post-Check der Analyse:
 * verify-template-structure.sh muss erkennen, wenn das Analyse-Copyedit eine der
 * vier Ticket-Template-Ueberschriften entfernt hat. Ein stiller Ausfall (Check
 * meldet ok trotz fehlender Ueberschrift) wuerde Folgearbeiten auf ein Ticket
 * loslassen, dessen Abschnitte niemand mehr findet.
 *
 * Reiner --body-file-Modus: kein gh, kein Netz — das Skript laeuft unangetastet
 * als Subprozess. Laeuft ueber `pnpm test:scripts` (node:test + tsx).
 */

const script = join(fileURLToPath(new URL('.', import.meta.url)), 'verify-template-structure.sh');

let workDir: string;

const run = (body: string) => {
	const file = join(workDir, 'body.md');
	writeFileSync(file, body, 'utf8');
	const res = spawnSync('bash', [script, '--body-file', file], { encoding: 'utf8' });
	assert.equal(res.status, 0, `Skript crashte: ${res.stderr}`);
	return {
		ok: res.stdout.match(/^ok=(.*)$/m)?.[1] ?? '',
		reason: res.stdout.match(/^reason=(.*)$/m)?.[1] ?? '',
		missing: res.stdout.match(/^missing=(.*)$/m)?.[1] ?? '',
	};
};

/** Body im GitHub-Forms-Format (H3-Labels, so wie das Ticket-Template sie erzeugt). */
const formBody = (sections: Record<string, string>) =>
	Object.entries(sections)
		.map(([heading, content]) => `### ${heading}\n${content}`)
		.join('\n\n');

before(() => {
	workDir = mkdtempSync(join(tmpdir(), 'vts-test-'));
});

after(() => rmSync(workDir, { recursive: true, force: true }));

describe('verify-template-structure.sh — intakte Bodies', () => {
	it('akzeptiert einen Forms-Body (H3) mit Analyse-Block', () => {
		const { ok, missing } = run(
			formBody({
				'Was ist das Problem?': 'Der Speichern-Button ist zu schmal.',
				'Wie soll es sein?': 'Volle Breite, 44px hoch.',
				'Wo tritt es auf?': 'frontend/src/components/TicketForm.tsx',
				'Woran messen wir das?': '- Bei 375px füllt der Button die Formularbreite',
			}) +
				'\n\n<!-- KI-ANALYSE:START stand=2026-01-01T00:00:00Z -->\n### Umsetzungskontext\n...\n<!-- KI-ANALYSE:END -->',
		);
		assert.equal(ok, 'true');
		assert.equal(missing, '');
	});

	it('akzeptiert manuell angelegte H2-Ueberschriften', () => {
		const { ok } = run(
			[
				'## Was ist das Problem?',
				'Kurz.',
				'## Wie soll es sein?',
				'Anders.',
				'## Wo tritt es auf?',
				'Ueberall.',
				'## Woran messen wir das?',
				'- Ein Punkt',
			].join('\n\n'),
		);
		assert.equal(ok, 'true');
	});

	it('ignoriert Gross-/Kleinschreibung der Ueberschriften', () => {
		const { ok } = run(
			formBody({
				'was ist das problem': 'x',
				'wie soll es sein': 'x',
				'wo tritt es auf': 'x',
				'woran messen wir das': 'x',
			}),
		);
		assert.equal(ok, 'true');
	});
});

describe('verify-template-structure.sh — beschädigte Bodies', () => {
	it('meldet eine fehlende Ueberschrift namentlich', () => {
		const { ok, missing } = run(
			formBody({
				'Was ist das Problem?': 'x',
				'Wo tritt es auf?': 'x',
				'Woran messen wir das?': 'x',
			}),
		);
		assert.equal(ok, 'false');
		assert.match(missing, /Wie soll es sein/);
	});

	it('meldet ALLE fehlenden Ueberschriften, wenn nur der Analyse-Block uebrig ist', () => {
		const { ok, missing } = run(
			'<!-- KI-ANALYSE:START stand=2026-01-01T00:00:00Z -->\nAmpel: gruen\n<!-- KI-ANALYSE:END -->',
		);
		assert.equal(ok, 'false');
		for (const heading of ['Was ist das Problem', 'Wie soll es sein', 'Wo tritt es auf', 'Woran messen wir das']) {
			assert.match(missing, new RegExp(heading), `${heading} fehlt in: ${missing}`);
		}
	});

	it('matcht Ueberschriften nur am Zeilenanfang, nicht als Fliesstext', () => {
		const { ok } = run(
			[
				'### Was ist das Problem?',
				'Der Absatz erwaehnt: Wie soll es sein bloss als Text.',
				'### Wo tritt es auf?',
				'x',
				'### Woran messen wir das?',
				'- y',
			].join('\n\n'),
		);
		assert.equal(ok, 'false');
	});
});

describe('verify-template-structure.sh — grosse Bodies (SIGPIPE-Regression)', () => {
	it('akzeptiert einen >64KB-Body mit Ueberschriften am Anfang', () => {
		const gross = formBody({
			'Was ist das Problem?': 'x',
			'Wie soll es sein?': 'x',
			'Wo tritt es auf?': 'x',
			'Woran messen wir das?': 'x',
		});
		// Headings stehen im Ticket-Body IMMER oben — der Fuelle muss also hinter sie.
		// Ueber die 64-KB-Pipe-Buffer-Grenze hinaus: `printf | grep -q` exitet grep nach
		// dem Erstmatch, printf am anderen Ende kriegt SIGPIPE (141) und pipefail meldet
		// die vorhandene Ueberschrift als fehlend (falsches needs-human).
		const { ok, missing } = run(gross + '\n\n' + 'Fuelltext. '.repeat(30_000));
		assert.equal(ok, 'true');
		assert.equal(missing, '');
	});
});

describe('verify-template-structure.sh — fail-safe Richtung Pipeline', () => {
	it('besteht bei unlesbarer Datei (Infrastructure darf nicht blockieren)', () => {
		const res = spawnSync('bash', [script, '--body-file', join(workDir, 'existiert-nicht.md')], {
			encoding: 'utf8',
		});
		assert.equal(res.status, 0, `Skript crashte: ${res.stderr}`);
		assert.match(res.stdout, /^ok=true/m);
	});
});

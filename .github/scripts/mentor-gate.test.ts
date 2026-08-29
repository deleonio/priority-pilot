import { before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Tests für mentor-gate.sh (ADR 0008) — die Entscheidung, ob vor einer
 * Blockade-Phase der Mentor-Vorlauf läuft.
 *
 * Beide Fehlrichtungen sind teuer: Ein Gate, das zu früh zuschlägt, verbrennt
 * Mentor-Budget ($-Stufe) für normale Erst-Nacharbeit; eines, das zu spät oder
 * nie zuschlägt, lässt genau die Loops laufen, deretwegen der Mentor existiert
 * (#932: 10 Review- + 4 Fixup-Läufe, 34,5 Mio Token). Das Skript ist eine reine
 * Entscheidungstabelle über Inputs — kein gh, kein Netz — und deshalb ohne
 * Stub testbar (anders als fixup-rounds.test.ts).
 *
 * Läuft über `pnpm test:scripts` (node:test + tsx).
 */

const script = join(fileURLToPath(new URL('.', import.meta.url)), 'mentor-gate.sh');

before(() => {
	chmodSync(script, 0o755);
});

const run = (args: string[]) => spawnSync('bash', [script, 'check', ...args], { encoding: 'utf8' });

const kv = (res: { stdout: string }) => ({
	run: res.stdout.match(/^run=(.*)$/m)?.[1] ?? '',
	reason: res.stdout.match(/^reason=(.*)$/m)?.[1] ?? '',
});

describe('mentor-gate.sh check — Modus fixup (Rundenzahl)', () => {
	it('Runde 1: kein Mentor — normale Nacharbeit braucht keinen Rat', () => {
		const res = kv(run(['--mode', 'fixup', '--rounds', '1']));
		assert.equal(res.run, 'false');
		assert.match(res.reason, /kein Muster/);
	});

	it('Runde 2: Mentor läuft — ab der zweiten Runde liegt ein Muster vor', () => {
		const res = kv(run(['--mode', 'fixup', '--rounds', '2']));
		assert.equal(res.run, 'true');
		assert.match(res.reason, /Runde 2/);
	});

	it('Runde 4 (Deckel-Nähe): Mentor läuft weiterhin', () => {
		const res = kv(run(['--mode', 'fixup', '--rounds', '4']));
		assert.equal(res.run, 'true');
	});

	it('Runde 0 (Erstfixup): kein Mentor', () => {
		const res = kv(run(['--mode', 'fixup', '--rounds', '0']));
		assert.equal(res.run, 'false');
	});

	it('unzählbare Runden: fail-open — Phase läuft ohne Rat weiter', () => {
		// Der Stop-Guard liefert count nur bei lesbbarer Timeline; bei Lesefehler
		// stoppt er ohnehin fail-closed. Kommt hier trotzdem nichts Zählbares an,
		// darf der Mentor die Phase nicht blocken.
		const res = kv(run(['--mode', 'fixup', '--rounds', '']));
		assert.equal(res.run, 'false');
		assert.match(res.reason, /fail-open/);
	});

	it('nicht-numerische Runden: fail-open, kein Absturz', () => {
		const res = run(['--mode', 'fixup', '--rounds', 'abc']);
		assert.equal(res.status, 0);
		assert.equal(kv(res).run, 'false');
	});
});

describe('mentor-gate.sh check — Modus implement (Soft-Abort-Eskalation)', () => {
	it('escalated=true: Mentor läuft — Wiederholungslauf braucht Rat statt Wiederholung', () => {
		const res = kv(run(['--mode', 'implement', '--escalated', 'true']));
		assert.equal(res.run, 'true');
		assert.match(res.reason, /ai:continued/);
	});

	it('escalated=false: Erstlauf, kein Mentor', () => {
		const res = kv(run(['--mode', 'implement', '--escalated', 'false']));
		assert.equal(res.run, 'false');
		assert.match(res.reason, /Erstlauf/);
	});

	it('escalated fehlt: Default false — kein Mentor', () => {
		const res = kv(run(['--mode', 'implement']));
		assert.equal(res.run, 'false');
	});
});

describe('mentor-gate.sh — Guards', () => {
	it('unbekannter Modus: laut abbrechen (Exit 2), kein stilles run=false', () => {
		const res = run(['--mode', 'unsinn', '--rounds', '2']);
		assert.equal(res.status, 2);
	});

	it('fehlender Modus: laut abbrechen', () => {
		const res = run(['--rounds', '2']);
		assert.equal(res.status, 2);
	});

	it('unbekannter Sub-Befehl: laut abbrechen', () => {
		const res = spawnSync('bash', [script, 'unsinn', '--mode', 'fixup'], { encoding: 'utf8' });
		assert.equal(res.status, 2);
	});

	it('unbekanntes Argument: laut abbrechen', () => {
		const res = run(['--mode', 'fixup', '--wtf', '1']);
		assert.equal(res.status, 2);
	});
});

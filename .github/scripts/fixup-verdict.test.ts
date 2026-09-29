import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Tests für fixup-verdict.sh (Issue #961) — die Entscheidungs-Tabelle, die den
 * No-Progress-Pfad des Fixup-Workflows zwischen "zurück an den Review"
 * (already-done, erste Übergabe für diesen HEAD) und "beim Menschen parken" unterscheidet.
 *
 * Die falsche Entscheidung ist in BEIDEN Richtungen teuer: Ein erledigter PR, der
 * geparkt wird, kostet einen manuellen `ai:needs-review`-Klick (PR #944, #1650);
 * ein already-done, das auf demselben HEAD wiederholt durchgereicht wird, öffnet ein
 * Review→Fixup→already-done→Review-Ping-Pong. Und der Loop-Schutz (kein Verdict +
 * kein Commit → Mensch) ist die Regressionssicherung aus PR #524.
 *
 * Läuft über `pnpm test:scripts` (node:test + tsx, Harness wie transient-api-error.test.ts).
 */

const script = join(fileURLToPath(new URL('.', import.meta.url)), 'fixup-verdict.sh');

const evaluate = (args: string[]) => {
	const res = spawnSync('bash', [script, 'evaluate', ...args], { encoding: 'utf8' });
	assert.equal(res.status, 0, `Skript crashte: ${res.stderr}`);
	return {
		target: res.stdout.match(/^target=(.*)$/m)?.[1] ?? '',
		reason: res.stdout.match(/^reason=(.*)$/m)?.[1] ?? '',
	};
};

describe('fixup-verdict.sh evaluate — TF1: already-done, erste Übergabe für diesen HEAD → Review', () => {
	it('noch keine Übergabe auf diesem HEAD → ai:needs-review (Fall PR #1650: Rerun statt Commit)', () => {
		const out = evaluate(['--verdict', 'already-done', '--head-progress', 'false', '--handed-over', 'false']);
		assert.equal(out.target, 'ai:needs-review');
		assert.equal(out.reason, 'already-done');
	});
});

describe('fixup-verdict.sh evaluate — TF2: already-done wiederholt → Mensch (Ping-Pong-Schutz)', () => {
	it('HEAD wurde bereits einmal als already-done übergeben → ai:needs-human, reason already-done-repeat', () => {
		const out = evaluate(['--verdict', 'already-done', '--head-progress', 'false', '--handed-over', 'true']);
		assert.equal(out.target, 'ai:needs-human');
		assert.equal(out.reason, 'already-done-repeat');
	});

	it('Übergabe-Historie unlesbar (leer) → Safe-Default parken', () => {
		for (const args of [['--handed-over', ''], []]) {
			const out = evaluate(['--verdict', 'already-done', '--head-progress', 'false', ...args]);
			assert.equal(out.target, 'ai:needs-human', `args=${JSON.stringify(args)}`);
		}
	});
});

describe('fixup-verdict.sh evaluate — TF3: kein Verdict, kein Fortschritt → Mensch (Loop-Schutz)', () => {
	it('leeres Verdict landet unverändert auf ai:needs-human/no-progress (Regression PR #524)', () => {
		const out = evaluate(['--verdict', '', '--head-progress', 'false', '--handed-over', 'false']);
		assert.equal(out.target, 'ai:needs-human');
		assert.equal(out.reason, 'no-progress');
	});
});

describe('fixup-verdict.sh evaluate — TF4: needs-human bleibt terminal', () => {
	it('needs-human gewinnt unabhängig von Übergabe UND Fortschritt (B2 unangetastet)', () => {
		for (const progress of ['false', 'true']) {
			const out = evaluate(['--verdict', 'needs-human', '--head-progress', progress, '--handed-over', 'false']);
			assert.equal(out.target, 'ai:needs-human', `progress=${progress}`);
			assert.equal(out.reason, 'needs-human-verdict', `progress=${progress}`);
		}
	});
});

describe('fixup-verdict.sh evaluate — TF5: already-done MIT HEAD-Fortschritt → regulärer Pfad', () => {
	it('HEAD-Bewegung bleibt Ground Truth: Fortschritt schlägt already-done (reason head-progress)', () => {
		const out = evaluate(['--verdict', 'already-done', '--head-progress', 'true', '--handed-over', 'true']);
		assert.equal(out.target, 'ai:needs-review');
		assert.equal(out.reason, 'head-progress');
	});
});

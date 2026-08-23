import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Tests für fixup-verdict.sh (Issue #961) — die Entscheidungs-Tabelle, die den
 * No-Progress-Pfad des Fixup-Workflows zwischen "zurück an den Review"
 * (already-done + Review-Delta) und "beim Menschen parken" unterscheidet.
 *
 * Die falsche Entscheidung ist in BEIDEN Richtungen teuer: Ein erledigter PR, der
 * geparkt wird, kostet einen manuellen `ai:needs-review`-Klick (Fall PR #944);
 * ein already-done ohne neue Review-Findings, das durchgereicht wird, öffnet ein
 * Review→Fixup→already-done→Review-Ping-Pong. Und der Loop-Schutz (kein Verdict +
 * kein Commit → Mensch) ist die Regressionssicherung aus PR #524.
 *
 * Läuft über `pnpm test:scripts` (node:test + tsx, Harness wie transient-api-error.test.ts).
 */

const script = join(fileURLToPath(new URL('.', import.meta.url)), 'fixup-verdict.sh');

let dir: string;

const evaluate = (args: string[]) => {
	const res = spawnSync('bash', [script, 'evaluate', ...args], {
		env: { ...process.env, PATH: `${dir}:${process.env.PATH}` },
		encoding: 'utf8',
	});
	assert.equal(res.status, 0, `Skript crashte: ${res.stderr}`);
	return {
		target: res.stdout.match(/^target=(.*)$/m)?.[1] ?? '',
		reason: res.stdout.match(/^reason=(.*)$/m)?.[1] ?? '',
	};
};

/** Review-Kommentar-Fakten als evaluate-Argumente (id + updated_at je Seite). */
const review = (id: string, updated: string) => ['--review-id-before', id, '--review-updated-before', updated];

before(() => {
	dir = mkdtempSync(join(tmpdir(), 'fixup-verdict-'));
});

after(() => rmSync(dir, { recursive: true, force: true }));

describe('fixup-verdict.sh evaluate — TF1: already-done mit Review-Delta → Review', () => {
	it('gleiche Kommentar-ID, neues updated_at (Sammelkommentar fortgeschrieben) → ai:needs-review', () => {
		const out = evaluate([
			'--verdict',
			'already-done',
			'--head-progress',
			'false',
			...review('701', '2026-08-23T10:00:00Z'),
			'--review-id-after',
			'701',
			'--review-updated-after',
			'2026-08-23T12:30:00Z',
		]);
		assert.equal(out.target, 'ai:needs-review');
		assert.equal(out.reason, 'already-done');
	});

	it('neuer Review-Kommentar seit Laufbeginn (Baseline leer) zählt ebenfalls als Delta', () => {
		const out = evaluate([
			'--verdict',
			'already-done',
			'--head-progress',
			'false',
			...review('', ''),
			'--review-id-after',
			'702',
			'--review-updated-after',
			'2026-08-23T12:30:00Z',
		]);
		assert.equal(out.target, 'ai:needs-review');
	});
});

describe('fixup-verdict.sh evaluate — TF2: already-done ohne Delta → Mensch (Ping-Pong-Schutz)', () => {
	it('Review-Kommentar unverändert seit Start-Konsum → ai:needs-human, reason no-review-delta', () => {
		const out = evaluate([
			'--verdict',
			'already-done',
			'--head-progress',
			'false',
			...review('701', '2026-08-23T10:00:00Z'),
			'--review-id-after',
			'701',
			'--review-updated-after',
			'2026-08-23T10:00:00Z',
		]);
		assert.equal(out.target, 'ai:needs-human');
		assert.equal(out.reason, 'no-review-delta');
	});

	it('nachher LEER bei gesetzter Baseline (Lesefehler/gelöscht) → Safe-Default parken, kein Delta', () => {
		const out = evaluate([
			'--verdict',
			'already-done',
			'--head-progress',
			'false',
			...review('701', '2026-08-23T10:00:00Z'),
			'--review-id-after',
			'',
			'--review-updated-after',
			'',
		]);
		assert.equal(out.target, 'ai:needs-human');
		assert.equal(out.reason, 'no-review-delta');
	});
});

describe('fixup-verdict.sh evaluate — TF3: kein Verdict, kein Fortschritt → Mensch (Loop-Schutz)', () => {
	it('leeres Verdict landet unverändert auf ai:needs-human/no-progress (Regression PR #524)', () => {
		const out = evaluate([
			'--verdict',
			'',
			'--head-progress',
			'false',
			...review('701', '2026-08-23T10:00:00Z'),
			'--review-id-after',
			'701',
			'--review-updated-after',
			'2026-08-23T12:30:00Z',
		]);
		assert.equal(out.target, 'ai:needs-human');
		assert.equal(out.reason, 'no-progress');
	});
});

describe('fixup-verdict.sh evaluate — TF4: needs-human bleibt terminal', () => {
	it('needs-human gewinnt unabhängig von Delta UND Fortschritt (B2 unangetastet)', () => {
		for (const [progress, afterId, afterUp] of [
			['false', '701', '2026-08-23T12:30:00Z'],
			['true', '701', '2026-08-23T10:00:00Z'],
		] as const) {
			const out = evaluate([
				'--verdict',
				'needs-human',
				'--head-progress',
				progress,
				...review('701', '2026-08-23T10:00:00Z'),
				'--review-id-after',
				afterId,
				'--review-updated-after',
				afterUp,
			]);
			assert.equal(out.target, 'ai:needs-human', `progress=${progress}`);
			assert.equal(out.reason, 'needs-human-verdict', `progress=${progress}`);
		}
	});
});

describe('fixup-verdict.sh evaluate — TF5: already-done MIT HEAD-Fortschritt → regulärer Pfad', () => {
	it('HEAD-Bewegung bleibt Ground Truth: Fortschritt schlägt already-done (reason head-progress)', () => {
		const out = evaluate([
			'--verdict',
			'already-done',
			'--head-progress',
			'true',
			...review('701', '2026-08-23T10:00:00Z'),
			'--review-id-after',
			'701',
			'--review-updated-after',
			'2026-08-23T10:00:00Z',
		]);
		assert.equal(out.target, 'ai:needs-review');
		assert.equal(out.reason, 'head-progress');
	});
});

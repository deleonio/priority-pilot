import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Tests für resolve-spec-skip.sh — die Entscheidung, ob die Spec-Phase laufen muss.
 *
 * Schwerpunkt ist die Gegenprobe: „Spec nötig: nein" ist eine Selbstauskunft der Analyse.
 * Sobald die im selben Block deklarierten Dateien in Anwendungscode zeigen, gilt die Spec
 * trotzdem als nötig — sonst würde der Skip zum bequemen Default und TDD fiele genau dort
 * weg, wo Tests möglich sind.
 *
 * Zweiter Schwerpunkt: Jede Unsicherheit führt zu needs_spec=true. Ein überflüssiger
 * Spec-Lauf kostet Token, ein fälschlich übersprungener kostet den Vertrag.
 *
 * Läuft über `pnpm test:scripts` (node:test + tsx, wie check-phase-label.test.ts).
 */

const script = join(fileURLToPath(new URL('.', import.meta.url)), 'resolve-spec-skip.sh');

type Out = { needsSpec: string; reason: string };

const run = (body: string): Out => {
	const res = spawnSync('bash', [script], { input: body, encoding: 'utf8' });
	assert.equal(res.status, 0, `Skript crashte: ${res.stderr}`);
	return {
		needsSpec: res.stdout.match(/^needs_spec=(.*)$/m)?.[1] ?? '',
		reason: res.stdout.match(/^reason=(.*)$/m)?.[1] ?? '',
	};
};

/**
 * Analyse-Block im Format aus 01-claude-triage.yml. ux/spec kommen seit der
 * analysegetriebenen Routing-Tabelle (ADR-0004-Umbau) aus der ai-phase-routing-Tabelle,
 * nicht mehr aus "### UI-Bezug"/"### Spec"-Ueberschriften — Format 1:1 aus dem
 * Kopf-Kommentar von resolve-phase-routing.sh.
 */
const block = (over: Partial<{ ui: string; spec: string; dateien: string }> = {}): string =>
	[
		'<!-- KI-ANALYSE:START stand=2026-08-19T12:00:00Z -->',
		'### Umsetzungskontext',
		`- Betroffene Dateien: ${over.dateien ?? '`.github/workflows/ci.yml`'}`,
		'- Erwartetes Ergebnis: CI läuft wieder grün',
		'<!-- KI-ANALYSE:END -->',
		'',
		'<!-- ai-phase-routing:START -->',
		'| Phase | Run | Modell | Effort |',
		'| --- | --- | --- | --- |',
		`| ux | ${over.ui ?? 'nein'} | haiku | low |`,
		`| spec | ${over.spec ?? 'nein'} | - | - |`,
		'| impl | ja | haiku | medium |',
		'| review | ja | sonnet | high |',
		'<!-- ai-phase-routing:END -->',
	].join('\n');

describe('resolve-spec-skip.sh — Skip erlaubt', () => {
	it('überspringt, wenn kein Anwendungscode betroffen ist', () => {
		const out = run(block());
		assert.equal(out.needsSpec, 'false');
		assert.match(out.reason, /Kein Anwendungscode betroffen/);
	});

	it('überspringt auch bei mehreren Nicht-App-Pfaden', () => {
		const out = run(block({ dateien: '`.github/scripts/x.sh`, `docs/spec/y.md`, `renovate.json5`' }));
		assert.equal(out.needsSpec, 'false');
	});
});

describe('resolve-spec-skip.sh — Gegenprobe an den Pfaden', () => {
	it('erzwingt die Spec, wenn trotz "nein" Anwendungscode betroffen ist', () => {
		const out = run(block({ dateien: '`server/src/logics/foo.ts`' }));
		assert.equal(out.needsSpec, 'true', 'die Selbstauskunft darf den Carve-out nicht aushebeln');
		assert.match(out.reason, /Anwendungscode betroffen/);
	});

	it('erzwingt die Spec schon bei EINEM App-Pfad unter vielen', () => {
		const out = run(block({ dateien: '`.github/workflows/ci.yml`, `frontend/src/lib/a.ts`, `README.md`' }));
		assert.equal(out.needsSpec, 'true');
	});

	it('erkennt alle drei Anwendungscode-Präfixe', () => {
		for (const p of ['server/src/a.ts', 'frontend/src/b.ts', 'frontend/e2e/c.spec.ts']) {
			assert.equal(run(block({ dateien: `\`${p}\`` })).needsSpec, 'true', `${p} muss die Spec erzwingen`);
		}
	});

	it('verwechselt ähnliche Pfade nicht mit Anwendungscode', () => {
		// server/test/ und frontend/public/ sind KEIN Anwendungscode im Sinne des Carve-outs.
		const out = run(block({ dateien: '`server/test/helper.ts`, `frontend/public/logo.svg`' }));
		assert.equal(out.needsSpec, 'false');
	});
});

describe('resolve-spec-skip.sh — fail-safe Richtung Spec', () => {
	it('erzwingt die Spec bei UI-Bezug, egal was das Spec-Feld sagt', () => {
		const out = run(block({ ui: 'ja', spec: 'nein', dateien: '`docs/x.md`' }));
		assert.equal(out.needsSpec, 'true', 'needs_ux ⇒ needs_spec');
		assert.match(out.reason, /UX-Ergebnis/);
	});

	it('erzwingt die Spec, wenn das Feld fehlt', () => {
		const ohneSpecZeile = block().replace(/\| spec \|.*\|\n/, '');
		const out = run(ohneSpecZeile);
		assert.equal(out.needsSpec, 'true');
		assert.match(out.reason, /fehlt/);
	});

	it('erzwingt die Spec bei unlesbarem Feldwert', () => {
		const out = run(block({ spec: 'vielleicht' }));
		assert.equal(out.needsSpec, 'true');
		assert.match(out.reason, /unlesbar/);
	});

	it('erzwingt die Spec, wenn "nein" ohne deklarierte Dateien steht', () => {
		const ohneDateien = block().replace(/- Betroffene Dateien:.*\n/, '');
		const out = run(ohneDateien);
		assert.equal(out.needsSpec, 'true', 'ohne Pfade ist die Selbstauskunft nicht überprüfbar');
		assert.match(out.reason, /nicht überprüfbar/);
	});

	it('erzwingt die Spec bei leerem Body', () => {
		assert.equal(run('').needsSpec, 'true');
	});

	it('respektiert ein ausdrückliches "Spec nötig: ja"', () => {
		const out = run(block({ spec: 'ja' }));
		assert.equal(out.needsSpec, 'true');
	});
});

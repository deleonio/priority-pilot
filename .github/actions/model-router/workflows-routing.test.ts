import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// ROTE Spec-Tests (#150) — KI-Workflows auf den Modell-Router umstellen + Routing dokumentieren.
//
// Kontext: Der deterministische Router-Baustein steht bereits (#149/#153,
// `.github/actions/model-router/`). Dieser Sub-Task verdrahtet die sechs KI-Workflows mechanisch:
// Statt der fest verkabelten `--model claude-opus-4-8`-Zeile rufen sie den Router-Step auf und
// reichen dessen `model`/`effort`-Outputs an den Claude-Schritt durch. Zusaetzlich dokumentiert
// AGENTS.md die drei Komplexitaetsstufen (Haiku/Sonnet/Opus) inkl. Fallback und haelt den
// Mistral-Pfad explizit als „nicht betroffen" fest.
//
// Testebene (laut Triage): reine YAML-/Doku-Aenderung → Verifikation per **Grep** (hier als
// ausfuehrbarer node:test-Vertrag auf Datei-Ebene, laeuft in ci.yml) + Workflow-Lauf an einem
// Scratch-Issue. Es wird KEIN Produktivcode geschrieben; die Tests werden gruen, sobald die sechs
// Workflows + AGENTS.md die hier eingeklagte Schnittstelle/Doku bereitstellen.
//
//   AK1 — Verdrahtung (Datei-Ebene, hier eingeklagt): keine `--model claude-opus-4-8`-Zeilen mehr;
//         je Workflow ein Router-Step + `steps.router.outputs.model`/`.effort` im Claude-Schritt.
//   AK2 — realer Router-Lauf loggt Wahl  → Scratch-Issue-Lauf (nicht Datei-Ebene).
//   AK3 — Fallback `claude-sonnet-4-6`    → bestehende model-router.test.ts / entrypoint.test.ts.
//   AK4 — Mistral „nicht betroffen"       → AGENTS.md-Doku (hier eingeklagt).
//   AK5 — Doku der drei Stufen + Fallback → AGENTS.md-Doku (hier eingeklagt).

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');

// Die sechs KI-Workflows, die heute `--model claude-opus-4-8` fest verkabeln (Issue-Tabelle).
const CLAUDE_WORKFLOWS = [
	'claude-triage.yml',
	'claude-retriage.yml',
	'claude-spec.yml',
	'claude-implement.yml',
	'claude-pr-review.yml',
	'claude-pr-fixup.yml',
];

const readWorkflow = (name: string): string =>
	readFileSync(join(REPO_ROOT, '.github', 'workflows', name), 'utf8');

const readAgentsMd = (): string => readFileSync(join(REPO_ROOT, 'AGENTS.md'), 'utf8');

describe('AK1: die sechs KI-Workflows nutzen den gerouteten Modell-Output statt der festen Opus-Verkabelung', () => {
	for (const wf of CLAUDE_WORKFLOWS) {
		describe(wf, () => {
			it('enthaelt KEINE fest verkabelte `--model claude-opus-4-8`-Zeile mehr', () => {
				const content = readWorkflow(wf);
				assert.ok(
					!/--model\s+claude-opus-4-8/.test(content),
					`${wf} verkabelt das Modell noch fest auf claude-opus-4-8 — muss durch den Router-Output ersetzt sein`,
				);
			});

			it('ruft den Modell-Router-Step (`uses: ./.github/actions/model-router`) auf', () => {
				const content = readWorkflow(wf);
				assert.match(
					content,
					/uses:\s*\.\/\.github\/actions\/model-router/,
					`${wf} muss vor dem Claude-Schritt den Router-Step einbinden`,
				);
			});

			it('reicht das geroutete Modell `${{ steps.router.outputs.model }}` an den Claude-Schritt durch', () => {
				const content = readWorkflow(wf);
				assert.match(
					content,
					/--model\s+\$\{\{\s*steps\.router\.outputs\.model\s*\}\}/,
					`${wf} muss --model aus steps.router.outputs.model speisen`,
				);
			});

			it('koppelt den Effort an die Router-Stufe (`${{ steps.router.outputs.effort }}`)', () => {
				const content = readWorkflow(wf);
				assert.match(
					content,
					/--effort\s+\$\{\{\s*steps\.router\.outputs\.effort\s*\}\}/,
					`${wf} muss --effort aus steps.router.outputs.effort speisen`,
				);
			});
		});
	}
});

describe('AK1 (unveraendert): das harte 20-Minuten-Timeout bleibt in jedem Workflow erhalten', () => {
	for (const wf of CLAUDE_WORKFLOWS) {
		it(`${wf} behaelt sein \`timeout-minutes: 20\``, () => {
			const content = readWorkflow(wf);
			assert.match(
				content,
				/timeout-minutes:\s*20/,
				`${wf} darf das harte 20-Minuten-Timeout nicht verlieren`,
			);
		});
	}
});

describe('AK4 + AK5: AGENTS.md dokumentiert Routing-Stufen, Fallback und den nicht betroffenen Mistral-Pfad', () => {
	it('beschreibt alle drei Komplexitaetsstufen (Haiku, Sonnet, Opus)', () => {
		const doc = readAgentsMd();
		assert.match(doc, /haiku/i, 'AGENTS.md muss die Haiku-Stufe nennen');
		assert.match(doc, /sonnet/i, 'AGENTS.md muss die Sonnet-Stufe nennen');
		assert.match(doc, /opus/i, 'AGENTS.md muss die Opus-Stufe nennen');
	});

	it('nennt den Fallback auf `claude-sonnet-4-6` bei leerer/ungueltiger Klassifikation', () => {
		const doc = readAgentsMd();
		assert.match(
			doc,
			/claude-sonnet-4-6/,
			'AGENTS.md muss das Fallback-Modell claude-sonnet-4-6 dokumentieren',
		);
	});

	it('verweist auf den Modell-Router (Baustein / Routing)', () => {
		const doc = readAgentsMd();
		assert.match(
			doc,
			/model-router|Modell-Router/,
			'AGENTS.md muss den Modell-Router-Baustein referenzieren',
		);
	});

	it('haelt den Mistral-Pfad ausdruecklich als „nicht betroffen" vom Router fest', () => {
		const doc = readAgentsMd();
		// Im Mistral-Abschnitt muss „nicht betroffen" im Router-Kontext stehen — die Vibe-Action
		// reicht kein `--model` durch, der Router ist dort wirkungslos.
		assert.match(
			doc,
			/nicht betroffen/i,
			'AGENTS.md muss den Mistral-Pfad als „nicht betroffen" vom Router kennzeichnen',
		);
	});
});

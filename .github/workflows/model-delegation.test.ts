import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Vertrag-Tests — Modell-Wahl per Subagent-Delegation IN DERSELBEN Session statt per vorgeschaltetem
// JS-„Modell-Router". Ersetzt die fruehere `workflows-routing.test.ts` (#150) samt der ganzen
// `.github/actions/model-router/`-Composite-Action.
//
// Hintergrund: Der separate Sonnet-Klassifikationsschritt startete pro KI-Workflow eine ZWEITE
// `claude-code-action` nur fuer ein Token (haiku|sonnet|opus) — ungeschuetzt (kein continue-on-error),
// also riss ein transienter Fehler den ganzen Lauf ab, bevor echte Arbeit lief. Die einfachere,
// zuverlaessigere Loesung: EIN Lauf auf `claude-sonnet-4-6`; der Sonnet-Koordinator entscheidet selbst
// und delegiert die Abarbeitung per Agent-Tool an einen Subagenten — `heavy` (Opus) fuer komplexe,
// `light` (Haiku) fuer triviale Aufgaben. Keine JS-Logik, kein zweiter Action-Lauf.
//
// Testebene: reine YAML-/Doku-/Agent-Datei-Aenderung → Verifikation per Datei-Grep (node:test, laeuft
// in ci.yml). Ob die headless `claude-code-action` ein Subagent-Modell-Override real honoriert, wird
// per Workflow-Lauf an einem Scratch-Issue verifiziert (CI-Konfig-Ebene, nicht hier).

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..');

// Die sechs Claude-getriebenen KI-Workflows, die zuvor den Router fest verdrahtet hatten.
const CLAUDE_WORKFLOWS = [
	'claude-triage.yml',
	'claude-retriage.yml',
	'claude-spec.yml',
	'claude-implement.yml',
	'claude-pr-review.yml',
	'claude-pr-fixup.yml',
];

const readWorkflow = (name: string): string => readFileSync(join(REPO_ROOT, '.github', 'workflows', name), 'utf8');
const readRepoFile = (...parts: string[]): string => readFileSync(join(REPO_ROOT, ...parts), 'utf8');

describe('Der JS-Modell-Router ist vollstaendig entfernt', () => {
	it('das Composite-Action-Verzeichnis `.github/actions/model-router/` existiert nicht mehr', () => {
		assert.ok(
			!existsSync(join(REPO_ROOT, '.github', 'actions', 'model-router')),
			'`.github/actions/model-router/` darf nach dem Umbau auf Subagent-Delegation nicht mehr existieren',
		);
	});

	for (const wf of CLAUDE_WORKFLOWS) {
		describe(wf, () => {
			it('bindet KEINEN `uses: ./.github/actions/model-router`-Step mehr ein', () => {
				assert.ok(
					!/uses:\s*\.\/\.github\/actions\/model-router/.test(readWorkflow(wf)),
					`${wf} darf den geloeschten Router-Step nicht mehr aufrufen`,
				);
			});

			it('referenziert KEINE `steps.router.outputs.*` mehr', () => {
				assert.ok(
					!/steps\.router\.outputs/.test(readWorkflow(wf)),
					`${wf} darf keine Outputs des entfernten Router-Steps mehr lesen`,
				);
			});

			it('verkabelt das Modell NICHT wieder fest auf claude-opus-4-8', () => {
				assert.ok(
					!/--model\s+claude-opus-4-8/.test(readWorkflow(wf)),
					`${wf} darf nicht auf die alte feste Opus-Verkabelung zurueckfallen`,
				);
			});
		});
	}
});

describe('Jeder Claude-Workflow startet auf Sonnet und darf Subagenten spawnen', () => {
	for (const wf of CLAUDE_WORKFLOWS) {
		describe(wf, () => {
			it('startet die Session deterministisch auf `--model claude-sonnet-4-6`', () => {
				assert.match(
					readWorkflow(wf),
					/--model\s+claude-sonnet-4-6/,
					`${wf} muss die Session fest auf claude-sonnet-4-6 starten (Koordinator)`,
				);
			});

			it('erlaubt das Agent-/Task-Tool in --allowedTools (Subagent-Spawning)', () => {
				assert.match(
					readWorkflow(wf),
					/--allowedTools\s+"[^"]*\b(?:Agent|Task)\b[^"]*"/,
					`${wf} muss das Agent-/Task-Tool erlauben, sonst kann der Koordinator keinen Subagenten starten`,
				);
			});

			it('weist den Koordinator an, an `heavy` (Opus) bzw. `light` (Haiku) zu delegieren', () => {
				const content = readWorkflow(wf);
				assert.match(content, /heavy/, `${wf} muss den Opus-Subagenten \`heavy\` als Eskalationsziel nennen`);
				assert.match(content, /light/, `${wf} muss den Haiku-Subagenten \`light\` als Abstufungsziel nennen`);
			});

			it('behaelt sein hartes `timeout-minutes: 20`', () => {
				assert.match(readWorkflow(wf), /timeout-minutes:\s*20/, `${wf} darf das 20-Minuten-Timeout nicht verlieren`);
			});
		});
	}
});

describe('Die Subagent-Definitionen koppeln Modell an Komplexitaet', () => {
	it('`.claude/agents/heavy.md` existiert und laeuft auf Opus', () => {
		const doc = readRepoFile('.claude', 'agents', 'heavy.md');
		assert.match(doc, /^model:\s*opus\s*$/m, 'heavy.md muss `model: opus` im Frontmatter tragen');
		assert.match(doc, /^name:\s*heavy\s*$/m, 'heavy.md muss `name: heavy` im Frontmatter tragen');
	});

	it('`.claude/agents/light.md` existiert und laeuft auf Haiku', () => {
		const doc = readRepoFile('.claude', 'agents', 'light.md');
		assert.match(doc, /^model:\s*haiku\s*$/m, 'light.md muss `model: haiku` im Frontmatter tragen');
		assert.match(doc, /^name:\s*light\s*$/m, 'light.md muss `name: light` im Frontmatter tragen');
	});
});

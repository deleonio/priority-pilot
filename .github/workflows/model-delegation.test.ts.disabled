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

// Die fuenf Claude-getriebenen KI-Workflows, die zuvor den Router fest verdrahtet hatten.
// (claude-triage.yml deckt seit M8, 2026-07-08, sowohl Triage ALS AUCH Re-Triage in einem
// Workflow ab — vormals zwei getrennte Dateien claude-triage.yml + claude-retriage.yml.)
const CLAUDE_WORKFLOWS = [
	'claude-triage.yml',
	'claude-spec.yml',
	'claude-implement.yml',
	'claude-pr-review.yml',
	'claude-pr-fixup.yml',
];

// Ausnahme von der Sonnet-Koordinator-Regel: Triage/Re-Triage laufen bewusst FEST auf
// Opus mit maximalem Reasoning-Aufwand (`--model claude-opus-4-8 --effort max`) — die
// Analysequalitaet der Triage ist die Grundlage aller Folgestufen (Spec -> Implement),
// deshalb wird hier nicht delegiert, sondern direkt das staerkste Modell gestartet.
const OPUS_MAX_WORKFLOWS = ['claude-triage.yml'];

// Die uebrigen Workflows starten weiterhin auf Sonnet und delegieren per Subagent.
const COORDINATOR_WORKFLOWS = CLAUDE_WORKFLOWS.filter((wf) => !OPUS_MAX_WORKFLOWS.includes(wf));

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
		});
	}

	for (const wf of COORDINATOR_WORKFLOWS) {
		describe(wf, () => {
			it('verkabelt das Modell NICHT wieder fest auf claude-opus-4-8', () => {
				assert.ok(
					!/--model\s+claude-opus-4-8/.test(readWorkflow(wf)),
					`${wf} darf nicht auf die alte feste Opus-Verkabelung zurueckfallen`,
				);
			});
		});
	}
});

describe('Triage laeuft fest auf Opus; Effort haengt vom Trigger ab (M3, 2026-07-08)', () => {
	for (const wf of OPUS_MAX_WORKFLOWS) {
		describe(wf, () => {
			it('startet die Session fest auf `--model claude-opus-4-8`', () => {
				assert.match(
					readWorkflow(wf),
					/--model\s+claude-opus-4-8/,
					`${wf} muss fest auf claude-opus-4-8 starten (optimale Analyse)`,
				);
			});

			it('setzt `--effort max` fuer die kontextlose Erst-Analyse (issues-Event) — Wurzel aller Folgestufen', () => {
				const content = readWorkflow(wf);
				assert.match(
					content,
					/github\.event_name\s*==\s*'issue_comment'\s*&&\s*'high'\s*\|\|\s*'max'/,
					`${wf} muss den issues-Zweig (opened/unlabeled) auf --effort max belassen (kontextlose Wurzel, speist Spec/Implement/Review/Fixup)`,
				);
			});

			it('setzt `--effort high` fuer Re-Triage (issue_comment-Event) — Mensch mit Korrektur-Kontext bereits aktiv, geringerer Grenznutzen von max', () => {
				const content = readWorkflow(wf);
				assert.match(
					content,
					/--effort\s+\$\{\{\s*github\.event_name\s*==\s*'issue_comment'\s*&&\s*'high'\s*\|\|\s*'max'\s*\}\}/,
					`${wf} muss --effort konditional setzen (high bei @claude-Kommentar, max sonst)`,
				);
			});

			it('startet NICHT mehr als Sonnet-Koordinator', () => {
				const content = readWorkflow(wf);
				assert.ok(
					!/--model\s+claude-sonnet-4-6/.test(content),
					`${wf} darf nicht mehr auf claude-sonnet-4-6 starten — Triage/Re-Triage laufen fest auf Opus`,
				);
				assert.ok(
					!/Sonnet-Koordinator/.test(content),
					`${wf} darf den Agenten nicht mehr als Sonnet-Koordinator instruieren`,
				);
			});

			it('setzt Opus + die konditionale Effort-Logik im claude_args-Pfad', () => {
				const content = readWorkflow(wf);
				const modelHits = content.match(/--model\s+claude-opus-4-8/g) ?? [];
				const effortHits =
					content.match(
						/--effort\s+\$\{\{\s*github\.event_name\s*==\s*'issue_comment'\s*&&\s*'high'\s*\|\|\s*'max'\s*\}\}/g,
					) ?? [];
				assert.ok(
					modelHits.length >= 1,
					`${wf} muss --model claude-opus-4-8 im claude_args-Block setzen, gefunden: ${modelHits.length}`,
				);
				assert.ok(
					effortHits.length >= 1,
					`${wf} muss die konditionale --effort-Logik im claude_args-Block setzen, gefunden: ${effortHits.length}`,
				);
			});

			it('behaelt sein hartes `timeout-minutes: 20`', () => {
				assert.match(readWorkflow(wf), /timeout-minutes:\s*20/, `${wf} darf das 20-Minuten-Timeout nicht verlieren`);
			});
		});
	}
});

describe('Jeder Koordinator-Workflow startet auf Sonnet und darf Subagenten spawnen', () => {
	for (const wf of COORDINATOR_WORKFLOWS) {
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

describe('AGENTS.md dokumentiert die Subagent-Delegation statt des JS-Routers', () => {
	const doc = (): string => readRepoFile('AGENTS.md');

	it('beschreibt die drei Modellstufen (Sonnet-Default, Opus, Haiku)', () => {
		assert.match(doc(), /claude-sonnet-4-6/, 'AGENTS.md muss das Default-/Koordinator-Modell claude-sonnet-4-6 nennen');
		assert.match(doc(), /opus/i, 'AGENTS.md muss die Opus-Eskalation nennen');
		assert.match(doc(), /haiku/i, 'AGENTS.md muss die Haiku-Abstufung nennen');
	});

	it('dokumentiert die Opus-max-Ausnahme fuer Triage und Re-Triage', () => {
		assert.match(doc(), /claude-opus-4-8/, 'AGENTS.md muss das feste Triage-/Re-Triage-Modell claude-opus-4-8 nennen');
		assert.match(doc(), /--effort max/, 'AGENTS.md muss `--effort max` fuer Triage/Re-Triage nennen');
	});

	it('nennt die Subagent-Delegation (in derselben Session) als Mechanismus', () => {
		assert.match(doc(), /[Ss]ubagent/, 'AGENTS.md muss die Subagent-Delegation als Mechanismus beschreiben');
	});
});

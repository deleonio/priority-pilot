import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Vertrag-Tests — optionales z.ai-Backend pro Issue/PR-Label (Issue #403).
//
// Statt eines zweiten Agent-Pfads (die alte, 2026-07-08 in M11 entfernte AI_AGENT-Mehrfachlogik)
// entscheidet das Label `ai:use-zai` pro Lauf, ob Claude Code gegen Anthropic (Default) oder den
// Anthropic-kompatiblen z.ai-Endpoint laeuft. Eine Composite-Action loest das Label auf (Issue oder
// PR + verlinktes Issue, fail-open) und schreibt AI_BACKEND=zai|anthropic nach $GITHUB_ENV. Bei zai
// kommen ANTHROPIC_BASE_URL + ANTHROPIC_AUTH_TOKEN (Bearer, aus Secret ZAI_API_KEY) sowie die
// ANTHROPIC_DEFAULT_*_MODEL-Alias-Map dazu; AUTH_TOKEN out-rankt OAuth. Bei Default bleibt OAuth
// (CLAUDE_CODE_OAUTH_TOKEN) unberuehrt — keine leere ANTHROPIC_BASE_URL.
//
// Volle --model-IDs (claude-opus-4-8 / claude-sonnet-4-6) werden NICHT parametrisiert: sie verlassen
// Claude Code literal und vertrauen auf z.ai serverseitiges Mapping (Issue #403, Endpoint-only). Die
// Alias-Map greift fuer die Subagent-Delegation (heavy=opus, light=haiku).
//
// Testebene: reine YAML-/Doku-Aenderung → Verifikation per Datei-Grep (node:test, laeuft in ci.yml).

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..');

const ISSUE_WORKFLOWS = ['claude-triage.yml', 'claude-spec.yml', 'claude-implement.yml'] as const;
const PR_WORKFLOWS = ['claude-pr-review.yml', 'claude-pr-fixup.yml'] as const;
const CLAUDE_WORKFLOWS = [...ISSUE_WORKFLOWS, ...PR_WORKFLOWS];

const readWorkflow = (name: string): string => readFileSync(join(REPO_ROOT, '.github', 'workflows', name), 'utf8');
const readRepoFile = (...parts: string[]): string => readFileSync(join(REPO_ROOT, ...parts), 'utf8');

describe('Composite-Action configure-ai-backend existiert und ist korrekt', () => {
	it('`.github/actions/configure-ai-backend/action.yml` existiert', () => {
		assert.ok(
			existsSync(join(REPO_ROOT, '.github', 'actions', 'configure-ai-backend', 'action.yml')),
			'`.github/actions/configure-ai-backend/action.yml` muss als Composite-Action angelegt werden',
		);
	});

	it('nimmt entity-type, entity-number, gh-token und zai-api-key als Inputs entgegen', () => {
		const action = readRepoFile('.github', 'actions', 'configure-ai-backend', 'action.yml');
		assert.match(action, /entity-type/, 'Input `entity-type` muss vorhanden sein');
		assert.match(action, /entity-number/, 'Input `entity-number` muss vorhanden sein');
		assert.match(action, /gh-token/, 'Input `gh-token` muss vorhanden sein');
		assert.match(action, /zai-api-key/, 'Input `zai-api-key` muss vorhanden sein');
	});

	it('entscheidet backend anhand des Labels ai:use-zai und failt offen (grep -qx)', () => {
		const action = readRepoFile('.github', 'actions', 'configure-ai-backend', 'action.yml');
		assert.match(action, /ai:use-zai/, 'das Label ai:use-zai muss die Entscheidung treiben');
		assert.match(action, /grep -qx 'ai:use-zai'/, 'Label-Abgleich muss zeilengenau erfolgen (grep -qx)');
	});

	it('leitet bei ai:use-zai auf den z.ai-Endpoint um und setzt AI_BACKEND=zai + ANTHROPIC_AUTH_TOKEN aus dem Secret', () => {
		const action = readRepoFile('.github', 'actions', 'configure-ai-backend', 'action.yml');
		assert.match(action, /https:\/\/api\.z\.ai\/api\/anthropic/, 'z.ai-Endpunkt muss fest verdrahtet sein');
		assert.match(action, /AI_BACKEND=zai/, 'AI_BACKEND=zai muss nach $GITHUB_ENV geschrieben werden');
		assert.match(
			action,
			/ANTHROPIC_AUTH_TOKEN=\$\{?ZAI_API_KEY|ANTHROPIC_AUTH_TOKEN=\$ZAI_API_KEY/,
			'ANTHROPIC_AUTH_TOKEN muss aus dem ZAI_API_KEY-Secret gespeist werden',
		);
		assert.match(action, /ANTHROPIC_BASE_URL=/, 'ANTHROPIC_BASE_URL muss gesetzt werden');
	});

	it('schreibt im Default-Fall AI_BACKEND=anthropic (kein leerer Endpoint)', () => {
		const action = readRepoFile('.github', 'actions', 'configure-ai-backend', 'action.yml');
		assert.match(action, /AI_BACKEND=anthropic/, 'Default muss AI_BACKEND=anthropic setzen');
	});

	it('bricht deterministisch ab, wenn ai:use-zai gesetzt ist aber das Secret fehlt (kein stiller Skip)', () => {
		const action = readRepoFile('.github', 'actions', 'configure-ai-backend', 'action.yml');
		assert.match(action, /::error/, 'fehlendes Secret muss mit ::error quittiert werden');
		assert.match(action, /exit\s+1/, 'fehlendes Secret muss den Schritt auf failure ziehen (exit 1)');
	});

	it('mappt alle vier Modell-Aliase (opus/sonnet/haiku/fable) auf GLM', () => {
		const action = readRepoFile('.github', 'actions', 'configure-ai-backend', 'action.yml');
		assert.match(action, /ANTHROPIC_DEFAULT_OPUS_MODEL=/, 'Opus-Alias-Map muss gesetzt sein');
		assert.match(action, /ANTHROPIC_DEFAULT_SONNET_MODEL=/, 'Sonnet-Alias-Map muss gesetzt sein');
		assert.match(action, /ANTHROPIC_DEFAULT_HAIKU_MODEL=/, 'Haiku-Alias-Map muss gesetzt sein');
		assert.match(action, /ANTHROPIC_DEFAULT_FABLE_MODEL=/, 'Fable-Alias-Map muss gesetzt sein');
		assert.match(action, /glm-/i, 'mindestens ein GLM-Modellname muss auftreten');
	});

	it('liest fuer PR-Stufen zusaetzlich die Labels des verlinkten Issues (Closes #N)', () => {
		const action = readRepoFile('.github', 'actions', 'configure-ai-backend', 'action.yml');
		assert.match(
			action,
			/closingIssuesReferences/,
			'PR-Pfad muss das verlinkte Issue aufloesen (closingIssuesReferences)',
		);
	});
});

describe('Jeder Claude-Workflow verkabelt das Label-gesteuerte z.ai-Backend', () => {
	for (const wf of CLAUDE_WORKFLOWS) {
		describe(wf, () => {
			it('bindet die Composite-Action configure-ai-backend ein', () => {
				assert.match(
					readWorkflow(wf),
					/\.\/\.github\/actions\/configure-ai-backend/,
					`${wf} muss ./.github/actions/configure-ai-backend als Schritt einbinden`,
				);
			});

			it('ordnet configure-ai-backend NACH actions/checkout und VOR anthropics/claude-code-action', () => {
				const content = readWorkflow(wf);
				const checkout = content.indexOf('actions/checkout@');
				const configure = content.indexOf('configure-ai-backend');
				const action = content.indexOf('anthropics/claude-code-action@');
				assert.ok(checkout >= 0, `${wf}: actions/checkout nicht gefunden`);
				assert.ok(configure >= 0, `${wf}: configure-ai-backend nicht gefunden`);
				assert.ok(action >= 0, `${wf}: claude-code-action nicht gefunden`);
				assert.ok(
					checkout < configure && configure < action,
					`${wf}: configure-ai-backend muss nach checkout und vor der claude-code-action stehen (checkout < configure < action)`,
				);
			});

			it('uebergibt entity-number + zai-api-key korrekt', () => {
				const content = readWorkflow(wf);
				assert.match(
					content,
					/zai-api-key:\s*\$\{\{\s*secrets\.ZAI_API_KEY/,
					`${wf} muss zai-api-key aus secrets.ZAI_API_KEY speisen`,
				);
				assert.match(content, /entity-number:/, `${wf} muss entity-number uebergeben`);
				assert.match(content, /gh-token:/, `${wf} muss gh-token uebergeben`);
			});

			it('gated claude_code_oauth_token auf env.AI_BACKEND (z.ai-Pfad ohne OAuth)', () => {
				assert.match(
					readWorkflow(wf),
					/claude_code_oauth_token:\s*\$\{\{\s*env\.AI_BACKEND\s*==\s*'zai'/,
					`${wf} muss claude_code_oauth_token konditional auf env.AI_BACKEND == 'zai' setzen`,
				);
			});

			it('macht den Agent-Secret-Preflight backend-bewusst (zai-Fruehreturn statt OAuth-Abbruch)', () => {
				const content = readWorkflow(wf);
				assert.match(
					content,
					/AI_BACKEND:\s*\$\{\{\s*env\.AI_BACKEND/,
					`${wf} muss AI_BACKEND (aus env) in den Preflight-env aufnehmen`,
				);
				assert.match(
					content,
					/AI_BACKEND:-\}.*=.*"zai"/,
					`${wf} muss einen Fruehreturn fuer AI_BACKEND=zai im Preflight enthalten`,
				);
				// Die von pipeline-hardening.test.ts (C2) gepinnten Literale duerfen NICHT verloren gehen:
				assert.match(
					content,
					/name: Agent-Secret pr[fü]fen \(kein stiller Skip\)/,
					`${wf}: Preflight-Name muss erhalten bleiben`,
				);
				assert.match(
					content,
					/CLAUDE_CODE_OAUTH_TOKEN:/,
					`${wf}: CLAUDE_CODE_OAUTH_TOKEN-Literal muss erhalten bleiben`,
				);
				assert.match(content, /::error title=Agent-Secret fehlt/, `${wf}: ::error-Zeile muss erhalten bleiben`);
			});
		});
	}

	for (const wf of ISSUE_WORKFLOWS) {
		it(`${wf} prueft die Labels des Issues (entity-type: issue)`, () => {
			assert.match(readWorkflow(wf), /entity-type:\s*issue/, `${wf} muss entity-type: issue uebergeben`);
		});
	}

	for (const wf of PR_WORKFLOWS) {
		it(`${wf} prueft die Labels des PR (entity-type: pr)`, () => {
			assert.match(readWorkflow(wf), /entity-type:\s*pr/, `${wf} muss entity-type: pr uebergeben`);
		});
	}
});

describe('AGENTS.md dokumentiert das umschaltbare Backend', () => {
	const doc = (): string => readRepoFile('AGENTS.md');

	it('nennt das Toggle-Label ai:use-zai und den Claude-Default', () => {
		const d = doc();
		assert.match(d, /ai:use-zai/, 'AGENTS.md muss das Toggle-Label ai:use-zai dokumentieren');
		assert.match(d, /Claude/i, 'AGENTS.md muss den Claude-Default nennen');
		assert.match(d, /z\.ai/, 'AGENTS.md muss z.ai als Opt-in nennen');
	});

	it('nennt das Secret ZAI_API_KEY fuer den z.ai-Pfad', () => {
		assert.match(doc(), /ZAI_API_KEY/, 'AGENTS.md muss das Secret ZAI_API_KEY dokumentieren');
	});

	it('dokumentiert die GLM-Modell-Map (Alias-Aufloesung fuer Subagenten)', () => {
		assert.match(doc(), /glm-/i, 'AGENTS.md muss die GLM-Modell-Map erwaehnen');
	});
});

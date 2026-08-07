import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Vertrag-Tests — Provider-Switch `vars.LLM_PROVIDER` (zai | claude).
//
// Hintergrund: Der Switch war ursprünglich in den Workflows (986dc6f), wurde beim
// Umbau auf "Claude Code only" (6d9684a) entfernt und die Provider-Config nach
// .claude/settings.json verlagert. Das war der falsche Ort: settings.json ist
// eingecheckt und wird von lokalen Sessions mitbenutzt — ein dort gesetztes
// ANTHROPIC_BASE_URL routet jede Entwickler-Session zwangsweise nach z.ai.
// Commit bb067cc hat die Keys deshalb lokal entfernt und damit CI still gebrochen
// (ZAI_API_KEY ging gegen api.anthropic.com).
//
// Diese Tests halten fest: die Provider-Auflösung lebt in der Setup-Action, nicht
// in settings.json, und alle fünf Pipeline-Workflows reichen die Variable durch.
//
// Testebene: statische YAML-/JSON-Datei-Checks (node:test via tsx, ci.yml Z. 102).

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..');

const readFile = (...parts: string[]): string => readFileSync(join(REPO_ROOT, ...parts), 'utf8');

const actionYml = (): string => readFile('.github', 'actions', 'setup-claude', 'action.yml');
const settingsJson = (): string => readFile('.claude', 'settings.json');

// Die fünf label-getriebenen Pipeline-Workflows, die den Agent aufrufen.
const PIPELINE_WORKFLOWS = [
	'01-claude-triage.yml',
	'02-claude-spec.yml',
	'03-claude-implement.yml',
	'04-claude-pr-review.yml',
	'05-claude-pr-fixup.yml',
] as const;

const workflowYml = (name: string): string => readFile('.github', 'workflows', name);

describe('AK1 — Setup-Action kennt den Provider-Switch', () => {
	it('deklariert die Inputs llm-provider, zai-api-key und claude-api-key', () => {
		const yml = actionYml();
		for (const input of ['llm-provider:', 'zai-api-key:', 'claude-api-key:']) {
			assert.match(
				yml,
				new RegExp(`^\\s{2}${input.replace('-', '-')}`, 'm'),
				`Input \`${input}\` fehlt in setup-claude/action.yml`,
			);
		}
	});

	it('hat keinen generischen api-key-Input mehr (der den Provider verschleiert hat)', () => {
		assert.doesNotMatch(
			actionYml(),
			/^\s{2}api-key:/m,
			'Der generische `api-key`-Input muss durch provider-spezifische Inputs ersetzt sein',
		);
	});

	// Default = claude/CLAUDE_API_KEY. Der Input-Default greift nur, wenn der Workflow den
	// Input weglässt; bei gesetztem-aber-leerem vars.LLM_PROVIDER kommt ein Leerstring an —
	// deshalb braucht es BEIDE Fallbacks (Input-Default und Shell-Expansion).
	it('fällt ohne gesetzte Variable auf claude zurück (Default im Input + Shell-Fallback)', () => {
		const yml = actionYml();
		assert.match(yml, /default: 'claude'/, 'llm-provider braucht den Default `claude`');
		assert.match(yml, /PROVIDER="\$\{LLM_PROVIDER:-claude\}"/, 'Leere Variable muss in der Shell auf `claude` fallen');
	});
});

describe('AK2 — Provider-Auflösung setzt Endpoint, Modelle und Key korrekt', () => {
	it('zai-Zweig setzt den z.ai-Endpoint und den ZAI_API_KEY', () => {
		const yml = actionYml();
		assert.match(yml, /ANTHROPIC_BASE_URL=https:\/\/api\.z\.ai\/api\/anthropic/, 'z.ai-Endpoint fehlt');
		assert.match(yml, /ANTHROPIC_API_KEY=\$ZAI_API_KEY/, 'zai-Zweig muss ZAI_API_KEY als ANTHROPIC_API_KEY setzen');
	});

	it('zai-Zweig mappt die Modell-Aliase auf GLM (damit "model": "opus" providerneutral bleibt)', () => {
		const yml = actionYml();
		assert.match(yml, /ANTHROPIC_DEFAULT_OPUS_MODEL=glm-5\.1\[1m\]/, 'Opus-Alias muss auf glm-5.1[1m] zeigen');
		assert.match(yml, /ANTHROPIC_DEFAULT_SONNET_MODEL=glm-/, 'Sonnet-Alias fehlt');
		assert.match(yml, /ANTHROPIC_DEFAULT_HAIKU_MODEL=glm-/, 'Haiku-Alias fehlt');
	});

	it('claude-Zweig setzt CLAUDE_API_KEY und KEIN ANTHROPIC_BASE_URL', () => {
		const yml = actionYml();
		assert.match(
			yml,
			/ANTHROPIC_API_KEY=\$CLAUDE_API_KEY/,
			'claude-Zweig muss CLAUDE_API_KEY als ANTHROPIC_API_KEY setzen',
		);
		// Der Endpoint darf genau einmal vorkommen — nämlich im zai-Zweig.
		const baseUrlHits = yml.match(/ANTHROPIC_BASE_URL=/g) ?? [];
		assert.equal(
			baseUrlHits.length,
			1,
			'ANTHROPIC_BASE_URL darf nur im zai-Zweig gesetzt werden (claude nutzt den Default-Endpoint)',
		);
	});

	it('bricht bei fehlendem Key und bei unbekanntem Provider hart ab', () => {
		const yml = actionYml();
		assert.match(
			yml,
			/LLM_PROVIDER=zai, aber Secret ZAI_API_KEY ist leer/,
			'Fehlender ZAI_API_KEY muss einen klaren Fehler werfen',
		);
		assert.match(
			yml,
			/LLM_PROVIDER=claude, aber Secret CLAUDE_API_KEY ist leer/,
			'Fehlender CLAUDE_API_KEY muss einen klaren Fehler werfen',
		);
		assert.match(
			yml,
			/erlaubt sind 'zai' oder 'claude'/,
			'Unbekannter Provider-Wert muss den Lauf abbrechen statt still zu laufen',
		);
	});
});

describe('AK3 — Alle fünf Pipeline-Workflows reichen vars.LLM_PROVIDER durch', () => {
	for (const name of PIPELINE_WORKFLOWS) {
		it(`${name} übergibt llm-provider + beide Provider-Keys`, () => {
			const yml = workflowYml(name);
			assert.match(yml, /llm-provider: \$\{\{ vars\.LLM_PROVIDER \}\}/, `${name} muss vars.LLM_PROVIDER durchreichen`);
			assert.match(
				yml,
				/zai-api-key: \$\{\{ secrets\.ZAI_API_KEY \}\}/,
				`${name} muss secrets.ZAI_API_KEY durchreichen`,
			);
			assert.match(
				yml,
				/claude-api-key: \$\{\{ secrets\.CLAUDE_API_KEY \}\}/,
				`${name} muss secrets.CLAUDE_API_KEY durchreichen`,
			);
			assert.doesNotMatch(yml, /^\s+api-key:/m, `${name} darf den generischen api-key-Input nicht mehr verwenden`);
		});
	}
});

describe('AK4 — .claude/settings.json bleibt providerneutral', () => {
	it('enthält kein ANTHROPIC_BASE_URL (würde lokale Sessions zwangs-umrouten)', () => {
		assert.doesNotMatch(
			settingsJson(),
			/ANTHROPIC_BASE_URL/,
			'settings.json ist eingecheckt und gilt auch lokal — der Endpoint gehört in die Setup-Action',
		);
	});

	it('enthält keine provider-spezifischen Modell-Aliase', () => {
		assert.doesNotMatch(
			settingsJson(),
			/ANTHROPIC_DEFAULT_\w+_MODEL/,
			'Modell-Aliase sind provider-spezifisch und gehören in die Setup-Action',
		);
	});

	it('wählt das Modell providerneutral über den Alias-Namen', () => {
		const settings = JSON.parse(settingsJson()) as { model?: string };
		assert.ok(
			['opus', 'sonnet', 'haiku', 'fable'].includes(settings.model ?? ''),
			`"model" muss ein Alias-Name sein (opus/sonnet/haiku/fable), war: ${settings.model}`,
		);
	});
});

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
	// z.ai authentifiziert per Bearer-Header. ANTHROPIC_API_KEY sendet stattdessen x-api-key,
	// was z.ai ablehnt — deshalb ANTHROPIC_AUTH_TOKEN und ausdrücklich NICHT beides.
	it('zai-Zweig setzt den z.ai-Endpoint und den Token als ANTHROPIC_AUTH_TOKEN', () => {
		const yml = actionYml();
		assert.match(yml, /ANTHROPIC_BASE_URL=https:\/\/api\.z\.ai\/api\/anthropic/, 'z.ai-Endpoint fehlt');
		assert.match(
			yml,
			/ANTHROPIC_AUTH_TOKEN=\$ZAI_API_KEY/,
			'zai-Zweig muss ZAI_API_KEY als ANTHROPIC_AUTH_TOKEN (Bearer) setzen, nicht als ANTHROPIC_API_KEY',
		);
		assert.doesNotMatch(
			yml,
			/ANTHROPIC_API_KEY=\$ZAI_API_KEY/,
			'zai-Zweig darf ZAI_API_KEY nicht zusätzlich als ANTHROPIC_API_KEY setzen (konkurrierende Auth-Header)',
		);
	});

	// Exakte Werte, nicht nur "irgendein glm-": das Alias-Mapping ist die einzige Stelle, die
	// bestimmt welches Modell CI wirklich fährt. Bewusst OHNE [1m]-Kontext-Suffix.
	it('zai-Zweig mappt die Modell-Aliase auf GLM (damit "model": "opus" providerneutral bleibt)', () => {
		const yml = actionYml();
		const EXPECTED: Record<string, string> = {
			ANTHROPIC_DEFAULT_HAIKU_MODEL: 'glm-4.5-air',
			ANTHROPIC_DEFAULT_SONNET_MODEL: 'glm-4.7',
			ANTHROPIC_DEFAULT_OPUS_MODEL: 'glm-5.1',
			ANTHROPIC_DEFAULT_FABLE_MODEL: 'glm-5.2',
			CLAUDE_CODE_SUBAGENT_MODEL: 'glm-4.7',
		};
		for (const [envVar, model] of Object.entries(EXPECTED)) {
			assert.match(yml, new RegExp(`${envVar}=${model.replace(/\./g, '\\.')}"`), `${envVar} muss auf ${model} zeigen`);
		}
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

// Regression: erster Live-Lauf mit LLM_PROVIDER=claude scheiterte an "Invalid API key",
// obwohl der Switch korrekt auflöste und CLAUDE_API_KEY gesetzt war. Ursache-Klasse:
// Anthropic-Tokens sind nicht austauschbar — ein OAuth-Token aus `claude setup-token`
// (sk-ant-oat…) wird von ANTHROPIC_API_KEY abgelehnt und braucht CLAUDE_CODE_OAUTH_TOKEN.
describe('AK5 — claude-Zweig unterscheidet API-Key und OAuth-Token', () => {
	it('routet sk-ant-oat… nach CLAUDE_CODE_OAUTH_TOKEN', () => {
		const yml = actionYml();
		assert.match(yml, /sk-ant-oat\*\)/, 'Es braucht einen expliziten Zweig für das OAuth-Präfix sk-ant-oat');
		assert.match(
			yml,
			/CLAUDE_CODE_OAUTH_TOKEN=\$CLAUDE_API_KEY/,
			'OAuth-Token muss als CLAUDE_CODE_OAUTH_TOKEN gesetzt werden, nicht als ANTHROPIC_API_KEY',
		);
	});

	it('setzt bei OAuth-Token NICHT zusätzlich ANTHROPIC_API_KEY (sonst gewinnt der ungültige Key)', () => {
		const yml = actionYml();
		const oauthBranch = yml.match(/sk-ant-oat\*\)([\s\S]*?);;/);
		assert.ok(oauthBranch, 'OAuth-Zweig nicht gefunden');
		assert.doesNotMatch(
			oauthBranch[1],
			/ANTHROPIC_API_KEY=/,
			'Im OAuth-Zweig darf ANTHROPIC_API_KEY nicht gesetzt werden',
		);
	});

	// Bewusst nur ::warning, kein exit 1: ein zu strenger Guard würde ein gültiges Token
	// blockieren, falls Anthropic neue Präfixe einführt. Die API-Antwort ist aussagekräftiger.
	it('warnt bei unbekanntem Präfix, blockiert den Lauf aber nicht', () => {
		const yml = actionYml();
		assert.match(
			yml,
			/::warning title=Unerwartetes Token-Format::CLAUDE_API_KEY beginnt nicht mit 'sk-ant-'/,
			'Unbekanntes Präfix muss warnen statt still zu laufen',
		);
		const fallback = yml.match(/\*\)\n([\s\S]*?);;\n {12}esac/);
		assert.ok(fallback, 'Fallback-Zweig des Token-Typ-case nicht gefunden');
		assert.doesNotMatch(fallback[1], /exit 1/, 'Unbekanntes Präfix darf den Lauf nicht hart abbrechen');
		assert.match(fallback[1], /ANTHROPIC_API_KEY=\$CLAUDE_API_KEY/, 'Fallback muss es als ANTHROPIC_API_KEY versuchen');
	});

	it('strippt Whitespace aus beiden Secrets (Copy-Paste-Newline macht Keys ungültig)', () => {
		const yml = actionYml();
		for (const key of ['CLAUDE_API_KEY', 'ZAI_API_KEY']) {
			assert.match(
				yml,
				new RegExp(`${key}="\\$\\(printf '%s' "\\$${key}" \\| tr -d '\\[:space:\\]'\\)"`),
				`${key} muss vor der Verwendung von Whitespace befreit werden`,
			);
		}
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

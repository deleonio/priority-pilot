import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Permission-/Tier-Modell + globaler deny-Layer (Issue #497).
//
// Aufnahmekriterium dieser Datei: das Zwei-Klassen-Modell (restricted/full/review) und der
// deny-Layer sind eine SICHERHEITS-relevante Verhaltens-Ableitung, kein blosser String-Inhalt.
// Der Test fuettert die drei Tier-Werte in die echte resolve-invoke-Ableitung (Bash-Ausfuehrung)
// und wertet die daraus entstehenden Flags aus — er prueft das VERHALTEN, nicht das Vorhandensein
// eines hineingeschriebenen Strings. Der deny-Layer wird nach CONCERN (Exfil, Secrets, Destruktiv)
// gefordert, nicht als Literal. Der MCP-Servername wird aus .mcp.json abgeleitet (Quelle der
// Wahrheit) und gegen action.yml gespiegelt.
//
// "deny greift unter bypassPermissions" ist eine dokumentierte Claude-Code-Invariante
// (https://code.claude.com/docs/en/permissions: "Explicit deny rules still apply"). Dieser Test
// sichert die Schicht, die unser Repo kontrolliert — Anwesenheit + Deckung der deny-Regeln —,
// denn einen authentifizierten `claude -p`-Prozess im statischen Test-Job zu spawnen waere weder
// deterministisch noch verfuegbar.
//
// Testebene: statische Auswertung + Ausfuehrung der resolve-invoke-Ableitung (node:test via tsx).

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..');
const read = (...parts: string[]): string => readFileSync(join(REPO_ROOT, ...parts), 'utf8');
const json = <T>(...parts: string[]): T => JSON.parse(read(...parts)) as T;

// Server-Name aus .mcp.json ist die Quelle der Wahrheit fuer den MCP-Tool-Prefix.
const SERVERS = Object.keys(json<{ mcpServers: Record<string, unknown> }>('.mcp.json').mcpServers);

// ── AK1: globaler deny-Layer in .claude/settings.json ──────────────────────────────────

describe('Permission-Layer — settings.json hat einen deny-Layer mit Deckung', () => {
	const settings = json<{ permissions?: { deny?: unknown } }>('.claude', 'settings.json');
	const deny = (settings.permissions?.deny as string[] | undefined) ?? [];

	it('permissions.deny ist ein nicht-leeres Array', () => {
		assert.ok(
			Array.isArray(deny) && deny.length > 0,
			'permissions.deny fehlt oder leer — mit Token im Env gibt es keinen Guardrail gegen Prompt-Injection',
		);
	});

	// Jede Regel nach CONCERN fordern, nicht als Wortlaut: die Implementierung darf die Glob-Syntax
	// variieren, muss aber jede Schutzluecke schliessen. Mutations-Probe: entferne eine Concern-Regel
	// → der zugehoerige it wird rot.
	const covers = (concern: RegExp, label: string) => {
		it(`deny deckt "${label}" ab`, () => {
			assert.ok(
				Array.isArray(deny) && deny.some((d) => concern.test(String(d))),
				`keine deny-Regel fuer "${label}" — Schutzluecke bleibt offen (${concern})`,
			);
		});
	};

	covers(/curl|wget|\bnc\b/, 'Netz-Exfiltration (curl/wget/nc)');
	covers(/\.env/, 'Secret-Datei .env');
	covers(/\.pem/, 'Private Keys (*.pem)');
	covers(/secrets/, 'secrets/-Verzeichnis');
	covers(/\.ssh/, '~/.ssh (Credentials)');
	covers(/npmrc/, '~/.npmrc (Token)');
	covers(/rm\s+-rf/, 'destruktives rm -rf');
	covers(/sudo/, 'Rechte-Eskalation (sudo)');
	covers(/git push --force/, 'force-push Langform (--force direkt nach push)');
	covers(/git push -f\b/, 'force-push Kurzform -f (git push -f …)');
});

// ── AK6: MCP-Toolname spiegelt den in .mcp.json deklarierten Server ────────────────────

describe('Permission-Layer — MCP-Toolname passt zum deklarierten Server', () => {
	const actionYml = read('.github', 'actions', 'setup-claude', 'action.yml');
	const refs = [...actionYml.matchAll(/mcp__([\w-]+)__/g)].map((m) => m[1]);

	it('es gibt MCP-Referenzen in action.yml (sonst prueft die Invariante ins Leere)', () => {
		assert.ok(refs.length > 0, 'keine mcp__*-Referenz in action.yml — NEEDS_MCP-Toggling kaputt?');
	});

	for (const ref of [...new Set(refs)]) {
		it(`Server "${ref}" ist in .mcp.json deklariert`, () => {
			assert.ok(
				SERVERS.includes(ref),
				`action.yml referenziert mcp__${ref}__, der deklarierte Server heisst aber: ${SERVERS.join(' / ')}. ` +
					`Der falsche Name wird aktuell nur durch --dangerously-skip-permissions maskiert.`,
			);
		});
	}
});

// ── AK2: setup-claude leitet je tools-tier die korrekten Flags ab (via Ausfuehrung) ─────
// Ueber die Tier-Ausfuehrung sind AK3 (restricted), AK4 (review) und AK5 (full) mit abgedeckt:
// die Ableitung MUSS fuer jedes Tier die spezifische Flag-Kombination produzieren.

describe('Permission-Layer — setup-claude leitet je tools-tier die korrekten Flags ab', () => {
	const actionYml = read('.github', 'actions', 'setup-claude', 'action.yml');
	const stepText = actionYml.slice(actionYml.indexOf('id: resolve-invoke'));

	const inputsBlock = actionYml.match(/^inputs:\n([\s\S]*?)(?=^(?:outputs|runs):)/m)?.[1] ?? '';

	it('Input tools-tier ist deklariert', () => {
		assert.ok(
			/^\s{2}tools-tier:/m.test(inputsBlock),
			'Input "tools-tier" fehlt in action.yml — es gibt keine Steuerung der Permission-Tiers',
		);
	});

	// Tier-Env aus dem resolve-invoke-Step ableiten (Mirror der NEEDS_MCP-Konvention:
	// inputs.<name> -> env <NAME>). Ist die Bindung nicht da, fehlt die gesamte Tier-Verzweigung.
	const tierEnv = stepText.match(/^\s*([A-Z][A-Z0-9_]*):\s*\$\{\{\s*inputs\.tools-tier\s*\}\}/m)?.[1] ?? null;

	it('resolve-invoke bindet tools-tier als env-Variable', () => {
		assert.ok(
			tierEnv,
			'resolve-invoke liest inputs.tools-tier nicht als env — die Tier-Verzweigung ist nicht an den Step verkabelt',
		);
	});

	// run: |-Block entnehmen und ent-einruecken, damit er als eigenstaendiges Bash laeuft.
	const scriptOf = (): string => {
		const runIdx = stepText.indexOf('run: |');
		assert.ok(runIdx !== -1, 'run: |-Block in resolve-invoke nicht gefunden');
		const lines = stepText.slice(runIdx + 'run: |'.length).split('\n');
		const first = lines.find((l) => l.trim() !== '');
		const indent = first ? (first.match(/^\s*/) ?? [''])[0].length : 0;
		return lines
			.map((l) => (l.startsWith(' '.repeat(indent)) ? l.slice(indent) : l.trimStart()))
			.join('\n')
			.trim();
	};

	// Fuehrt resolve-invoke fuer (tier, needs-mcp) aus und liefert die geschriebenen invoke-args.
	const resolveArgs = (tier: string, needsMcp: string): string => {
		assert.ok(tierEnv, 'Tier-env fehlt — kann die Ableitung nicht ausfuehren');
		const dir = mkdtempSync(join(tmpdir(), 'invoke-'));
		const outFile = join(dir, 'out');
		const env = { ...process.env, GITHUB_OUTPUT: outFile, NEEDS_MCP: needsMcp } as Record<string, string>;
		env[tierEnv as string] = tier;
		execFileSync('bash', ['-c', scriptOf()], { env, cwd: REPO_ROOT });
		const out = readFileSync(outFile, 'utf8');
		const m = out.match(/^invoke-args=(.*)$/m);
		assert.ok(m, `invoke-args fuer tier=${tier} nicht geschrieben — resolve-invoke laeuft nicht fehlerfrei durch`);
		return m[1];
	};

	// Optionale Single-Quotes tolerieren: action.yml quotet die Tool-Liste (Werte enthalten
	// '('/'*'), das Literal darf das umschliessende '\'' nicht in den Extrakt uebernehmen.
	const allowedOf = (args: string): string[] =>
		(args.match(/--allowedTools\s+'?([^'\s]+)'?/)?.[1] ?? '').split(',').filter(Boolean);

	it('restricted: enges Toolset (Read/Grep/Glob + gh), kein Bypass, kein disallow', () => {
		const args = resolveArgs('restricted', 'true');
		const allowed = allowedOf(args);
		for (const t of ['Read', 'Glob', 'Grep']) assert.ok(allowed.includes(t), `restricted muss ${t} erlauben`);
		assert.ok(
			allowed.some((t) => /gh/.test(t)),
			'restricted muss Bash(gh *) erlauben (Triage arbeitet nur lesend via gh)',
		);
		assert.ok(
			!allowed.includes('Write') && !allowed.includes('Edit'),
			'restricted darf Write/Edit NICHT erlauben (enges Toolset)',
		);
		assert.ok(!/--dangerously-skip-permissions/.test(args), 'restricted darf NICHT bypassen (Tier 1 ohne Bypass)');
		assert.ok(!/--disallowedTools/.test(args), 'restricted braucht kein --disallowedTools — die Allow-Liste reicht');
	});

	it('full: Bypass + volles Toolset inkl. Write/Edit, kein disallow', () => {
		const args = resolveArgs('full', 'true');
		const allowed = allowedOf(args);
		assert.ok(/--dangerously-skip-permissions/.test(args), 'full muss bypassen (volle Autonomie)');
		assert.ok(
			allowed.includes('Write') && allowed.includes('Edit'),
			'full muss Write/Edit erlauben (Spec/Implement/Fixup sind vollautonom)',
		);
		assert.ok(!/--disallowedTools/.test(args), 'full darf --disallowedTools NICHT setzen');
	});

	it('review: Bypass, aber Write/Edit disallowed (Review aendert keinen Code)', () => {
		const args = resolveArgs('review', 'false');
		assert.ok(/--dangerously-skip-permissions/.test(args), 'review muss bypassen (sonst Autonomie-Verlust)');
		const dis = (args.match(/--disallowedTools\s+'?([^'\s]+)'?/)?.[1] ?? '').split(',');
		assert.ok(
			dis.includes('Write') && dis.includes('Edit'),
			`review muss --disallowedTools Write,Edit setzen (Review liest untrusted Diffs und darf nichts schreiben) — got: ${dis.join(',')}`,
		);
		assert.ok(allowedOf(args).includes('Read'), 'review muss lesen duerfen');
	});

	it('needs-mcp toggelt die MCP-Tools mit korrektem Servernamen', () => {
		const server = SERVERS[0];
		const withMcp = allowedOf(resolveArgs('full', 'true'));
		const withoutMcp = allowedOf(resolveArgs('full', 'false'));
		assert.ok(
			withMcp.some((t) => t.startsWith(`mcp__${server}__`)),
			`needs-mcp=true muss mcp__${server}__* in die Allow-Liste aufnehmen`,
		);
		assert.ok(!withoutMcp.some((t) => t.startsWith('mcp__')), 'needs-mcp=false darf KEINE mcp__-Tools erlauben');
	});
});

// ── AK3/4/5: jeder Workflow uebergibt sein Tier gemaess Policy ─────────────────────────

describe('Permission-Layer — jeder Claude-Workflow uebergibt das passende tools-tier', () => {
	// Triage = restricted (nur lesend via gh), Spec/Implement/Fixup = full (vollautonom),
	// Review = review (lesen ja, schreiben nein). Der Documenter nutzt kein Claude und faellt heraus.
	const POLICY: Record<string, string> = {
		'01-claude-triage.yml': 'restricted',
		'02-claude-spec.yml': 'full',
		'03-claude-implement.yml': 'full',
		'04-claude-pr-review.yml': 'review',
		'05-claude-pr-fixup.yml': 'full',
	};

	const callers = readdirSync(HERE)
		.filter((f) => f.endsWith('.yml'))
		.filter((f) => /uses:\s*\.\/\.github\/actions\/setup-claude/.test(read('.github', 'workflows', f)));

	it('alle Policy-Workflows rufen setup-claude auf', () => {
		for (const f of Object.keys(POLICY)) {
			assert.ok(callers.includes(f), `${f} nutzt setup-claude nicht — Policy-Eintrag verwaist`);
		}
	});

	for (const f of Object.keys(POLICY)) {
		it(`${f} uebergibt tools-tier=${POLICY[f]}`, () => {
			const yml = read('.github', 'workflows', f);
			const step = yml.slice(yml.indexOf('uses: ./.github/actions/setup-claude')).split(/\n\s{6}- /)[0];
			const passed = step.match(/^\s*tools-tier:\s*['"]?(\w+)['"]?/m)?.[1];
			assert.equal(
				passed,
				POLICY[f],
				`${f} muss tools-tier=${POLICY[f]} setzen — Triage eng, Review lesend, der Rest vollautonom (got: ${passed ?? '<fehlt>'})`,
			);
		});
	}
});

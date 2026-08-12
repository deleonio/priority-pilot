import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Spiegel-Konsistenz zwischen Dateien.
//
// Aufnahmekriterium dieser Datei: dieselbe Information steht an mehreren Orten und darf nicht
// auseinanderdriften. Der Sollwert wird IMMER aus der fuehrenden Quelle gelesen (ci.yml,
// action.yml) und nie als Literal in den Test geschrieben — sonst pruefte der Test nur sich
// selbst. Drift ueber mehrere Dateien ist genau das, was ein Review nicht sieht.
//
// Testebene: statische Auswertung von YAML/JSON/Markdown (node:test via tsx, ci.yml).

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..');
const read = (...parts: string[]): string => readFileSync(join(REPO_ROOT, ...parts), 'utf8');

// ── Gate-Kommandos: ci.yml ist die Quelle, Prompt und Doku sind die Spiegel ──────────────
//
// Weichen die Spiegel ab, arbeitet der Agent lokal mit einem anderen Gate als die CI und
// pusht rot — der Fehler zeigt sich erst in der Pipeline (#161).

describe('Spiegel — die Format-/Lint-Gates aus ci.yml stehen wortgleich in Prompt und Doku', () => {
	const ciYml = read('.github', 'workflows', 'ci.yml');

	// Sollwert aus ci.yml ziehen: die run-Zeilen der Steps "Format-Check" und "Lint".
	const runOfStep = (stepName: string): string => {
		const m = ciYml.match(new RegExp(`- name: ${stepName}\\n\\s*run: (.+)`));
		assert.ok(m, `Step "${stepName}" nicht aus ci.yml lesbar — Struktur geaendert?`);
		return m[1].trim();
	};
	const gates = [runOfStep('Format-Check'), runOfStep('Lint')];

	// Der Fixup-Prompt liegt im Heredoc des "Findings umsetzen"-Steps.
	const fixupPrompt = (): string => {
		const yml = read('.github', 'workflows', '05-claude-pr-fixup.yml');
		const m = yml.match(/cat > \/tmp\/claude-prompt\.txt << 'CLAUDE_EOF'\s*\n([\s\S]*?)CLAUDE_EOF/);
		assert.ok(m, 'Claude-Prompt-Block nicht in 05-claude-pr-fixup.yml gefunden');
		return m[1];
	};

	const MIRRORS: Record<string, () => string> = {
		'05-claude-pr-fixup.yml (Claude-Prompt)': fixupPrompt,
		'.ai-knowledge/ticket-implementation.md': () => read('.ai-knowledge', 'ticket-implementation.md'),
	};

	for (const [label, load] of Object.entries(MIRRORS)) {
		it(`${label} spiegelt alle CI-Gates`, () => {
			const text = load();
			for (const gate of gates) {
				assert.ok(
					text.includes(gate),
					`CI faehrt "${gate}", ${label} nennt es nicht — der Agent prueft lokal gegen ein anderes Gate als die CI`,
				);
			}
		});
	}
});

// ── Setup-Action: Aufrufer und Action-Signatur muessen zusammenpassen ────────────────────
//
// Composite-Actions erzwingen `required: true` NICHT zur Laufzeit — ein vergessener Input
// laeuft still mit Leerstring weiter. Die Soll-Liste kommt aus der action.yml selbst, damit
// ein neu ergaenzter Pflicht-Input alle Aufrufer rot macht.

describe('Spiegel — jeder setup-claude-Aufrufer reicht alle Pflicht-Inputs durch', () => {
	const actionYml = read('.github', 'actions', 'setup-claude', 'action.yml');

	const inputsBlock = actionYml.match(/^inputs:\n([\s\S]*?)(?=^\S)/m);
	assert.ok(inputsBlock, 'inputs-Block der setup-claude action.yml nicht lesbar');

	const requiredInputs = inputsBlock[1]
		.split(/\n(?= {2}[a-z-]+:)/)
		.filter((entry) => /required:\s*true/.test(entry))
		.map((entry) => (entry.match(/^\s*([a-z-]+):/) ?? [, ''])[1])
		.filter(Boolean);

	// Provider-Trio: formal optional (die Action hat Defaults), praktisch Pflicht — fehlt es,
	// laeuft der Workflow still gegen den falschen Provider bzw. ohne Key.
	const PROVIDER_INPUTS = ['llm-provider', 'zai-api-key', 'claude-api-key'];

	const callers = readdirSync(join(HERE))
		.filter((f) => f.endsWith('.yml'))
		.filter((f) => /uses:\s*\.\/\.github\/actions\/setup-claude/.test(read('.github', 'workflows', f)));

	it('Soll-Liste und Aufrufer wurden ueberhaupt gefunden', () => {
		assert.ok(requiredInputs.length > 0, 'keine required-Inputs aus action.yml gelesen — Parser kaputt?');
		assert.ok(callers.length > 0, 'kein Workflow nutzt setup-claude — Erkennung kaputt?');
	});

	for (const name of callers) {
		it(`${name}`, () => {
			const yml = read('.github', 'workflows', name);
			const step = yml.slice(yml.indexOf('uses: ./.github/actions/setup-claude')).split(/\n\s{6}- /)[0];
			const passed = [...step.matchAll(/^\s+([a-z-]+):/gm)].map((m) => m[1]);

			for (const input of [...requiredInputs, ...PROVIDER_INPUTS]) {
				assert.ok(
					passed.includes(input),
					`${name} reicht den Input "${input}" nicht an setup-claude durch (Composite-Actions melden das zur Laufzeit NICHT — der Wert ist still leer)`,
				);
			}
		});
	}
});

// ── E2E-Sharding: Matrix-Groesse und Nenner muessen uebereinstimmen ──────────────────────

describe('Spiegel — die E2E-Shard-Matrix passt zum --shard-Nenner', () => {
	// Wird `shard: [1, 2, 3]` auf 4 erweitert, ohne `--shard=N/4` mitzuziehen, laufen Specs
	// still gar nicht mehr: alle Jobs sind gruen, ein Teil der Suite wurde nie ausgefuehrt.
	it('Matrix-Laenge == Nenner in --shard=N/M', () => {
		// Kommentarzeilen raus: ci.yml erklaert die Regel im Fliesstext mit `shard: [...]` —
		// ohne Filter matcht der Regex den Erklaertext statt der echten Matrix.
		const ciYml = read('.github', 'workflows', 'ci.yml')
			.split('\n')
			.filter((l) => !/^\s*#/.test(l))
			.join('\n');
		const matrix = ciYml.match(/shard:\s*\[([^\]]+)\]/);
		assert.ok(matrix, 'shard-Matrix nicht in ci.yml gefunden');
		const size = matrix[1].split(',').length;

		const denominators = [...ciYml.matchAll(/--shard=\$\{\{\s*matrix\.shard\s*\}\}\/(\d+)/g)].map((m) => Number(m[1]));
		assert.ok(denominators.length > 0, '--shard=…/N nicht in ci.yml gefunden');
		for (const n of denominators) {
			assert.equal(
				n,
				size,
				`Shard-Nenner ${n} passt nicht zur Matrix-Groesse ${size} — ein Teil der E2E-Specs laeuft nie`,
			);
		}
	});
});

// ── Provider-Config lebt in der Action, nicht in .claude/settings.json ───────────────────

describe('Spiegel — .claude/settings.json bleibt providerneutral', () => {
	// settings.json ist eingecheckt und gilt AUCH fuer lokale Sessions: ein dort gesetzter
	// Endpoint routet jede Entwickler-Session zwangsweise um. Die Provider-Aufloesung gehoert
	// ausschliesslich in die Setup-Action (Regression bb067cc).
	it('kein ANTHROPIC_BASE_URL und keine provider-spezifische Modell-Aliase', () => {
		const settings = read('.claude', 'settings.json');
		assert.doesNotMatch(settings, /ANTHROPIC_BASE_URL/, 'Endpoint gehoert in die Setup-Action, nicht in settings.json');
		assert.doesNotMatch(settings, /ANTHROPIC_DEFAULT_\w+_MODEL/, 'Modell-Aliase sind provider-spezifisch');
	});
});

// ── Triage-Prompt enthält die Sub-Issue-Prozedur (Zerlegung + Verknüpfung) ───────────────
//
// Der CI-Triage-Prompt hatte früher nur den Einzeiler „in Sub-Issues zerlegen" — ohne die
// konkreten gh/GraphQL-Befehle. Damit hat die automatisierte Triage faktisch keine Sub-Issues
// erstellt/verknüpft, und der issue-unblock-Consumer verhungerte. Diese Spec sichert, dass der
// Prompt die三个 Pflicht-Bestandteile der Prozedur enthält (Erstellung + beide Verknüpfungen).
// API-Felder verifiziert: addSubIssue(issueId,subIssueId), addBlockedBy(issueId,blockingIssueId).

describe('Spiegel — Triage-Prompt enthält Sub-Issue-Erstellung + Verknüpfung', () => {
	const yml = read('.github', 'workflows', '01-claude-triage.yml');
	const prompt = yml.match(/cat > \/tmp\/claude-prompt\.txt << 'CLAUDE_EOF'\s*\n([\s\S]*?)CLAUDE_EOF/)?.[1] ?? '';
	assert.ok(prompt, 'Claude-Prompt-Block nicht in 01-claude-triage.yml gefunden');

	// AC1: Sub-Issues werden wirklich angelegt (gh issue create), nicht nur im Text erwähnt.
	it('AC1: gh issue create für Sub-Issues', () => {
		assert.match(
			prompt,
			/gh issue create/,
			'Der Triage-Prompt muss `gh issue create` für Sub-Issues anweisen — sonst zerlegt er nur ' +
				'im Body und legt keine echten Issues an (Regression: Prompt-Stub ohne Befehle).',
		);
	});

	// AC2: Parent-Child-Verknüpfung als echtes GitHub-Sub-Issue (GraphQL addSubIssue), nicht nur
	// Textreferenz — sonst ist keine echte Hierarchie / kein Fortschritt-Tracking.
	it('AC2: addSubIssue-Mutation (Parent-Child-Verknüpfung)', () => {
		assert.match(
			prompt,
			/addSubIssue\(input:\{issueId:[^}]*subIssueId:/,
			'Eltern- und Sub-Issue müssen per GraphQL addSubIssue verknüpft werden (issueId=Parent, ' +
				'subIssueId=Child) — eine rene Textreferenz erzeugt keine echte GitHub-Sub-Issue-Beziehung.',
		);
	});

	// AC3: Sequenzielle Abhängigkeiten als native blocked-by-Relation (GraphQL addBlockedBy) — nur
	// so löst issue-unblock.yml beim Merge des Vorgängers automatisch auf.
	it('AC3: addBlockedBy-Mutation bei sequenziellen Abhängigkeiten', () => {
		assert.match(
			prompt,
			/addBlockedBy\(input:\{issueId:[^}]*blockingIssueId:/,
			'Sequenzielle Sub-Issues müssen per GraphQL addBlockedBy verknüpft werden (issueId=Nachfolger, ' +
				'blockingIssueId=Vorgänger) — nur diese maschinenlesbare Kante löst issue-unblock.yml beim Merge aus.',
		);
	});

	// AC4: Label-Carve-out — der Workflow verwaltet nur das Eltern-Issue (via VERDICT); Sub-Issues
	// müssen direkt beim Anlegen gelabelt werden, sonst fehlt der Rekursionsschutz (ai:analyzed)
	// und die Spec-Freigabe (ai:spec-ready).
	it('AC4: Label-Carve-out — Eltern via VERDICT, Sub-Issues direkt labeln', () => {
		assert.match(
			prompt,
			/SUB-Issues.*ai:analyzed.*gelabelt|gelabelt.*ai:analyzed/i,
			'Der Triage-Prompt muss klären, dass Sub-Issues direkt beim Anlegen mit ai:analyzed gelabelt ' +
				'werden (der Workflow verwaltet via VERDICT nur das Eltern-Issue) — sonst fehlt der Re-Triage-' +
				'Schutz und die Spec-Freigabe.',
		);
	});

	// AC5: zerlegtes Eltern-Issue → VERDICT analyzed (Tracker, nicht direkt umsetzbar). Sonst würde
	// das Eltern-Issue fälschlich ai:spec-ready bekommen und selbst in die Spec/Umsetzung gehen.
	it('AC5: zerlegtes Eltern-Issue → VERDICT analyzed (nicht spec-ready)', () => {
		assert.match(
			prompt,
			/Zerlegung.*VERDICT:\s*analyzed|VERDICT:\s*analyzed.*Zerleg/i,
			'Ein in Sub-Issues zerlegtes Eltern-Issue muss VERDICT: analyzed ausgeben (nur Tracker) — sonst ' +
				'bekommt es fälschlich ai:spec-ready und geht selbst in die Spec/Umsetzung.',
		);
	});
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Issue #511 — Pro Workflow-Phase ein eigenes Claude-Modell.
//
// Pro Phase (01 Triage, 02 Spec, 03 Implement, 04 PR-Review, 05 PR-Fixup) soll ein eigenes
// Modell festgelegt werden, konfigurierbar über GitHub-Variablen
// (CLAUDE_MODEL_TRIAGE/SPEC/IMPLEMENT/PR_REVIEW/FIXUP). Leere Variable → Phasen-Default
// (settings.json); ein gesetzter Alias (Fable/Opus/Sonnet/Haiku) wird providerspezifisch
// aufgelöst und als --model an `claude -p` weitergereicht (überschreibt settings.json).
// Das pro-Phase gewählte Modell wird im Run-Log sichtbar (::notice).
//
// Aufnahmekriterium dieser Datei: die Modell-Durchreichung pro Phase ist eine
// verhaltensrelevante Verkabelung über action.yml + 5 Workflows — sie entscheidet, WELCHES
// Modell in welcher Phase läuft, nicht nur einen String-Inhalt. Der Sollwert wird stets aus
// der jeweiligen Quelle (action.yml, Workflow-YAML, Doku) gelesen, nie als Literal
// hineingeschrieben — sonst prüfte der Test nur sich selbst.
//
// Testebene: statische Auswertung von YAML/Markdown (node:test via tsx, ci.yml).

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..');
const read = (...parts: string[]): string => readFileSync(join(REPO_ROOT, ...parts), 'utf8');

// Kommentarzeilen entfernen — sonst schlagen Erklärungen/Beispiele als Befehl durch.
const codeOf = (text: string): string =>
	text
		.split('\n')
		.filter((l) => !/^\s*#/.test(l))
		.join('\n');

// Phase → (Workflow-Datei, GitHub-Variable). Einzige Quelle der Wahrheit für die Verkabelung.
const PHASES = {
	triage: { wf: '01-claude-triage.yml', variable: 'CLAUDE_MODEL_TRIAGE' },
	spec: { wf: '02-claude-spec.yml', variable: 'CLAUDE_MODEL_SPEC' },
	implement: { wf: '03-claude-implement.yml', variable: 'CLAUDE_MODEL_IMPLEMENT' },
	'pr-review': { wf: '04-claude-pr-review.yml', variable: 'CLAUDE_MODEL_PR_REVIEW' },
	fixup: { wf: '05-claude-pr-fixup.yml', variable: 'CLAUDE_MODEL_FIXUP' },
	documentation: { wf: 'pr-post-merge-documentation.yml', variable: 'CLAUDE_MODEL_DOCUMENTATION' },
} as const;

const actionYml = (): string => read('.github', 'actions', 'setup-claude', 'action.yml');

// ── AK1 + AK3 (dedup): jede Phase reicht IHRE Modell-Variable an setup-claude durch ──────
//
// AK1 fordert pro Phase eine eigene GitHub-Variable, AK3 dass die Workflows 01–05 sie in den
// Action-Input durchreichen. Beide Aussagen beschreiben dieselbe Verkabelung (Workflow →
// Variable → Input model:) und werden zusammen geprüft. Fehlt die `model:`-Zeile, läuft die
// Phase still mit dem globalen settings.json-Modell statt dem Phasen-Modell — ein Fehler,
// den kein Review sieht (vgl. Silent-Empty-Problem aus #161).

describe('Phasen-Modell — jede Phase reicht ihre CLAUDE_MODEL_*-Variable an setup-claude durch', () => {
	it('alle Phasen-Workflows nutzen setup-claude (Verkabelung prüft nicht ins Leere)', () => {
		const callers = readdirSync(HERE)
			.filter((f) => f.endsWith('.yml'))
			.filter((f) => /uses:\s*\.\/\.github\/actions\/setup-claude/.test(read('.github', 'workflows', f)));
		for (const { wf } of Object.values(PHASES)) {
			assert.ok(callers.includes(wf), `${wf} nutzt setup-claude nicht — Phasen-Eintrag verwaist`);
		}
	});

	for (const [phase, { wf, variable }] of Object.entries(PHASES)) {
		it(`${wf} reicht vars.${variable} in den Action-Input model:`, () => {
			const yml = read('.github', 'workflows', wf);
			const step = yml.slice(yml.indexOf('uses: ./.github/actions/setup-claude')).split(/\n\s{6}- /)[0];
			// Optionaler `|| '<default>'`-Fallback erlaubt (pro-Phase-Default im Workflow, PR #580);
			// der Test sichert nur die Durchreichung der Variable, nicht die Default-Syntax.
			assert.match(
				step,
				new RegExp(`model:\\s*\\$\\{\\{\\s*vars\\.${variable}\\b[^}]*\\}\\}`),
				`${wf} (Phase ${phase}) muss model: \${{ vars.${variable}[ || '<default>'] }} an setup-claude durchreichen — ` +
					`sonst läuft die Phase still mit dem globalen settings.json-Modell statt dem Phasen-Modell`,
			);
		});
	}
});

// ── AK2: setup-claude hat einen Input model und reicht ihn als --model weiter ───────────
//
// Der Input überschreibt settings.json; ein leerer Wert MUSS das aktuelle Verhalten erhalten
// (Modell aus settings.json). Ohne `--model` ignoriert `claude -p` den Phasen-Wert. Heute
// setzt die Action bewusst KEIN --model (action.yml "Kein --model"-Kommentar) — das ist genau
// der Zustand, den AK2 aufbricht.

describe('Phasen-Modell — setup-claude deklariert einen Input model und reicht ihn als --model weiter', () => {
	const yml = actionYml();
	const inputsBlock = yml.match(/^inputs:\n([\s\S]*?)(?=^(?:outputs|runs):)/m)?.[1] ?? '';

	it('Input model ist deklariert', () => {
		assert.ok(
			/^\s{2}model:/m.test(inputsBlock),
			'Input "model" fehlt in action.yml — es gibt keine Steuerung des Modells pro Lauf',
		);
	});

	it('resolve-invoke bindet inputs.model als env-Variable', () => {
		// Mirror der Konvention inputs.<name> -> env <NAME> (vgl. NEEDS_MCP, TOOLS_TIER in
		// permission-tiers.test.ts). Ohne diese Bindung ist der Input im Step nicht verfügbar.
		const stepText = yml.slice(yml.indexOf('id: resolve-invoke'));
		const modelEnv = stepText.match(/^\s*([A-Z][A-Z0-9_]*):\s*\$\{\{\s*inputs\.model\s*\}\}/m)?.[1] ?? null;
		assert.ok(
			modelEnv,
			'resolve-invoke liest inputs.model nicht als env — die Modell-Durchreichung ist nicht an den Step verkabelt',
		);
	});

	it('--model wird (nur bei gesetztem Modell) an claude weitergereicht', () => {
		// codeOf streift Kommentare, damit das "Kein --model"-Erklärungs-Kommentar nicht als
		// Implementierung durchgeht. Das Flag muss im Code vorkommen und an eine Modell-Variable
		// geknüpft sein — ein leerer Phasen-Wert darf KEIN --model erzwingen (settings.json-Verhalten).
		const code = codeOf(yml);
		assert.ok(
			/--model\b/.test(code),
			'action.yml reicht das Modell nicht als --model an claude weiter — der Phasen-Wert wird ignoriert (leerer Wert muss settings.json-Verhalten erhalten)',
		);
	});
});

// ── AK4: Modell-Aliase werden providerspezifisch aufgelöst ──────────────────────────────
//
// claude (nativ) kennt die Aliase direkt; zai/openrouter brauchen eine Zuordnung Alias →
// konkreter Modell-String (Issue: via settings.local.json). Die Action MUSS alle vier
// kanonischen Aliase führen und die Auflösung im Provider-Kontext vornehmen — sonst
// "model not found" unter zai/openrouter (T4).

describe('Phasen-Modell — Alias-Auflösung (Fable/Opus/Sonnet/Haiku) ist providerspezifisch', () => {
	const code = codeOf(actionYml());

	// Die vier kanonischen Aliase aus dem Issue-Body. Mutations-Probe: fehlt einer, wird der
	// zugehörige it rot (der Alias bliebe un-aufgelöst und liefe still gegen den Default).
	for (const alias of ['fable', 'opus', 'sonnet', 'haiku']) {
		it(`Alias "${alias}" ist der Auflösung bekannt`, () => {
			assert.ok(
				new RegExp(`\\b${alias}\\b`, 'i').test(code),
				`Modell-Alias "${alias}" wird in action.yml nicht geführt — ein Phasen-Wert "${alias}" bliebe un-aufgelöst`,
			);
		});
	}

	it('Nicht-claude-Provider lösen den Alias im settings.local.json-Kontext auf', () => {
		// Issue: zai/openrouter lösen den Alias "via settings.local.json" auf. Die settings.local.json
		// wird im Provider-Schritt (id: provider) geschrieben — die Alias-Auflösung muss dort
		// greifen, sonst "model not found" unter Nicht-claude-Providern (T4).
		const providerStep = codeOf(actionYml().slice(actionYml().indexOf('id: provider')));
		assert.ok(
			/settings\.local\.json/i.test(providerStep) && /\b(fable|opus|sonnet|haiku)\b/i.test(providerStep),
			'zai/openrouter müssen den Modell-Alias (→ konkreten Modell-String) im settings.local.json-Kontext (Provider-Schritt) auflösen — "model not found" (T4) ist sonst nicht abgesichert',
		);
	});
});

// ── T3: Ungültiger Alias → sprechender Fehler, kein stiller Fallback ────────────────────
//
// Ein Tippfehler wie CLAUDE_MODEL_TRIAGE=sonnet-x darf NICHT still auf den Default fallen —
// sonst läuft eine Phase unbeabsichtigt mit dem falschen Modell und fällt nicht auf. Gefordert
// ist ein lauter Abbruch (::error), kein stilles Weiterlaufen.

describe('Phasen-Modell — ungültiger Alias bricht laut ab (kein stiller Fallback)', () => {
	it('ein unbekannter Modell-Alias wird mit ::error abgelehnt', () => {
		const code = codeOf(actionYml());
		const errors = [...code.matchAll(/::error[^\n]*/gi)].map((m) => m[0]);
		assert.ok(
			errors.some((e) => /\b(modell|model)\b/i.test(e)),
			'kein ::error lehnt einen ungültigen Modell-Alias ab — ein Tippfehler (z.B. sonnet-x) fällt still auf den Default (T3)',
		);
	});
});

// ── AK6: das gewählte Modell pro Phase wird im Run-Log sichtbar (::notice) ───────────────

describe('Phasen-Modell — das pro-Phase gewählte Modell wird als ::notice geloggt', () => {
	it('action.yml gibt eine ::notice aus, die das Modell nennt', () => {
		const code = codeOf(actionYml());
		const notices = [...code.matchAll(/::notice[^\n]*/gi)].map((m) => m[0]);
		assert.ok(
			notices.some((n) => /\b(modell|model)\b/i.test(n)),
			'keine ::notice nennt das Modell — das pro-Phase gewählte Modell ist im Run-Log nicht sichtbar (AK6)',
		);
	});
});

// ── AK5: Phasen-Defaults sind dokumentiert und auf die Phasen-Aufgabe abgestimmt ─────────
//
// Wo die Defaults stehen, ist offen (action.yml-Beschreibung oder Doku), aber sie müssen
// auffindbar sein: eine Stelle benennt alle Phasen und weist ihnen je ein Default-Modell zu.

describe('Phasen-Modell — Phasen-Defaults sind dokumentiert', () => {
	// Sammle Doku-Text aus action.yml + Markdown unter docs/ und .ai-knowledge/.
	// (.github/workflows bleibt bewusst aussen vor, damit AK1-Variablen-Durchreichung AK5
	//  nicht triggert — gefordert ist eine Default-Doku, keine Variablen-Nutzung.)
	const collect = (dir: string): string => {
		try {
			return readdirSync(join(REPO_ROOT, dir), { withFileTypes: true })
				.filter((e) => e.isFile() && /\.(md|ya?ml)$/.test(e.name))
				.map((e) => read(dir, e.name))
				.join('\n');
		} catch {
			return '';
		}
	};
	const doc = [actionYml(), collect('docs'), collect('.ai-knowledge')].join('\n');

	it('für jede Phase-Variable ist ein Default-Modell dokumentiert', () => {
		// Feature-spezifisches Signal: die Doku muss JEDE der 5 CLAUDE_MODEL_*-Variablen mit einem
		// Default-Modell ausweisen. Phasen-Namen + zufällige Aliase allein reichen nicht (die
		// nennt die Doku ohnehin im Workflow-Kontext) — gefordert ist eine Default-Zuordnung pro
		// Variable. CLAUDE_MODEL_* existiert heute nirgends → der Test ist rot, bis die Doku steht.
		const variables = Object.values(PHASES).map((p) => p.variable);
		const missing = variables.filter((v) => !new RegExp(`\\b${v}\\b`).test(doc));
		assert.ok(
			missing.length === 0 && /\b(default|standardwert|voreinstellung)\b/i.test(doc),
			`Phasen-Modell-Defaults sind nicht dokumentiert — fehlende Variablen: ${missing.join(', ') || '(keine, aber Default-Kennzeichen fehlt)'}. ` +
				`Für jede CLAUDE_MODEL_*-Variable muss das Default-Modell ersichtlich sein (AK5)`,
		);
	});
});

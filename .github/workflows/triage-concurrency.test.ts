import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Vertrag-Tests — Selbst-Abbruch durch `concurrency` (Issue #485).
//
// Beobachtung: Die Triage lief durch, gab `VERDICT: spec-ready` aus und wurde 16 s später
// gecancelt — der Label-Step lief nie, `ai:spec-ready` blieb ungesetzt.
//
//   01:26:13  Triage startet (unlabeled ai:analyzed) → Gruppe "…-true"
//   01:27:49  Agent postet seinen Ping-Kommentar (Prompt-Schritt 6)
//   01:27:51  issue_comment-Run entsteht → Gruppe "…-true"  ← DIESELBE
//   01:28:05  laufende Triage gecancelt; der neue Run wird per job-if übersprungen
//
// Root Cause: GitHub wertet `concurrency` auf RUN-Ebene aus, BEVOR das job-if greift. Ein
// Run, der anschliessend übersprungen wird, cancelt trotzdem. Der Gruppen-Ausdruck enthielt
// ein pauschales `github.event_name == 'issue_comment'`.
//
// Fix: der issue_comment-Trigger ist ersatzlos entfallen (die @hermes-Konvention gibt es
// nicht mehr, und Bot-Kommentare sollen nichts anstoßen). Diese Datei sichert beides ab:
// den fehlenden Trigger UND die allgemeine Invariante, dass ein Skip-Run nie die Gruppe
// eines Arbeits-Runs teilt — damit ein künftig ergänzter Trigger nicht dieselbe Falle stellt.
//
// Testebene: statische YAML-Auswertung — Gruppen-Ausdruck und job-if werden gegen echte
// Event-Payloads ausgewertet (node:test via tsx, ci.yml Z. 102).

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKFLOW = join(HERE, '01-claude-triage.yml');

type Ctx = { event_name: string; event: Record<string, unknown> };

// ── Mini-Evaluator für den GitHub-Expression-Subset, den dieser Workflow nutzt ──────────
// Unterstützt: github.<pfad> (inkl. .*.-Filter), String-Literale, ==, &&, ||, !, contains().
// Bewusst klein gehalten — er muss nur diesen einen Workflow abbilden.

const resolvePath = (ctx: Ctx, path: string): unknown => {
	const segments = path.split('.').slice(1); // führendes "github" verwerfen
	let cur: unknown = { event_name: ctx.event_name, event: ctx.event };
	for (let i = 0; i < segments.length; i++) {
		if (segments[i] === '*') {
			// Filter-Syntax: labels.*.name → alle name-Felder der Liste
			const rest = segments.slice(i + 1);
			if (!Array.isArray(cur)) return [];
			return cur.map((item) => rest.reduce<unknown>((a, s) => (a as Record<string, unknown>)?.[s], item));
		}
		if (cur == null) return undefined;
		cur = (cur as Record<string, unknown>)[segments[i]];
	}
	return cur;
};

const evalExpression = (expr: string, ctx: Ctx): unknown => {
	const js = expr
		// Pfade zuerst — längste Übereinstimmung durch den greedy Gruppen-Quantifier.
		.replace(/github(?:\.(?:\*|[A-Za-z_][A-Za-z0-9_]*))+/g, (m) => JSON.stringify(resolvePath(ctx, m) ?? null))
		.replace(/\bcontains\s*\(/g, '__contains(')
		.replace(/([^=!<>])==([^=])/g, '$1===$2')
		.replace(/!=([^=])/g, '!==$1');
	const contains = (haystack: unknown, needle: unknown): boolean =>
		Array.isArray(haystack) ? haystack.includes(needle) : String(haystack).includes(String(needle));
	return new Function('__contains', `return (${js});`)(contains);
};

// Ersetzt alle ${{ … }}-Interpolationen — so wie GitHub den group-String bildet.
const interpolate = (template: string, ctx: Ctx): string =>
	template.replace(/\$\{\{([\s\S]*?)\}\}/g, (_, inner: string) => String(evalExpression(inner.trim(), ctx)));

// ── Workflow laden ──────────────────────────────────────────────────────────────────────
// Bewusst per Regex statt via yaml-Paket: die Workflow-Vertragstests laufen über
// `pnpm dlx tsx` AUSSERHALB der pnpm-Workspaces (ci.yml Z. 102) und haben keine Dependencies.

const YML = readFileSync(WORKFLOW, 'utf8');

const extract = (re: RegExp, what: string): string => {
	const m = YML.match(re);
	assert.ok(m, `${what} nicht aus 01-claude-triage.yml extrahierbar — Struktur geändert?`);
	return m[1];
};

const groupTemplate = extract(/^concurrency:\n {2}group: >-\n {4}(.+)$/m, 'concurrency.group');
const cancelInProgress = extract(/^ {2}cancel-in-progress: (\w+)$/m, 'cancel-in-progress') === 'true';
const jobIf = extract(/^ {2}triage:\n {4}if: >-\n([\s\S]*?)\n {4}runs-on:/m, 'jobs.triage.if');

// Top-Level-Trigger unter `on:` — alle mit genau zwei Leerzeichen eingerückten Schlüssel.
const onBlock = extract(/^on:\n((?: {2}\S[\s\S]*?)?)(?=^\S)/m, 'on-Block');
const triggers = [...onBlock.matchAll(/^ {2}([a-z_]+):/gm)].map((m) => m[1]);

const groupFor = (ctx: Ctx): string => interpolate(groupTemplate, ctx).trim();
const runsFor = (ctx: Ctx): boolean => evalExpression(jobIf.replace(/\$\{\{|\}\}/g, ''), ctx) === true;

// ── Event-Payloads aus dem echten Vorfall ───────────────────────────────────────────────

const ISSUE = { number: 485, state: 'open', author_association: 'OWNER', labels: [] as { name: string }[] };

const SCENARIOS: Record<string, Ctx> = {
	// Der Run, der die Arbeit macht (01:26:13).
	unlabeledAnalyzed: {
		event_name: 'issues',
		event: { action: 'unlabeled', issue: ISSUE, label: { name: 'ai:analyzed' } },
	},
	unlabeledToBig: {
		event_name: 'issues',
		event: { action: 'unlabeled', issue: ISSUE, label: { name: 'ai:to-big-issue' } },
	},
	// Gleichzeitig entferntes zweites Label (01:26:12) — darf die Arbeit nicht killen.
	unlabeledSpecReady: {
		event_name: 'issues',
		event: { action: 'unlabeled', issue: ISSUE, label: { name: 'ai:spec-ready' } },
	},
	newIssue: {
		event_name: 'issues',
		event: { action: 'opened', issue: ISSUE },
	},
	// Neues Issue, das bereits analysiert ist → kein Lauf (Rekursionsschutz).
	newIssueAlreadyAnalyzed: {
		event_name: 'issues',
		event: { action: 'opened', issue: { ...ISSUE, labels: [{ name: 'ai:analyzed' }] } },
	},
	// Geschlossenes Issue → kein Lauf.
	closedIssue: {
		event_name: 'issues',
		event: { action: 'unlabeled', issue: { ...ISSUE, state: 'closed' }, label: { name: 'ai:analyzed' } },
	},
};

describe('AK1 — Kommentare stoßen gar nichts an (kein issue_comment-Trigger)', () => {
	it('`on:` enthält keinen issue_comment-Trigger', () => {
		assert.deepEqual(
			triggers.sort(),
			['issues'],
			'Ein issue_comment-Trigger würde Bot-Kommentare wieder Runs erzeugen lassen',
		);
	});

	it('weder Gruppe noch job-if referenzieren issue_comment oder @hermes (kein toter Code)', () => {
		const active = YML.split('\n')
			.filter((l) => !l.trimStart().startsWith('#'))
			.join('\n');
		assert.doesNotMatch(active, /issue_comment/, 'issue_comment darf in aktiver Konfiguration nicht mehr vorkommen');
		assert.doesNotMatch(active, /@hermes/, 'Die @hermes-Konvention existiert nicht mehr');
	});
});

describe('AK2 — Evaluator bildet das job-if korrekt ab', () => {
	const EXPECTED_RUNS: Record<string, boolean> = {
		unlabeledAnalyzed: true,
		unlabeledToBig: true,
		unlabeledSpecReady: false,
		newIssue: true,
		newIssueAlreadyAnalyzed: false,
		closedIssue: false,
	};

	for (const [name, expected] of Object.entries(EXPECTED_RUNS)) {
		it(`${name} → job-if = ${expected}`, () => {
			assert.equal(runsFor(SCENARIOS[name]), expected);
		});
	}
});

describe('AK3 — Kein Skip-Run teilt die Gruppe eines Arbeits-Runs (Selbst-Abbruch-Schutz)', () => {
	it('cancel-in-progress ist aktiv — sonst wäre dieser Vertrag gegenstandslos', () => {
		assert.equal(cancelInProgress, true);
	});

	// Drift-Schutz: die Invariante unten prüft nur die hier eingetragenen Szenarien. Sind die
	// beiden Ausdrücke identisch, gilt sie für JEDES denkbare Event — auch ungetestete.
	it('der Gruppen-Ausdruck ist zeichengleich mit dem job-if', () => {
		const normalize = (s: string): string =>
			s
				.replace(/\$\{\{|\}\}/g, '')
				.replace(/\s+/g, ' ')
				.trim();
		const groupExpr = groupTemplate.match(/\}\}-(\$\{\{[\s\S]*\}\})\s*$/);
		assert.ok(groupExpr, 'Boolean-Teil des Gruppen-Ausdrucks nicht gefunden');
		assert.equal(
			normalize(groupExpr[1]),
			normalize(jobIf),
			'Gruppe und job-if sind auseinandergedriftet — ein Skip-Run könnte wieder in der Arbeits-Gruppe landen',
		);
	});

	// Die Kern-Invariante. Sie deckt auch künftig ergänzte Trigger ab, sofern sie hier
	// als Szenario eingetragen werden.
	it('für JEDES Paar (läuft, wird übersprungen) unterscheiden sich die Gruppen', () => {
		const running = Object.entries(SCENARIOS).filter(([, c]) => runsFor(c));
		const skipped = Object.entries(SCENARIOS).filter(([, c]) => !runsFor(c));
		assert.ok(running.length > 0 && skipped.length > 0, 'Matrix braucht beide Sorten');

		for (const [rName, rCtx] of running) {
			for (const [sName, sCtx] of skipped) {
				assert.notEqual(
					groupFor(sCtx),
					groupFor(rCtx),
					`"${sName}" wird übersprungen, teilt aber die Gruppe von "${rName}" (${groupFor(rCtx)}) — ` +
						`der Skip-Run würde die laufende Arbeit canceln`,
				);
			}
		}
	});

	it('Regression #485: das zweite gleichzeitig entfernte Label cancelt die Triage nicht', () => {
		assert.notEqual(
			groupFor(SCENARIOS.unlabeledSpecReady),
			groupFor(SCENARIOS.unlabeledAnalyzed),
			'ai:analyzed und ai:spec-ready werden zusammen entfernt — nur ersteres startet Arbeit',
		);
	});

	it('echte Re-Triage-Trigger lösen einander weiterhin ab (gewollter Supersede)', () => {
		assert.equal(
			groupFor(SCENARIOS.unlabeledToBig),
			groupFor(SCENARIOS.unlabeledAnalyzed),
			'Zwei Re-Triage-Anlässe sollen sich ablösen, nicht parallel laufen',
		);
	});

	it('die Gruppe ist pro Issue getrennt', () => {
		const other: Ctx = {
			...SCENARIOS.unlabeledAnalyzed,
			event: { ...SCENARIOS.unlabeledAnalyzed.event, issue: { ...ISSUE, number: 999 } },
		};
		assert.notEqual(groupFor(other), groupFor(SCENARIOS.unlabeledAnalyzed));
	});
});

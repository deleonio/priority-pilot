import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Issue #544 — `ai:needs-human` blockiert alle automatischen Workflows.
//
// Dies ist ein DOKUMENTATIONS-/Verhaltensticket: die Blockade ist im aktuellen Code bereits
// korrekt umgesetzt (sie „emergiert" aus der Trigger-Logik — kein Workflow hoert auf das Label,
// der Fixup armiert bei `needs-human` nicht neu). Die Tests hier sind deshalb CHARACTERIZATION-
// Tests: sie legen das Akzeptanzkriterium als ausfuehrbare Spec fest und schuetzen das Verhalten
// vor Regression. Sie sind mit dem aktuellen Code GRUEN.
//
// Aufnahmekriterium: jede Assertion prueft ein Akzeptanzkriterium aus Issue #544. Keine
// „Datei enthaelt den String, den ich hineingeschrieben habe"-Tests.
//
// Testebene: statische Auswertung der Workflow-YAMLs (node:test via tsx, ci.yml).

const DIR = dirname(fileURLToPath(import.meta.url));

const workflows = readdirSync(DIR)
	.filter((f) => f.endsWith('.yml'))
	.map((name) => ({ name, yml: readFileSync(join(DIR, name), 'utf8') }));

// Kommentarzeilen raus — sonst schlagen Erklaertexte und Beispiele als „Trigger" durch.
const codeOf = (yml: string): string =>
	yml
		.split('\n')
		.filter((l) => !/^\s*#/.test(l))
		.join('\n');

// Alle Labels, auf die ein Workflow als Trigger hoert (`github.event.label.name == '<label>'`).
// Diese Vergleiche stehen gleichermaßen in `on:`-Bedingungen, Job-`if:` und Concurrency-Gruppen —
// ueberall dort, wo das Label das Laufen bestimmt. Die Menge ist die „Bewaffnungsliste" der Pipeline.
const ARMED_LABELS = [
	...new Set(
		workflows.flatMap(({ yml }) =>
			[...codeOf(yml).matchAll(/github\.event\.label\.name\s*==\s*'([^']+)'/g)].map((m) => m[1]),
		),
	),
];

// ──────────────────────────────────────────────────────────────────────────────
// AC1 — Workflows triggern NICHT bei `ai:needs-human`
// ──────────────────────────────────────────────────────────────────────────────
// Kein Workflow darf auf das Hinzufuegen von `ai:needs-human` reagieren. Das ist die „harte"
// Haelfte der Blockade: waehrend das Label steht, wuerde jeder darauf hoerende Workflow die
// Warteposition sofort wieder aufheben. Statisch nachgewiesen, indem `ai:needs-human` in
// KEINER Bewaffnungsliste auftaucht.
describe('AC1 — ai:needs-human traegt keinen Workflow-Bewaffnungs-Eintrag', () => {
	it('es gibt ueberhaupt bewaffnete Labels (sonst prueft die Invariante ins Leere)', () => {
		assert.ok(ARMED_LABELS.length > 0, 'kein github.event.label.name == ... gefunden — Extraktion kaputt?');
	});

	it('ai:needs-human ist kein Trigger-Label irgendeines Workflows', () => {
		assert.ok(
			!ARMED_LABELS.includes('ai:needs-human'),
			`ai:needs-human duerfen Workflows NIEMALS als Trigger tragen (sonst wird die ` +
				`Warteposition aufgehoben). Tatsaechlich bewaffnet: ${ARMED_LABELS.join(', ')}`,
		);
	});

	// Negativ-Abgrenzung: die Labels, auf die die Pipeline BEWUSST hoert, bleiben sichtbar. Wenn
	// jemand die Extraktion versehentlich leer zieht, faellt dieser Test (und nicht erst der
	// spaetere) auf.
	it('die bekannten Workflow-Trigger bleiben bewaffnet (Extraktion greift nicht zu kurz)', () => {
		for (const expected of ['ai:spec-ready', 'ai:ready', 'ai:needs-review', 'ai:needs-changes']) {
			assert.ok(
				ARMED_LABELS.includes(expected),
				`Erwarteter Trigger fehlt in der Bewaffnungsliste: ${expected} — Extraktion unvollstaendig?`,
			);
		}
	});
});

// ──────────────────────────────────────────────────────────────────────────────
// AC2 — Workflows triggern WIEDER, nachdem `ai:needs-human` entfernt wurde
// ──────────────────────────────────────────────────────────────────────────────
// Die Entblockade läuft so: Mensch entfernt `ai:needs-human` und setzt `ai:needs-review`. Damit
// das funktioniert, MUSS der Review-Workflow auf `ai:needs-review` bewaffnet sein — und sein
// Job-`if:` darf das Laufen NICHT an die Abwesenheit von `ai:needs-human` koppeln (sonst wuerde
// ein noch stehendes Label den Re-Trigger trotzdem schlucken). Beides statisch nachgewiesen am
// 04-claude-pr-review.yml.
describe('AC2 — Entblockade-Pfad (ai:needs-review) ist frei', () => {
	const review = workflows.find((w) => w.name === '04-claude-pr-review.yml');
	assert.ok(review, '04-claude-pr-review.yml nicht gefunden');

	it('Review ist auf ai:needs-review bewaffnet (Mensch kann neu triggern)', () => {
		assert.match(
			codeOf(review!.yml),
			/github\.event\.label\.name\s*==\s*'ai:needs-review'/,
			'04-claude-pr-review.yml hoert nicht auf ai:needs-review — der in den Kommentaren ' +
				'angekuendigte Re-Trigger-Pfad nach Entfernen von ai:needs-human existiert nicht.',
		);
	});

	it('Review-Job sperrt NICHT auf Anwesenheit von ai:needs-human', () => {
		// Ein `contains(..., 'ai:needs-human')` im aktivierenden `if:` wuerde den Review trotz
		// gesetztem ai:needs-review blocken, solange das menschliche Label noch steht. Genau das
		// darf nicht passieren: die Entblockade muss allein durch Label-Entfernen + ai:needs-review
		// moeglich sein.
		assert.doesNotMatch(
			codeOf(review!.yml),
			/contains\([^)]*,\s*'ai:needs-human'\)/,
			'04-claude-pr-review.yml koppelt eine Bedingung an ai:needs-human — das wuerde den ' +
				'Re-Trigger blockieren, obwohl das Label vom Menschen entfernt werden soll.',
		);
	});
});

// ──────────────────────────────────────────────────────────────────────────────
// AC3 — Klare Doku fuer Nutzer (Kommentare in PRs)
// ──────────────────────────────────────────────────────────────────────────────
// Workflows, die `ai:needs-human` SETZEN duerfen (Fixup, Review), muessen dem Nutzer im selben
// Lauf mitteilen: (a) dass gewartet wird, (b) dass `ai:needs-human` manuell zu entfernen ist, und
// (c) dass danach `ai:needs-review` neu zu setzen ist. Ohne diese drei Hinweise ist die Blockade
// fuer den Nutzer ein stilles Steckenbleiben. Geprueft wird, dass der needs-human-Zweig JEWEILS
// einen gh-pr-comment absetzt, der beide Handlungsanweisungen enthaelt.
describe('AC3 — needs-human-Zweig postet handlungsanweisenden Kommentar', () => {
	const HUMAN_SETTERS = ['05-claude-pr-fixup.yml', '04-claude-pr-review.yml']
		.map((n) => workflows.find((w) => w.name === n))
		.filter(Boolean) as { name: string; yml: string }[];

	it('es gibt ueberhaupt ai:needs-human-setzende Workflows (sonst prueft die Invariante ins Leere)', () => {
		assert.ok(HUMAN_SETTERS.length === 2, 'Fixup und/oder Review nicht gefunden — Datei umbenannt?');
	});

	// Jeder Setter muss MINDESTENS EINEN handlungsanweisenden needs-human-Kommentar haben: der
	// nennt sowohl das Entfernen („entfern") von ai:needs-human als auch den Re-Trigger via
	// ai:needs-review. Fehlt beides, weiss der Mensch zwar, dass gewartet wird, aber nicht, wie er
	// entblockt — eine blosse „wartet auf Mensch"-Meldung reicht NICHT. Das Akzeptanzkriterium
	// verlangt die EXISTENZ einer klaren Doku, nicht dass JEDER Zweig sie wiederholt (der
	// no-progress-Fallback z. B. darf knapper sein).
	for (const wf of HUMAN_SETTERS) {
		it(`${wf.name} — needs-human-Zweig postet handlungsanweisenden Kommentar`, () => {
			const code = codeOf(wf.yml);

			// Zweige, die ai:needs-human setzen — vom Setzen bis zur naechsten Label-Mutation begrenzt.
			const branches: string[] = [];
			let from = 0;
			for (;;) {
				const at = code.indexOf('--add-label ai:needs-human', from);
				if (at === -1) break;
				const rest = code.slice(at + 1);
				const nxt = rest.search(/--(?:add|remove)-label/);
				branches.push(nxt === -1 ? code.slice(at) : code.slice(at, at + 1 + nxt));
				from = at + 1;
			}
			assert.ok(branches.length > 0, `${wf.name} setzt ai:needs-human gar nicht — Scope falsch?`);

			const actionable = branches.some(
				(b) => /gh pr comment/.test(b) && /entfern/i.test(b) && /ai:needs-review/.test(b),
			);
			assert.ok(
				actionable,
				`${wf.name}: kein needs-human-Zweig postet einen Kommentar, der sowohl „entfern" ` +
					'(Label entfernen) als auch „ai:needs-review" (Re-Trigger) nennt — der Wartezustand ' +
					'bliebe fuer den Nutzer ohne Entblockade-Anleitung.',
			);
		});
	}
});

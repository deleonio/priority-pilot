import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Berechnete Invarianten ueber ALLE Workflows.
//
// Aufnahmekriterium dieser Datei: der Test leitet etwas ab, das nirgends woertlich in der
// Quelle steht — hier je ein All-Quantor ueber alle gefundenen Stellen. Ein neu ergaenzter
// Workflow oder Step ist damit automatisch abgedeckt, ohne dass jemand daran denken muss.
// Ein Test der Form „Datei enthaelt den String, den ich hineingeschrieben habe" gehoert
// NICHT hierher (und nirgendwo hin) — siehe .ai-knowledge/tdd-strategy.md, Testumfang.
//
// Testebene: statische Auswertung der Workflow-YAMLs (node:test via tsx, ci.yml).

const DIR = dirname(fileURLToPath(import.meta.url));

const workflows = readdirSync(DIR)
	.filter((f) => f.endsWith('.yml'))
	.map((name) => ({ name, yml: readFileSync(join(DIR, name), 'utf8') }));

// Kommentarzeilen raus — sonst schlagen Beispiele und Erklaertexte als „Befehl" durch.
const codeOf = (yml: string): string =>
	yml
		.split('\n')
		.filter((l) => !/^\s*#/.test(l))
		.join('\n');

describe('Invariante — ohne actions/checkout muss jeder gh-Aufruf --repo tragen', () => {
	// Ohne Checkout leitet gh die Repo-Identitaet aus dem lokalen git-Remote ab. Den gibt es
	// nicht → `fatal: not a git repository`, der Workflow stirbt zur Laufzeit. `gh api` ist
	// ausgenommen: dort steckt das Repo im Pfad (repos/$REPO/...).
	// `m` ist hier tragend: ohne das Flag matcht `^` nur den String-Anfang, und jeder Aufruf am
	// Zeilenanfang — also praktisch alle — faellt aus der Extraktion. Die Invariante liefe leer.
	const GH_CALL = /(?:^\s*|\$\(|\|\s*|&&\s*|;\s*)(gh\s+(?:pr|issue|run|cache|label|release)\s+[^\n|)]*)/gm;

	for (const { name, yml } of workflows) {
		if (/uses:\s*actions\/checkout/.test(yml)) continue;

		it(`${name}`, () => {
			const calls = [...codeOf(yml).matchAll(GH_CALL)].map((m) => m[1].trim());
			for (const call of calls) {
				assert.match(call, /--repo/, `gh-Aufruf ohne --repo in ${name} (Workflow ohne Checkout): ${call}`);
			}
		});
	}
});

describe('Invariante — ai:-Labels werden nie unter github.token gesetzt', () => {
	// Mit dem Standard-GITHUB_TOKEN gesetzte/entfernte Labels loesen KEINE Folge-Workflows aus
	// (dokumentiertes GHA-Verhalten). Passiert das in der Label-Kette, bleibt die Pipeline
	// STILL stehen: gruener Lauf, kein Nachfolger. Deshalb pro Step geprueft, nicht pro Datei —
	// ein einzelner falsch verkabelter Step reicht fuer den Ausfall.
	const LABEL_WRITE = /--(?:add|remove)-label\s+"?ai:/;

	const labelSteps = workflows.flatMap(({ name, yml }) =>
		codeOf(yml)
			.split(/\n(?=\s{6}- )/)
			.filter((step) => LABEL_WRITE.test(step))
			.map((step) => ({ name, step, stepName: (step.match(/-\s*name:\s*(.*)/) ?? [, '(unbenannt)'])[1].trim() })),
	);

	it('es gibt ueberhaupt label-schreibende Steps (sonst prueft die Invariante ins Leere)', () => {
		assert.ok(labelSteps.length > 0, 'kein Step mit --add-label/--remove-label ai: gefunden — Extraktion kaputt?');
	});

	for (const { name, step, stepName } of labelSteps) {
		it(`${name} :: ${stepName}`, () => {
			assert.doesNotMatch(
				step,
				/GH_TOKEN:\s*\$\{\{\s*github\.token/,
				`Label-Step laeuft unter github.token — das entstehende labeled/unlabeled-Event triggert keinen Folge-Workflow, die Kette bricht still ab. App-Token verwenden (steps.*.outputs.token).`,
			);
		});
	}
});

describe('Invariante — wo ein Skip-Guard existiert, kennt ihn JEDER Folge-Step', () => {
	// Der Skip-Guard weist einen Zweitlauf ab, waehrend fuer dasselbe Issue bereits einer
	// laeuft. Ein Folge-Step, der ihn nicht kennt, arbeitet im geskippten Lauf weiter und
	// hebt den Guard fuer seinen Teil auf — still, denn der Lauf endet gruen.
	//
	// Tragend ist die INDIREKTE Gating-Falle: `steps.doppel-guard.outputs.skip != 'true'` ist
	// WAHR, wenn der Doppel-Run-Guard selbst uebersprungen wurde (uebersprungene Steps liefern
	// keine Outputs, der Vergleich laeuft gegen den Leerstring). Wer also nur den nachgelagerten
	// Guard abfragt, laeuft bei Skip-Guard-Skip trotzdem. Genau diese Fehlerklasse ist hier
	// gemeint — der Test leitet sie aus der Step-Reihenfolge ab, statt Conditions zu spiegeln.
	//
	// Geprueft wird "referenziert den Guard", nicht "gatet auf ihn": ein `always()`-Reporting-Step
	// SOLL im geskippten Lauf laufen — er muss den Skip aber als eigenen Fall melden, sonst faellt
	// er auf den Fehler-Arm (`OUTCOME` ist leer) und meldet ❌ fuer einen gewollten Skip.
	// Beide zulaessigen Formen referenzieren `steps.<guard>.outputs.skip`; das Fehlen ist der Defekt.
	const GUARD = 'skip-guard';

	// Steps eines Workflows in Dokument-Reihenfolge, ab dem Skip-Guard.
	const stepsAfterGuard = (yml: string): { stepName: string; step: string }[] => {
		const steps = codeOf(yml).split(/\n(?=\s{6}- )/);
		const guardIndex = steps.findIndex((s) => new RegExp(`id:\\s*${GUARD}\\b`).test(s));
		if (guardIndex === -1) return [];
		return steps.slice(guardIndex + 1).map((step) => ({
			step,
			stepName: (step.match(/-\s*name:\s*(.*)/) ?? [, '(unbenannt)'])[1].trim(),
		}));
	};

	const guarded = workflows
		.map(({ name, yml }) => ({ name, followers: stepsAfterGuard(yml) }))
		.filter(({ followers }) => followers.length > 0);

	it('es gibt ueberhaupt Workflows mit Skip-Guard (sonst prueft die Invariante ins Leere)', () => {
		assert.ok(guarded.length > 0, `kein Step mit "id: ${GUARD}" gefunden — Extraktion kaputt oder Guard entfernt?`);
	});

	for (const { name, followers } of guarded) {
		for (const { stepName, step } of followers) {
			it(`${name} :: ${stepName}`, () => {
				assert.match(
					step,
					new RegExp(`steps\\.${GUARD}\\.outputs\\.skip`),
					`Step steht nach dem Skip-Guard, referenziert ihn aber nirgends — im geskippten Lauf arbeitet ` +
						`er weiter bzw. meldet den gewollten Skip als Fehler. Entweder auf ihn gaten ` +
						`(steps.${GUARD}.outputs.skip != 'true') oder — bei always()-Reporting — den Skip als eigenen ` +
						`Fall behandeln. Ein Gate auf einen NACHGELAGERTEN Guard genuegt nicht: dessen Output ist leer, ` +
						`wenn er selbst uebersprungen wurde, und "!= 'true'" ist dann wahr.`,
				);
			});
		}
	}
});

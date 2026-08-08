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

describe('Invariante — wo ein Guard existiert, behandelt JEDER Folge-Step ihn', () => {
	// Ein Guard (`id: *-guard`, schreibt `skip=true|false`) weist einen Lauf ab, dessen Arbeit
	// schon jemand anders erledigt. Ein Folge-Step, der ihn nicht behandelt, arbeitet im
	// geskippten Lauf weiter oder meldet den gewollten Skip als Fehler — still, denn der Lauf
	// endet gruen.
	//
	// Tragend ist die INDIREKTE Gating-Falle: `steps.doppel-guard.outputs.skip != 'true'` ist
	// WAHR, wenn der Doppel-Run-Guard selbst uebersprungen wurde (uebersprungene Steps liefern
	// keine Outputs, der Vergleich laeuft gegen den Leerstring). Wer also nur den nachgelagerten
	// Guard abfragt, laeuft beim vorgelagerten Skip trotzdem. Genau deshalb wird JEDER Guard
	// einzeln geprueft und die Guard-Liste aus den Workflows abgeleitet, statt sie zu fixieren.
	//
	// Zwei Behandlungen sind zulaessig, und welche noetig ist, haengt am Step selbst:
	//   - Arbeits-Step  -> auf den Guard gaten (`steps.<guard>.outputs.skip != 'true'`)
	//   - always()-Step -> SOLL laufen, muss den Skip aber als eigenen Fall MELDEN, sonst faellt
	//     er auf den Fehler-Arm (`outcome` ist leer, weil der Arbeits-Step nie lief) und meldet ❌
	//     fuer einen erfolgreichen Skip.
	// Beide Formen referenzieren `steps.<guard>.outputs.skip`; fuer always()-Steps wird zusaetzlich
	// verlangt, dass der Wert im Body ankommt (env-Durchreichung) UND dort einen eigenen Zweig
	// bekommt — eine blosse Erwaehnung wuerde die Fehl-Meldung nicht verhindern.
	//
	// Die Guards werden ueber ihr VERHALTEN abgeleitet (Step schreibt `skip=` nach $GITHUB_OUTPUT),
	// nicht ueber ihren Namen: die Namen sind uneinheitlich (`skip-guard`, `doppel-guard`,
	// `supersede-check`), und ein fixer Name wuerde genau die Guards durchfallen lassen, die
	// niemand beim Schreiben des Tests im Blick hatte.
	const guardStepsOf = (job: string): string[] =>
		job
			.split(/\n(?=\s{6}- )/)
			.filter((s) => /echo\s+"skip=(?:true|false)"\s*>>\s*"\$GITHUB_OUTPUT"/.test(s))
			.map((s) => (s.match(/^\s*id:\s*([\w-]+)/m) ?? [, ''])[1])
			.filter(Boolean);

	// Job-Grenze: Steps eines Jobs duerfen nur Guards DESSELBEN Jobs kennen — `steps.*` ist
	// job-lokal. Ohne diesen Split wuerde ein zweiter Job im selben File Fehlalarme erzeugen.
	const jobsOf = (yml: string): string[] => {
		const body = codeOf(yml).split(/^jobs:\n/m)[1];
		return body ? body.split(/\n(?=\s{2}[\w-]+:\n)/) : [];
	};

	const stepsOf = (job: string): { stepName: string; step: string }[] =>
		job
			.split(/\n(?=\s{6}- )/)
			.map((step) => ({ step, stepName: (step.match(/-\s*name:\s*(.*)/) ?? [, '(unbenannt)'])[1].trim() }));

	// Pro (Workflow, Job, Guard) alle Steps NACH dem Guard — nur die koennen ihn kennen.
	const cases = workflows.flatMap(({ name, yml }) =>
		jobsOf(yml).flatMap((job) => {
			const steps = stepsOf(job);
			return guardStepsOf(job).flatMap((guard) => {
				const at = steps.findIndex((s) => new RegExp(`id:\\s*${guard}\\b`).test(s.step));
				return steps.slice(at + 1).map(({ stepName, step }) => ({ name, guard, stepName, step }));
			});
		}),
	);

	it('es gibt ueberhaupt Guards mit Folge-Steps (sonst prueft die Invariante ins Leere)', () => {
		assert.ok(cases.length > 0, 'kein skip-schreibender Step mit Folge-Steps gefunden — Extraktion kaputt?');
		// Mehr als ein Guard-Name: sonst waere die Verallgemeinerung ueber Guards unbelegt und
		// der Test faende genau die Guards nicht, die anders heissen als der zuerst gebaute.
		const guards = new Set(cases.map((c) => c.guard));
		assert.ok(guards.size > 1, `nur ein Guard-Name gefunden (${[...guards]}) — Ableitung greift zu kurz?`);
	});

	// Ein Step ist nur dann betroffen, wenn er im Skip-Fall TATSAECHLICH laeuft. Zwei Formen
	// halten ihn zuverlaessig heraus, beide zaehlen als Behandlung:
	//   - direkt:   `steps.<guard>.outputs.skip != 'true'`
	//   - indirekt: eine Bedingung ueber `steps.<arbeits-step>.outcome` — die ist im Skip-Fall
	//               leer, weil der Arbeits-Step selbst hinter dem Guard haengt.
	// Uebrig bleiben die ungegateten `always()`-Reporting-Steps: die laufen im Skip mit und
	// muessen ihn als eigenen Fall MELDEN, sonst faellt der gewollte Skip auf den Fehler-Arm.
	const gatedOut = (step: string, guard: string): boolean => {
		const cond = (step.match(/^\s*if:\s*(.*)$/m) ?? [, ''])[1];
		return (
			new RegExp(`steps\\.${guard}\\.outputs\\.skip\\s*!=\\s*'true'`).test(cond) || /steps\.[\w-]+\.outcome/.test(cond)
		);
	};

	for (const { name, guard, stepName, step } of cases) {
		it(`${name} :: ${guard} :: ${stepName}`, () => {
			if (gatedOut(step, guard)) return; // laeuft im Skip-Fall nicht — nichts zu melden

			// Der Wert muss als env ankommen UND im Body einen eigenen Zweig bekommen. Die blosse
			// Referenz genuegt nicht: sonst bliebe der Test gruen, wenn jemand nur den Zweig
			// loescht und das env stehen laesst — der Defekt waere zurueck, das Gate still.
			const envName = (step.match(
				new RegExp(`^\\s*([A-Z_]+):\\s*\\$\\{\\{\\s*steps\\.${guard}\\.outputs\\.skip\\s*\\}\\}`, 'm'),
			) ?? [, ''])[1];
			assert.ok(
				envName,
				`Step laeuft im "${guard}"-Skip mit (always(), kein Gate), reicht dessen Wert aber nicht als env ` +
					`durch — er kann den Skip im Body nicht vom Fehlerfall unterscheiden und meldet ❌ fuer einen ` +
					`erfolgreichen Skip (outcome ist leer, weil der Arbeits-Step nie lief). Entweder auf den Guard ` +
					`gaten (steps.${guard}.outputs.skip != 'true') oder ihn als eigenen Fall melden.`,
			);
			assert.match(
				step,
				new RegExp(`\\[\\s*"\\$\\{${envName}[^}]*\\}"\\s*=\\s*"true"\\s*\\]`),
				`Step reicht "${guard}" zwar als $${envName} durch, wertet es im Body aber nicht aus — ohne ` +
					`eigenen Zweig faellt der gewollte Skip weiterhin auf den Fehler-Arm. ` +
					`Erwartet: [ "\${${envName}:-false}" = "true" ] mit eigener ::notice.`,
			);
		});
	}
});

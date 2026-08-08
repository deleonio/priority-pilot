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
	// Die Guards werden ueber ihr VERHALTEN abgeleitet, in zwei Schritten:
	//   1. der Step schreibt einen BOOLESCHEN Output nach $GITHUB_OUTPUT, und
	//   2. mindestens ein Folge-Step nutzt diesen Output ABWEISEND (`!= 'true'`).
	// Schritt 2 ist tragend: ein boolescher Output allein macht keinen Guard. `preflight.configured`
	// und `resolve-conflicts.conflict` sind Positiv-Flags (`== 'true'` schaltet etwas FREI) — fuer
	// sie ist "nicht gesetzt" der Normalfall, nicht ein zu meldender Abbruch.
	// Weder Step- noch Output-Name taugen als Kriterium: beide sind uneinheitlich
	// (`skip-guard`/`doppel-guard`/`supersede-check`/`stop-guard`, `skip=`/`stop=`), und jede
	// Festlegung laesst genau die Guards durchfallen, die niemand beim Schreiben im Blick hatte.
	// Der Output-Name wird deshalb MITGELESEN und in allen Assertions weiterverwendet.
	const guardStepsOf = (job: string): { id: string; output: string }[] =>
		job
			.split(/\n(?=\s{6}- )/)
			.map((s) => ({
				id: (s.match(/^\s*id:\s*([\w-]+)/m) ?? [, ''])[1],
				output: (s.match(/echo\s+"(\w+)=(?:true|false)"\s*>>\s*"\$GITHUB_OUTPUT"/) ?? [, ''])[1],
			}))
			.filter((g) => g.id && g.output)
			.filter((g) => new RegExp(`steps\\.${g.id}\\.outputs\\.${g.output}\\s*!=\\s*'true'`).test(job));

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
	// `jobGuards` reist mit: fuer die Frage "laeuft dieser Step im Guard-Fall mit?" zaehlt jeder
	// Guard DIESES Jobs, nicht nur der gerade gepruefte.
	const cases = workflows.flatMap(({ name, yml }) =>
		jobsOf(yml).flatMap((job) => {
			const steps = stepsOf(job);
			const jobGuards = guardStepsOf(job);
			return jobGuards.flatMap(({ id, output }) => {
				const at = steps.findIndex((s) => new RegExp(`id:\\s*${id}\\b`).test(s.step));
				return steps
					.slice(at + 1)
					.map(({ stepName, step }) => ({ name, guard: id, output, stepName, step, jobGuards }));
			});
		}),
	);

	it('es gibt ueberhaupt Guards mit Folge-Steps (sonst prueft die Invariante ins Leere)', () => {
		assert.ok(cases.length > 0, 'kein Guard-Step mit Folge-Steps gefunden — Extraktion kaputt?');
		// Mehr als ein Guard-Name UND mehr als ein Output-Name: sonst waere die Verallgemeinerung
		// unbelegt und der Test faende genau die Guards nicht, die anders heissen bzw. anders
		// benannte Outputs schreiben als der zuerst gebaute (z. B. stop= statt skip=).
		const guards = new Set(cases.map((c) => c.guard));
		const outputs = new Set(cases.map((c) => c.output));
		assert.ok(guards.size > 1, `nur ein Guard-Name gefunden (${[...guards]}) — Ableitung greift zu kurz?`);
		assert.ok(outputs.size > 1, `nur ein Output-Name gefunden (${[...outputs]}) — Ableitung haengt am Literal?`);
	});

	// Ein Step ist nur betroffen, wenn er im Guard-Fall TATSAECHLICH laeuft. Zwei Formen halten
	// ihn heraus:
	//   - direkt:   `steps.<guard>.outputs.<out> != 'true'` — schliesst den Fall explizit aus.
	//   - indirekt: die Bedingung haengt AUSSCHLIESSLICH an `steps.<arbeits-step>.outcome`; das
	//               ist im Guard-Fall leer, weil der Arbeits-Step selbst hinter dem Guard haengt.
	// Der zweite Freibrief entfaellt, sobald die Bedingung einen Guard POSITIV referenziert
	// (`steps.<guard>.outputs.<out> == 'true'`, z. B. 02:163/03:190): dann laeuft der Step im
	// Guard-Fall bewusst mit und muss ihn behandeln.
	//
	// Geprueft wird gegen die abgeleiteten Guard-IDs des Jobs, NICHT gegen die ||-Nachbarschaft:
	// `||` ist kommutativ, eine blosse Umsortierung derselben Bedingung darf das Gate nicht
	// stumm schalten. Nur echte Guards zaehlen — Positiv-Flags wie `setup.configured` stehen in
	// fast jeder Bedingung und wuerden sonst jeden Step faelschlich als "laeuft mit" markieren.
	const gatedOut = (
		step: string,
		guard: string,
		output: string,
		jobGuards: { id: string; output: string }[],
	): boolean => {
		const cond = (step.match(/^\s*if:\s*(.*)$/m) ?? [, ''])[1];
		if (new RegExp(`steps\\.${guard}\\.outputs\\.${output}\\s*!=\\s*'true'`).test(cond)) return true;
		const runsOnGuard = jobGuards.some((g) =>
			new RegExp(`steps\\.${g.id}\\.outputs\\.${g.output}\\s*==\\s*'true'`).test(cond),
		);
		return /steps\.[\w-]+\.outcome/.test(cond) && !runsOnGuard;
	};

	for (const { name, guard, output, stepName, step, jobGuards } of cases) {
		it(`${name} :: ${guard} :: ${stepName}`, () => {
			if (gatedOut(step, guard, output, jobGuards)) return; // laeuft im Guard-Fall nicht

			// Der Wert muss als env ankommen UND im Body einen eigenen Zweig bekommen. Die blosse
			// Referenz genuegt nicht: sonst bliebe der Test gruen, wenn jemand nur den Zweig
			// loescht und das env stehen laesst — der Defekt waere zurueck, das Gate still.
			const envName = (step.match(
				new RegExp(`^\\s*([A-Z_]+):\\s*\\$\\{\\{\\s*steps\\.${guard}\\.outputs\\.${output}\\s*\\}\\}`, 'm'),
			) ?? [, ''])[1];
			assert.ok(
				envName,
				`Step laeuft im "${guard}"-Fall mit (always(), kein Gate), reicht dessen Output "${output}" aber ` +
					`nicht als env durch — er kann ihn im Body nicht vom Fehlerfall unterscheiden und meldet ❌ fuer ` +
					`einen erfolgreichen Skip (outcome ist leer, weil der Arbeits-Step nie lief). Entweder gaten ` +
					`(steps.${guard}.outputs.${output} != 'true') oder als eigenen Fall melden.`,
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

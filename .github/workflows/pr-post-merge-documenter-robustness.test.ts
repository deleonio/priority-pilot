import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Rote Spec-Tests fuer Issue #519 — Documenter-Workflow „Document Merged PRs (6 Phases)"
// bricht in Phase 0 mit `exit code 1` ab, unmittelbar nachdem der `ai:documented`-Label-Check
// durchlief (Log: „✅ Label 'ai:documented' existiert bereits" → Error: exit code 1).
//
// Root-Cause-Hypothese (aus Symptom + YAML): Phase 0 läuft unter `set -euo pipefail`. Das als
// Nächstes nach dem Label-Check ausgeführte Kommando ist der un-gesicherte `gh api /search/issues`
// Pipeline-Aufruf, dessen stderr mit `2>/dev/null` gedämpft ist — sein Exit-Code aber propagiert
// via pipefail und löst `set -e` aus → hartes exit 1. Eine transient scheiternde/leere Search-API
// (Rate-Limit, Secondary-Rate-Limit, leere Paginierung) bringt also den GESAMTEN Lauf um. AK2
// verlangt ausdrücklich die Ursachen-Behebung, NICHT das symptomatische Entfernen von
// `set -euo pipefail`.
//
// Testebene: statische Auswertung der Workflow-YAML (node:test via tsx, ci.yml) — verhaltens-
// basierte AKs (T1 Run endet „Success", T2 alle Phasen im Log) sind am echten Merge per `gh run
// view` zu verifizieren; dieser Test sichert die STRUKTURELLE Vorbedingung, die das exit 1
// konstruktiv verhindert: jedes fehlerfähige Netzwerk-/jq-Kommando in Phase 0 muss fail-tolerant
// abgesichert sein.
//
// Dedup: Trigger-Kopplung (#496), Such-Query `-label:ai:documented` (Idempotenz) und
// `GH_TOKEN` auf Workflow-Ebene (exit-4-Fix) sind bereits in pr-post-merge-trigger.test.ts
// gesichert und werden hier NICHT erneut geprüft.

const HERE = dirname(fileURLToPath(import.meta.url));
const WF = readFileSync(join(HERE, 'pr-post-merge-documentation.yml'), 'utf8');

// Kommentarzeilen raus — Inline-Kommentare im Bash duerfen nicht als Code durchgehen.
const code = WF.split('\n')
	.filter((l) => !/^\s*#/.test(l))
	.join('\n');

// Phase-0-Step-Body: von „Phase 0 - Setup" bis „Phase 1-6 - Process".
const p0Start = code.indexOf('Phase 0 - Setup');
const p0End = code.indexOf('Phase 1-6 - Process');
assert.ok(p0Start !== -1 && p0End !== -1 && p0End > p0Start, 'Phase-0-Block nicht abgrenzbar');
const phase0 = code.slice(p0Start, p0End);

// Phase-1-6-Step-Body („Process Each PR"): ab „Phase 1-6 - Process" bis Datei-Ende (Final Summary
// inklusive — dort gibt es keine fehlerfähige grep-Pipeline, der Slice ist also sicher).
const p1Start = code.indexOf('Phase 1-6 - Process');
assert.ok(p1Start !== -1, 'Phase-1-6-Block nicht abgrenzbar');
const phase1to6 = code.slice(p1Start);

// Hilfs-Assertion: ein Kommando-String ist in Phase 0 fail-tolerant abgesichert, wenn es
// (a) in eine Variable mit `||`-Fallback gebunden wird, ODER
// (b) innerhalb einer `if`/`||`/`set +e`-Bewachung steht, ODER
// (c) ein `|| true` / `|| <cmd>` direkt folgt.
// Ein bloses `cmd 2>/dev/null` (stderr gedämpft, Exit-Code aber aktiv) gilt NICHT als gesichert.
function isGuarded(block: string, cmdPattern: RegExp): boolean {
	const lines = block.split('\n');
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (!cmdPattern.test(line)) continue;
		// (b) Bedingungs-/ODER-Bewachung auf derselben Zeile
		if (/\bif\s+.*\bthen\b/.test(line) || /\|\|/.test(line)) return true;
		// (a) Variablen-Bindung mit Fallback ueber Fortsetzungszeilen pruefen (naeh. Zusammenzug)
		const joined = (line + ' ' + lines.slice(i + 1, i + 4).join(' ')).replace(/\\\n?/g, ' ');
		if (/=\s*\$\(\s*\S.*\|\|/.test(joined) || /\|\|/.test(joined)) return true;
		// (c) `|| true` / `|| <cmd>` folgt direkt auf der naechsten physischen Zeile (ohne \)
		const next = (lines[i + 1] || '').trim();
		if (/^\|\|/.test(next)) return true;
		// set +e / set +o pipefail-Bereich unmittelbar davor
		const prev = (lines[i - 1] || '').trim();
		if (/^set\s+\+e\b/.test(prev) || /^set\s+\+o\s+pipefail\b/.test(prev)) return true;
		return false; // Treffer gefunden, aber un-gesichert
	}
	return true; // kein Treffer → nichts zu sichern
}

describe('Issue #519 AK1 — Workflow läuft vollständig durch (kein exit 1 in Phase 0)', () => {
	// AK1: Der Run muss für einen gemergten PR komplett durchlaufen (Exit 0). Der un-gesicherte
	// `gh api /search/issues`-Aufruf ist die erste Fehlerquelle NACH dem Label-Check und passt
	// exakt zum beobachteten Abbruch-Punkt. Ein transienter/leerer Search-Treffer darf den Step
	// nicht per `set -e`/pipefail beenden.
	it('der /search/issues-Aufruf in Phase 0 ist fail-tolerant abgesichert (kein exit 1 bei transientem/leerem Ergebnis)', () => {
		assert.ok(
			isGuarded(phase0, /gh\s+api\s+"\/search\/issues"/),
			'Der `gh api "/search/issues"`-Pipeline-Aufruf in Phase 0 ist un-gesichert (lediglich ' +
				'`2>/dev/null` dämpft stderr, der Exit-Code propagiert via pipefail → `set -e` → exit 1). ' +
				'Erwartet: Bewachung via `|| <fallback>`/Variablen-Bindung/`if`, sodass ein transienter ' +
				'oder leerer Search-API-Treffer den Step nicht abbricht.',
		);
	});
});

describe('Issue #519 AK2 — Ursache behoben, nicht symptomatisch (set -euo pipefail darf NICHT entfernt werden)', () => {
	// AK2 verlangt ausdrücklich: nicht nur `set -e`/`-euo pipefail` symptomatisch umgangen. Dieser
	// Guard stellt sicher, dass der Fix die Fehler-Strenge BEIBEHÄLT und stattdessen die
	// fehlerfähigen Kommandos absichert. Heute erfüllt (grün) → Regression-Guard, der bei der
	// Umsetzung nicht mitbrechen darf.
	it('Phase 0 behält `set -euo pipefail` bei (symptomatisches Entfernen verboten)', () => {
		assert.match(
			phase0,
			/set\s+-euo\s+pipefail/,
			'Phase 0 enthält nicht mehr `set -euo pipefail` — ' +
				'vermutlich symptomatisch entfernt. AK2 verlangt Ursachen-Behebung (Absicherung der ' +
				'fehlerfähigen Kommandos), NICHT die Beseitigung der Fehler-Strenge.',
		);
	});

	// ROT: Ein per `2>/dev/null` gedämpftes Netzwerk-Kommando, dessen Exit-Code trotzdem aktiv
	// bleibt, ist genau die stille exit-1-Falle. Kein `gh`/`jq`-Aufruf in Phase 0 darf so
	// konstruiert sein.
	it('Phase 0 enthält keinen per `2>/dev/null` gedämpften, aber exit-propagierenden Kommando-Aufruf ohne Bewachung', () => {
		// Jeder `gh`-Aufruf mit `2>/dev/null` in Phase 0 muss bewacht sein: stderr ist gedämpft,
		// der Exit-Code propagiert aber via pipefail → stiller exit 1, wenn weder `||`-Fallback
		// noch `if`-Bewachung vorhanden ist.
		const bare = phase0
			.split('\n')
			.filter((l) => /\bgh\s+/.test(l) && /2>\/dev\/null/.test(l))
			.filter((l) => !/(\|\||\bif\s+)/.test(l));
		assert.equal(
			bare.length,
			0,
			'Phase 0 enthält `gh`-Aufrufe mit `2>/dev/null`, die weder `||`-Fallback noch `if`-Bewachung ' +
				'haben: stderr ist gedämpft, der Exit-Code propagiert aber via pipefail → stiller exit 1. ' +
				'Betroffen: ' +
				JSON.stringify(bare),
		);
	});
});

describe('Issue #519 AK3 — Bei erneutem Lauf kein exit 1; leere Queue wird sauber verarbeitet', () => {
	// AK3/T2: Auch wenn keine PRs anfallen (pr_count == 0) oder das Suchergebnis leer/kurz ist,
	// darf die pr_count-Ableitung nicht selbst exit 1 auslösen. `jq -s 'length'` auf einer leeren
	// / fehlerhaften Ergebnisdatei bricht sonst den Step ab.
	it('die pr_count-Ableitung in Phase 0 ist fail-tolerant (jq bricht nicht bei leerem/fehlerhaftem Ergebnis ab)', () => {
		assert.ok(
			isGuarded(phase0, /pr_count=\$\(\s*jq/),
			'Die `pr_count=$(jq …)`-Ableitung in Phase 0 ist un-gesichert. Bei leerem/fehlerhaftem ' +
				'Ergebnis der Search-Pipeline wirft jq einen Fehler → exit 1, noch bevor der "keine PRs"-' +
				'Pfad (pr_count == 0) erreicht wird. Erwartet: Fallback z. B. `|| pr_count=0`.',
		);
	});

	// AK3 Regression-Guard: der „Keine PRs"-Zweig muss als sicherer Exit-0-Pfad erhalten bleiben
	// (heute vorhanden → grün); der Fix darf ihn nicht entfernen.
	it('Phase 0 besitzt einen expliziten Exit-0-Pfad für pr_count == 0', () => {
		assert.match(
			phase0,
			/pr_count.*-eq\s*0/,
			'Der "keine PRs zu bearbeiten"-Zweig (pr_count == 0) fehlt — ohne ihn endet ein Lauf ' +
				'ohne dokumentierbare PRs nicht sauber mit Exit 0.',
		);
	});
});

describe('Issue #532 — Documenter bricht bei reinen Test-/Spec-PRs nicht in Phase 2 ab (main_file grep -vE)', () => {
	// Symptom (Run 31326426415, PR #532 „test: rote Spec für #530"): Log endet direkt nach
	// „✏️ Phase 2: PR-Titel validieren..." mit `exit code 1`. Root-Cause: die main_file-Zuweisung
	//   main_file=$(echo "$pr_files" | grep -vE '(test|spec|...)' | head -1)
	// Eine reine Test-/Spec-PR (TDD-„rote Spec", nur *.spec.ts/*.test.ts) liefert ausschließlich
	// Pfade, die der Filter wegfiltert. `grep -vE` endet dann mit Exit 1 („no matches"), pipefail
	// propagiert das, und `set -e` in der Command-Substitution beendet den Step — bevor jemals
	// „Verbleibende PRs" gedruckt wird. Fix: `|| true`-Fallback, sodass main_file leer wird und der
	// nachfolgende `[ -n "$main_file" ]`-Block scope korrekt leer setzt. Die Strenge
	// (`set -euo pipefail`) bleibt erhalten (analog AK2 aus #519).
	it('die main_file-grep-vE-Zuweisung in Phase 2 ist fail-tolerant (kein exit 1 wenn der Filter alle Pfade entfernt)', () => {
		// Jede Variablen-Zuweisung mit `$(… grep -vE …)` muss einen `||`-Fallback haben — sonst
		// bricht eine reine Test-/Spec-PR (alle Pfade herausgefiltert) den Step über grep-Exit 1.
		const unguarded = phase1to6
			.split('\n')
			.filter((l) => /=\s*\$\([^)]*grep\s+-vE/.test(l))
			.filter((l) => !/\|\|/.test(l));
		assert.equal(
			unguarded.length,
			0,
			'Phase 2 enthält eine `$(… | grep -vE …)`-Zuweisung OHNE `||`-Fallback: filtert `grep -vE` ' +
				'alle Pfade heraus (reine Test-/Spec-PR mit nur *.spec.ts/*.test.ts), endet mit Exit 1 → ' +
				'unter `set -euo pipefail` bricht die Command-Substitution den Job direkt nach „Phase 2: ' +
				'PR-Titel validieren...". Erwartet: `|| true` (main_file wird leer, der ' +
				'`[ -n "$main_file" ]`-Block setzt scope leer). Betroffen: ' +
				JSON.stringify(unguarded),
		);
	});
});

describe('PR-Dokumentation: --add-label akzeptiert nur EINEN komma-separierten String (kein Array, keine Mehrfach-Args)', () => {
	// Symptom (Run zu PR #535): Phase 5 crasht mit
	//   gh pr edit "$pr_number" --repo "$REPO" --add-label "${labels_to_add[@]}"
	//   → accepts at most 1 arg(s), received 2 → exit code 1
	// `--add-label` nimmt genau EINEN Wert (ggf. komma-separiert), die Array-Expandierung
	// `${labels_to_add[@]}` erzeugt aber zwei separate positionale Argumente. Der PR bekommt nie
	// `ai:documented`, taucht im nächsten Lauf wieder auf. Phase 0b (Bot-Kurzbehandlung) trug
	// denselben Bug ("release:ignore" "ai:documented"), verschluckt aber hinter `|| true` still.
	// Dieser Guard verhindert den Rückfall in beide Formen.
	it('kein --add-label mit Array-Expandierung "${labels_to_add[@]}" (erzeugt mehrere Args → Crash)', () => {
		const arrayExpand = code.split('\n').filter((l) => /--add-label\s+["']?\$\{[^}]+\[@\]\}/.test(l));
		assert.equal(
			arrayExpand.length,
			0,
			'`--add-label "${labels_to_add[@]}"` gefunden: Array-Expandierung erzeugt mehrere ' +
				'positionale Argumente, gh akzeptiert aber genau einen (komma-separierten) Wert → ' +
				'"accepts at most 1 arg(s)". Erwartet: komma-joinen, z. B. ' +
				'`labels_csv="$(IFS=,; echo "${labels_to_add[*]}")"` → `--add-label "$labels_csv"`. ' +
				'Betroffen: ' +
				JSON.stringify(arrayExpand),
		);
	});

	it('kein --add-label mit zwei separaten gequoteten Label-Args (gleicher Crash, gleiche Ursache)', () => {
		// Muster: --add-label "x" "y" — zwei Args statt eines komma-separierten Strings.
		const twoArgs = code.split('\n').filter((l) => /--add-label\s+"[^"]+"\s+"[^"]+"/.test(l));
		assert.equal(
			twoArgs.length,
			0,
			'`--add-label "a" "b"` (zwei separate Args) gefunden: gh erwartet EINEN komma-separierten ' +
				'Wert → Crash mit "accepts at most 1 arg(s)". Erwartet: `--add-label "a,b"`. ' +
				'Betroffen: ' +
				JSON.stringify(twoArgs),
		);
	});
});

describe('PR-Dokumentation: Phase 0 stellt alle release:*-Labels sicher (kein "X not found" in Phase 5)', () => {
	// Symptom (Run zu PR #542, NACH Fix des --add-label-Array-Bugs): Phase 5 crasht jetzt mit
	//   gh pr edit "$pr_number" --repo "$REPO" --add-label "ai:documented,release:fix"
	//   → 'release:fix' not found → exit code 1
	// Root-Cause: gh pr edit --add-label bricht hart ab, wenn ein Label im Repo nicht existiert.
	// Phase 0 legte bisher NUR ai:documented an — die fünf release:*-Labels aus Phase 5 nie.
	// Dieser Guard stellt sicher, dass jedes Label, das Phase 5 setzt, in Phase 0 angelegt wird.
	it('Phase 0 legt alle fünf release:*-Labels an (case-Mapping aus Phase 5)', () => {
		const required = [
			'release:feature',
			'release:fix',
			'release:improvement',
			'release:breaking-change',
			'release:engineering',
		];
		const missing = required.filter((label) => !phase0.includes(`"${label}"`));
		assert.equal(
			missing.length,
			0,
			'Phase 0 legt nicht alle release:*-Labels an — gh pr edit --add-label crasht in Phase 5 ' +
				'mit "X not found", wenn ein Label fehlt. Fehlend: ' +
				JSON.stringify(missing),
		);
	});

	it('Phase 0 legt auch ai:documented und release:ignore an (Idempotenz + Bot-Kurzbehandlung)', () => {
		// ai:documented ist die Idempotenz-Invariante; release:ignore wird in Phase 0b (Bot) gesetzt.
		for (const label of ['ai:documented', 'release:ignore']) {
			assert.ok(
				phase0.includes(`"${label}"`),
				`Phase 0 legt '${label}' nicht an — wird im Workflow gesetzt, aber nicht sichergestellt.`,
			);
		}
	});
});

describe('PR-Dokumentation: ai:documented (Idempotenz) scheitert nicht am release:*-Label', () => {
	// Symptom: der kombinierte gh pr edit-Call mit --add-label "ai:documented,release:fix"
	// crascht als GANZES, wenn release:fix fehlt — dann geht ai:documented verloren und der PR
	// taucht im nächsten Lauf wieder auf. ai:documented muss unabhängig vom Release-Label gesetzt
	// werden. Dieser Guard verhindert die Rückkopplung beider Labels in einem einzigen --add-label.
	it('ai:documented und release:* werden NICHT gemeinsam in einem --add-label komma-join gesetzt', () => {
		// Gefährliches Muster: ein einzelnes --add-label, das BEIDE Label-Namen (komma-join) enthält.
		// Crash des Release-Labels reißt dann ai:documented mit — Idempotenz gebrochen.
		const coupled = code
			.split('\n')
			.filter((l) => /--add-label\s+"[^"]*ai:documented[^"]*,/.test(l))
			.filter((l) => /release:/.test(l));
		assert.equal(
			coupled.length,
			0,
			'`--add-label "...,ai:documented,...,release:..."` gefunden: ai:documented ist mit dem ' +
				'release:*-Label gekoppelt. Fehlt das Release-Label im Repo, crasht der Call ALS ' +
				'GANZES — ai:documented (Idempotät-Invariante) geht verloren, der PR taucht im ' +
				'nächsten Lauf wieder auf. Erwartet: ai:documented separat setzen, release:* ' +
				'best-effort (|| true). Betroffen: ' +
				JSON.stringify(coupled),
		);
	});
});

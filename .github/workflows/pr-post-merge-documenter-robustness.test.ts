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

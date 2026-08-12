# ADR 0001 — GitHub-Workflows bleiben ungetestet

- **Status:** Accepted
- **Datum:** 2026-08-12
- **Entscheidungsquelle:** [#567](https://github.com/deleonio/priority-pilot/issues/567) (Teil des Epics [#563 — Teststrategie-Relaunch](https://github.com/deleonio/priority-pilot/issues/563))

## Kontext

Die CI-Workflow-Schicht (`.github/workflows/*.yml`, `.github/scripts/`, das `setup-claude`-Composite,
`ci.yml`/`deploy.yml`-Plumbing) war lange von Meta-Tests begleitet (`.github/workflows/*.test.ts`,
zeitweise ~1423 Zeilen / 92 Tests). Diese Tests werten die Workflow-Definitionen statisch aus:
welche Labels unter welchem Token gesetzt werden, ob Guards vorhanden sind, ob Verdict-Zeilen
korrekt geparsed werden, ob `name:`-Kopplungen stimmen usw.

## Entscheidung

**GitHub-Workflows / das CI-Plumbing werden nicht getestet.** Die bestehende Workflow-Meta-Test-Suite
wird nicht weiter gepflegt und per [#564](https://github.com/deleonio/priority-pilot/issues/564) in
Quarantäne (`__quarantine__/`) verschoben; die CI führt sie nicht mehr aus.

## Begründung

- **Reines Plumbing, keine Domänenlogik.** Die Workflows orchestrieren (Build, Deploy,
  Label-State-Machine, LLM-Aufrufe) — sie enthalten keine fachliche Logik, deren Korrektheit ein
  Test feststellen könnte. Die echte Logik liegt in der Applikation (`server`/`frontend`), die
  eigene Tests hat.
- **Tautologie-Tests ohne Fehlerfangwert.** Die Meta-Tests re-encodieren im Wesentlichen die
  Workflow-Definition selbst („diese YAML enthält genau diesen String / diese Guard-Bedingung").
  Sie werden rot, wenn sich die Workflow-Definition _ändert_ — nicht, wenn etwas _kaputt_ ist.
  Das ist die Change-Detector-Pathologie aus dem Testumfang-Leitsatz
  ([tdd-strategy.md](../../.ai-knowledge/tdd-strategy.md)): sie prüfen nichts, das nicht schon
  dasteht.
- **Blockiert den Pipeline-Umbau.** Jede Workflow-Evolution (neuer Guard,_rename, Refactor) zwingt
  dazu, auch die Meta-Tests umzuschreiben — doppelter Aufwand, der Anpassungen verteuert, ohne
  echten Schutz zurückzugeben. Genau das hat immer wieder zu neuen Workflow-Tests eingeladen
  (Agenten und Phasen sehen eine bestehende Suite als Vorbild und erweitern sie).
- **Fehler fallen ohnehin laut auf.** Workflow-Fehler (falsches Label, fehlender Secret, kaputter
  `gh`-Aufruf) zeigen sich beim nächsten Pipeline-Lauf sofort und sichtbar — dafür ist der Lauf
  selbst da. Ein Test, der das vorab prüft, ist redundantes Doppelwerk.

## Scope (klar abgegrenzt)

**Untested (dieses ADR):**

- `.github/workflows/*.yml` — die Workflow-Definitionen inkl. ihrer eingebetteten `run:`-Bash-Blöcke,
  Label-/Verdict-State-Machine, Guards, Concurrency-Gruppen, Skip-/Supersede-Logik.
- `.github/workflows/*.test.ts` und `.github/scripts/*.test.ts` — die Meta-Tests (werden via #564
  nach `__quarantine__/` verschoben, nicht gelöscht; als Nachschlagewerk erhalten).
- `.github/actions/setup-claude/` und die übrigen Composite-Actions.
- `ci.yml`/`deploy.yml`-Plumbing (Job-Anordnung, Matrix, Caching, Runner-Auswahl).

**Nicht von diesem ADR umfasst (weiterhin testbar, separater Testbedarf):**

- Die **Applikationslogik** (`server/src/**`, `frontend/src/**`) — das ist Domänenlogik, nicht
  Plumbing. Ihre Tests unterliegen #564 (Quarantäne) bzw. dem spec-first-Neuaufbau #566, aber
  grundsätzlich bleibt hier Testbedarf bestehen.
- **E2E** (`frontend/e2e/*.spec.ts`) — funktionales Verhalten gegen das echte Backend; separater
  Testbedarf, separat quarantänt.

## Konsequenzen

- **Akzeptiert:** Workflow-Regressionsrisiko wird beim Pipeline-Betrieb erkannt (sichtbare
  fehlgeschlagene Läufe, manuelles Review), nicht vorab durch Tests abgefangen.
- **Gewinn:** Workflow-Änderungen sind wieder „kostenlos" — kein Meta-Test-Churn, kein
  Doppeltpflege. Die Pipeline kann schneller evolvieren.
- **Gewinn:** Agenten und Spec-Phase bekommen ein klares Signal (dieses ADR + die Regel in
  [tdd-strategy.md](../../.ai-knowledge/tdd-strategy.md) Testumfang) und schreiben keine neuen
  Workflow-Tests mehr.
- **Follow-ups:** [#564](https://github.com/deleonio/priority-pilot/issues/564) (Quarantäne-Verschiebung
  - CI-Test-Steps entfernen), [#566](https://github.com/deleonio/priority-pilot/issues/566)
    (spec-first-Neuaufbau, nur für Domänenlogik).

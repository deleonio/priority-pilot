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

**Getestet wird nur Anwendungscode** (`server/src/**`, `frontend/src/**`) sowie Frontend-E2E
(`frontend/e2e/**`). **Workflows/CI-Plumbing, Config-Dateien und Markdown-Inhalt werden nicht
getestet.** Die gesamte nicht-anwendungsspezifische Meta-Test-Suite (Workflow-, Config- und
Markdown-Inhalt-Tests, u. a. in `.github/workflows/*.test.ts`, `server/src/{ci,docs}/*.test.ts` und
dem `tests/`-Workspace) wurde vollständig **gelöscht** — zunächst per [#564](https://github.com/deleonio/priority-pilot/issues/564)
in Quarantäne (`__quarantine__/`) verschoben, am 2026-08-13 endgültig entfernt; die CI führt nichts
davon mehr aus.

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
- **Blockiert den Pipeline-Umbau.** Jede Workflow-Evolution (neuer Guard, _rename, Refactor) zwingt
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
- `.github/workflows/*.test.ts`, `.github/scripts/*.test.ts`, `server/src/{ci,docs}/*.test.ts` und der
  gesamte `tests/`-Workspace — die Meta-Tests (zuerst 2026-08-12 in `__quarantine__/` verschoben, am
  2026-08-13 vollständig gelöscht auf User-Direktive; #564 hatte die Quarantäne geplant).
- `.github/actions/setup-claude/` und die übrigen Composite-Actions.
- `ci.yml`/`deploy.yml`-Plumbing (Job-Anordnung, Matrix, Caching, Runner-Auswahl).
- **Config-Dateien** (`.yml`/`.json`/`.toml` überall im Repo) — statische Config ist kein Testziel.
- **Markdown-Inhalt (jede `.md`-Datei, egal wo)** — auch Spec-Prompts (`.github/prompts/*.md`),
  `docs/spec/*.md`, `.ai-knowledge/*.md`, `AGENTS.md` usw. String-Match auf Markdown ist ein
  reiner Change-Detector (Präzedenzfälle #549, #557, #568, #569, #595 wurden zurückgebaut).

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
  Doppelpflege. Die Pipeline kann schneller evolvieren.
- **Gewinn:** Agenten und Spec-Phase bekommen ein klares Signal (dieses ADR + die Regel in
  [tdd-strategy.md](../../.ai-knowledge/tdd-strategy.md) Testumfang sowie der
  Nicht-Anwendungscode-Carve-out in [ticket-spec.md](../../.ai-knowledge/ticket-spec.md) Schritt 2,
  auf den der Spec-Prompt verweist) und schreiben keine
  neuen Workflow-/Config-/Markdown-Tests mehr. Das Spec-Gate in `02-claude-spec.yml` setzt das
  operativ um: ein Test zählt nur, wenn er unter `server/src/`, `frontend/src/` oder `frontend/e2e/`
  liegt.
- **Follow-ups:** [#564](https://github.com/deleonio/priority-pilot/issues/564) (Quarantäne-Verschiebung
  / CI-Test-Steps entfernen), [#566](https://github.com/deleonio/priority-pilot/issues/566)
  (spec-first-Neuaufbau, nur für Domänenlogik).

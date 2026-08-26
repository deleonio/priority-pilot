---
name: ticket-spec
description: "Ticket-Spec — rote Tests als ausführbaren Vertrag je Akzeptanzkriterium schreiben (Spec-First, TDD-Gewaltenteilung), Draft-PR erstellen. CI-Phase 3."
---

# Workflow: Ticket-Spec (rote Tests vor der Umsetzung)

Nutzen für freigegebene Tickets — schreibt die **roten Tests** (ausführbarer Vertrag) aus den Akzeptanzkriterien, **bevor** der Produktivcode entsteht.

Diese Stufe ist die **Gewaltenteilung** der TDD-Strategie (Stufe 3, siehe [tdd-strategy.md](../../../.ai-knowledge/tdd-strategy.md)): Wer die Tests schreibt (dieser Workflow), schreibt **nicht** den Code (die Umsetzung, [ticket-implementation](../ticket-implementation/SKILL.md)).

**Auswahlkriterium:** Offene Issues mit Label `ai:needs-spec` (gesetzt von der UX-Phase bei UI-Tickets oder direkt von der Analyse-Phase bei Nicht-UI-Tickets), für die **noch kein** offener (Draft-)PR existiert (Idempotenz).

## Schritt 1 — Ticket wählen & Branch anlegen

- Offene Issues mit `ai:needs-spec` finden: `gh issue list --state open --label "ai:needs-spec" --json number,title --jq '.[] | "\(.number)\t\(.title)"'`
- Eine konkret übergebene Nummer hat Vorrang; sonst der Reihe nach (ältestes zuerst).
- **Idempotenz:** Existiert bereits ein offener PR mit `Closes #<nr>` für das Issue, **nicht** erneut spezifizieren — Lauf beenden.
- Kontext + Analyse laden: den **Akzeptanzkriterien + Testfälle**-Block primär aus dem **Body-Block** des Issues lesen (`gh issue view <nr> --json body -q .body`, Abschnitt zwischen `<!-- KI-ANALYSE:START … -->` und `<!-- KI-ANALYSE:END -->`). Fehlt der Body-Block (Alt-Issue), Fallback auf den jüngsten `🤖 KI-Analyse`-Kommentar.
- Branch von `main` anlegen: `git switch -c feat/issue-<nr>-<kurzname>`.

## Schritt 2 — Spec-First: Spezifikation aktualisieren (VOR der Test-Ableitung)

- Prüfen, ob ein relevanter Spec bereits existiert: `ls docs/spec/*.md`
- **Falls ja** (z. B. `user-journeys.md` für Feature-Änderungen): existierenden Spec erweitern/korrigieren/kürzen — das Verhalten dokumentieren, das getestet werden soll.
- **Falls nein:** neuen Spec `docs/spec/issue-<nr>.md` anlegen — strukturiert nach Ziel/Vorbedingung/Schritte/Erwartetes Ergebnis (Format-Referenz: `user-journeys.md`).
- Spec-Update im **gleichen Commit** wie die Tests (kein separater Commit — der Spec gehört zur Spec-Phase).

## Schritt 3 — Rote Tests schreiben (der Vertrag)

- Tests werden aus dem **Spec** abgeleitet (nicht direkt aus den Akzeptanzkriterien). Jedes AK muss durch den Spec gedeckt sein; jeder Test muss auf den Spec oder ein AK Bezug nehmen.
- **KI-UX-Block beachten:** Hat das Issue UX-Aspekte (KI-UX-Block im Body vorhanden), dessen Anforderungen in die Spec-Ableitung einfließen lassen.
- **Bei Confirm-/Lösch-/Zerstör-Dialogen:** Tests an `docs/ux-pattern-sequential-confirmation.md` orientieren — sequenzielle Ja/Nein-Schritte, verbindliches Fokus-Management beim Übergang.
- Je Akzeptanzkriterium den/die Testfälle als **echte, ausführbare** Tests schreiben — **nur** für Anwendungscode (`server/src/**`, `frontend/src/**`, `frontend/e2e/**`). Testebene und Zieldatei nach Ticket-Typ:
  - **Backend-Logik / API** → `node:test` (`server/src/logics/*.test.ts`, `server/src/express/*.test.ts`).
  - **Frontend-Logik** → Vitest (`frontend/src/lib/*.test.ts`).
  - **Feature / UI-Verhalten** → Akzeptanz-e2e (`frontend/e2e/*.spec.ts`, Stil `crud.spec.ts`).
  - **Reines Styling/Layout** → keinen Test erzwingen; im PR-Body begründen, dass stattdessen visuell verifiziert wird.
  - **Nicht-Anwendungscode** (`.github/workflows`, `.github/scripts`, CI-Plumbing, Config-Dateien, Markdown-Inhalt egal wo) → **keinen Test schreiben**. String/YAML/Config-Match ist ein Change-Detector ohne Biss (ADR 0001).
- **Dedup vor dem Schreiben:** Per `grep` prüfen, ob ein Akzeptanzkriterium bereits durch einen bestehenden Test abgedeckt ist. Bereits abgedeckt → **nicht** duplizieren. Widerspricht ein AK einem bestehenden Test? → den **alten Test ENTFERNEN** und im PR-Body im Abschnitt „Test-Pflege-Bedarf" benennen, warum.
- **So wenig wie möglich, aber jeder mit Biss:** Ein Test muss etwas **auswerten**, einen **Spiegel** zwischen Dateien sichern oder vor einem **stillen/teuren** Ausfall schützen. Kein Test der Form „die Datei enthält den String, den ich hineingeschrieben habe".
- **Red, nicht kaputt:** Jeder Test prüft echtes **Soll-Verhalten** und wird grün, sobald der Produktivcode existiert. Bei **neuen** Funktionen ist ein fehlender Export/Import die legitime erste Rotfärbung; bei **bestehendem** Code zeigt `pnpm test` die neuen Tests als **failing**.
- **Keinen Produktivcode** schreiben — nur Tests (höchstens minimale Test-Helfer/Fixtures).
- **Mutations-Probe vor dem Commit:** Bei zentraler Logik kurz prüfen, dass jeder neue Test wirklich etwas auswertet — gedanklich (oder per Hand) das getestete Verhalten brechen: Würde der Test rot? Ein Test, der auch bei kaputtem Verhalten grün bleibt, hat keinen Biss und fliegt raus.
- **Spec-PR-Scope (Pflicht):** Der Spec-PR darf **nur** `docs/spec/*.md` und rote Tests enthalten — **keine** Implementierung (weder Produktivcode noch CSS noch Config). Jede App-Code-Änderung gehört in den Implementierungs-PR (Phase 4). Werden während der Spec-Phase App-Code-Änderungen nötig, sie im Workspace-Kommentar notieren — Phase 4 nimmt die Anforderung auf.
- **Bei UI-Tickets:** geplante KoliBri-Komponenten (Custom-Element + Properties) via KoliBri-MCP verifizieren, damit Tests die richtigen Elemente adressieren.

## Schritt 4 — Commit, Push, Draft-PR

- Die roten Tests als **eigenen, ersten Commit** committen, z. B. `test: rote Spec-Tests für #<nr>`.
- Branch pushen: `git push -u origin <branch>`.
- **Draft-PR** erstellen: `gh pr create --draft --title "<titel> (#<nr>)" --body "… Closes #<nr> …"`. Body enthält kurze Liste der abgedeckten Akzeptanzkriterien und den Hinweis „rote Spec-Tests; Implementierung folgt".
- Verknüpfung prüfen: `gh pr view <pr> --json closingIssuesReferences --jq '.closingIssuesReferences[].number'` muss `<nr>` enthalten.

## Schritt 5 — Übergabe an die Umsetzung

- Der Workflow setzt am Issue **`ai:needs-impl`** (und konsumiert `ai:needs-spec`). Label bei Bedarf vorher anlegen.
- **Partial-Retry-Hinweis:** Bei Teilerfolg (Spec-PR ohne Tests) setzt der Workflow `ai:needs-spec` neu (Remove-vor-Add).
- **Hard-Fail-Recovery:** Bricht die Post-Assertion ab, bleibt `ai:needs-spec` kleben. Anstoß: `ai:needs-spec` entfernen und neu setzen.

## Hinweise

- Branch/Push/PR/Labels schreiben **öffentlich** auf GitHub — vorher bestätigen lassen.
- Dieser Workflow schreibt **nur Tests**, **keinen** Produktivcode (das ist die bewusste Gewaltenteilung).
- **Bearbeitung durch `/team*`:** Lokal/per Command kann das Multi-Agent-Team die Spec übernehmen. In GitHub Actions läuft die Spec als eigener headless Lauf (`spec.yml`) — getrennt vom Umsetzungs-Lauf.
- Greift die Analyse ein Issue bewusst **nicht** auf 🟢 (🟡/🔴), gibt es keinen Phasen-Trigger — dann entscheidet der Mensch.
- **CI-Mechanik** (VERDICT-Zeilen, Soft-Deadline, Label-Verbot) ist headless-only und ausschließlich in der [.github/prompts/spec.md](.github/prompts/spec.md) geregelt.
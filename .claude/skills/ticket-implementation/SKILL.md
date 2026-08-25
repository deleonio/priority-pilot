---
name: ticket-implementation
description: "Ticket-Umsetzung — freigegebene Issues test-getrieben umsetzen (Red-Green-Refactor), Spec-Draft-PR aufgreifen oder Direkt-Modus, GATE fahren, PR review-bereit machen; umfasst die Fixup-Nacharbeit nach Review (ADR 0005). Nutzen bei ‚implementiere Issue‘, CI-Phase 4."
---

# Workflow: Ticket-Umsetzung (GitHub Issues)

Nutzen für freigegebene Tickets — setzt sie in Code um. Follows **Red → Green → Refactor** gegen die roten Tests aus der Spec-Stufe.

**Auswahlkriterium:** Offene Issues mit Label `ai:needs-impl`, die **noch nicht zugewiesen** sind. Die Zuweisung ist die „in Arbeit"-Markierung.

## Schritt 1 — Ticket wählen & sich zuweisen

- Offene, freigegebene, noch nicht zugewiesene Issues finden: `gh issue list --state open --label "ai:needs-impl" --json number,title,assignees --jq '[.[] | select(.assignees | length == 0)] | .[] | "\(.number)\t\(.title)"'`
- Eine konkret übergebene Nummer hat Vorrang.
- **Sich selbst zuweisen:** `gh issue edit <nr> --add-assignee @me`
- Kontext + Analyse laden: den Analyse-Block aus dem **Body** lesen (`gh issue view <nr> --json body -q .body`); fehlt er, Fallback auf den jüngsten `🤖 KI-Analyse`-Kommentar.
- **Spec-Draft-PR aufgreifen (Regelfall):** Ihn finden und auschecken: `gh pr list --state open --draft --json number,headRefName,closingIssuesReferences` → den PR wählen, dessen `closingIssuesReferences` `<nr>` enthält.
  **Fallback bei leerem `closingIssuesReferences`:** PR-Body prüfen, aber **NUR mit Closing-Keyword** — `grep -Ei "(clos(e|es|ed)|fix(es|ed)?|resolv(e|es|ed))[[:space:]]*:?[[:space:]]*#?<nr>([^0-9]|$)"`. Eine bloße Erwähnung der Nummer zählt **NICHT** (sonst checkt man einen fremden PR aus, der das Issue nur beschreibt — dieselbe Falle wie in `.github/scripts/pr-for-issue.sh`). Dann `git fetch origin` und `git switch <headRefName>`.
- **Idempotenz:** Existiert **kein** Draft-PR, aber ein **Nicht-Draft-PR** mit Closing-Keyword → Umsetzung schon gelaufen → Lauf beenden. Sonst gilt der **Direkt-Modus** (eigener Branch + Tests selbst schreiben).

## Schritt 2 — Analyse lesen & schnell verifizieren

- **Akzeptanzkriterien + Testfälle** aus dem Body-Block übernehmen.
- **Betroffene Dateien prüfen:** existieren die genannten Dateien noch?
- **Ampel 🔴** → nicht umsetzen, begründet kommentieren und stoppen (`VERDICT: not-ready`).
- **Ampel 🟢/🟡** → direkt weiter mit Schritt 3.

**Keine vollständige Re-Triage.** Die Triage-Stufe hat die Arbeit gemacht — die Umsetzung vertraut darauf.

## Schritt 3 — Umsetzen (test-getrieben: Red-Green)

- **Branch:** Im **Spec-Modus** ist der Branch bereits ausgecheckt. Im **Fallback-Modus** eigenen Branch anlegen: `git switch -c feat/issue-<nr>-<kurzname>`.
- **(a) Red — Tests stehen vor dem Code:**
  - **Spec-Modus:** Die **roten Tests liegen bereits** vor (aus der Spec-Stufe). Sie sind der **Vertrag** und werden **nicht geändert**.
  - **Fallback-/Direkt-Modus** (Analyse hat die Spec bewusst übersprungen, Feld „Spec nötig: nein“): Branch selbst anlegen, umsetzen, committen, pushen und den PR **selbst erstellen** (`gh pr create`, **nicht** `--draft` — der PR geht direkt in den Review; ohne diesen Schritt gibt es nichts zu reviewen). **Testpflicht im Direkt-Modus:** Berührt man wider Erwarten doch Anwendungscode (`server/src/**`, `frontend/src/**`, `frontend/e2e/**`), schreibt man die Tests selbst mit — der Test-Carve-out ([ticket-spec](../ticket-spec/SKILL.md) Schritt 3, ADR 0001) gilt NUR für Workflows, Skripte, Config und Markdown. Ist der Umfang dadurch deutlich größer als gedacht, ist das ein Zeichen für eine Fehleinschätzung der Analyse: `VERDICT not-ready` und im PR-Body begründen.
- **(b) Green — Code bis grün:** Produktivcode implementieren, bis **alle** Tests grün sind (`pnpm test`). Konventionen beachten (Tabs, `strict`, ESM). Bei **Frontend-Änderungen** gilt **KoliBri-First**: passende Komponente via KoliBri-MCP finden und einsetzen. Sichtbare UI-Änderungen zusätzlich per Playwright-MCP bei **375px- und 1280px-Viewport** gegen die laufende Inspect-Instanz prüfen.
- **(c) Refactor & Gate (CI-Spiegel, vor jedem Commit):** Erst mit grünen Tests aufräumen, dann das lokale CI-Gate fahren:
  ```
  pnpm format
  pnpm exec prettier --check .
  pnpm lint
  pnpm knip
  pnpm test
  ```
  Bei **geänderten UI-Dateien** zusätzlich den Impeccable-Detektor laufen: `node .claude/skills/impeccable/scripts/detect.mjs <dateien…>`. **SPARSAM:** Für Design-/Layout-Prüfung zuerst die deterministischen, billigen Werkzeuge (Detektor + Regeln aus `docs/mobile-ui-rules.md`); Playwright-MCP nur für den kurzen 375/1280-Layoutbruch-Check bei tatsächlich sichtbaren Änderungen (Screenshot + A11y-Snapshot), NICHT für explorative Design-Analysen.
  **e2e:** `pnpm --filter frontend test:e2e` NUR, wenn die Änderung UI-Verhalten betrifft und ein e2e-Spec dafür existiert — sonst überspringen und im PR-Body vermerken.
  **Bei Confirm-/Lösch-/Zerstör-Dialogen:** `docs/ux-pattern-sequential-confirmation.md` anwenden. **Bei sichtbarer UI:** `docs/mobile-ui-rules.md` anwenden (Touch-Targets ≥44px, async Zustände, Anti-Patterns).
  Erst wenn alle grün sind, committen/pushen.

## Schritt 4 — PR (ready to review) erstellen & verknüpfen

- Änderungen committen (Issue-Bezug in der Message).
- Branch pushen.
- **PR review-bereit machen:**
  - **Spec-Modus:** Den aus der Spec-Stufe vorhandenen **Draft-PR** aus dem Draft holen (`gh pr ready <pr>`) und seine Beschreibung um die Umsetzungs-Zusammenfassung ergänzen.
  - **Fallback-Modus:** Einen normalen PR erstellen: `gh pr create --assignee @me --title "<titel> (#<nr>)" --body "… Closes #<nr> …"`.
- **Development-Verknüpfung:** Das Schlüsselwort `Closes #<nr>` im PR-Body erzeugt die Zuordnung im **„Development"-Bereich**.
- PR-Beschreibung enthält: kurze Umsetzungs-Zusammenfassung, betroffene Dateien, `pnpm format`-/Lint-/**Test**-Ergebnisse.
- **PR abonnieren** — direkt nach dem Erstellen den PR abonnieren, damit eingehende Review-Anmerkungen automatisch die nächste Runde anstoßen.

## Schritt 5 — Kreuzverhör-Loop (umsetzen ⇄ prüfen, bis sauber)

Der frisch erstellte PR wird aktiv im Kreuzverhör geprüft und nachgebessert — in Runden, bis **keine Anmerkung mehr offen** ist.

**PR verfolgen & automatisch reagieren:** Den PR abonnieren und automatisch auf eingehende Review-Anmerkungen, neue Commits und CI-Ergebnisse reagieren.

**Pro Runde:**

1. **Kreuzverhör auslösen** — den vollständigen PR-Diff adversarial prüfen (siehe [review-kreuzverhoer](../review-kreuzverhoer/SKILL.md)). Jedes Finding als verankerter Review-Kommentar gepostet, abgeschlossen mit einem Urteil samt **Ampel** (🟢/🟡/🔴).
2. **CI prüfen** — `gh pr checks <pr>`. Schlägt etwas fehl, Ursache diagnostizieren und beheben.
3. **Findings abarbeiten:**
   - **Zutreffend, klein, eindeutig →** fixen: Fix committen + pushen, `pnpm format && prettier && lint`, im Thread antworten und auflösen.
   - **Mehrdeutig oder architektonisch relevant →** rückfragen, bis Antwort da.
   - **Nicht zutreffend →** sachlich kommentieren, warum nichts geändert wird, und auflösen.
4. **Erneut kreuzverhören** — nach den Fix-Commits den aktualisierten Diff erneut prüfen.

**Abbruchbedingung:** Loop endet, wenn das Kreuzverhör **🟢** urteilt und **keine offenen Findings** mehr übrig sind.

**Schleifenschutz:**

- Antworten knapp halten; nicht jede Fix-Runde einzeln ankündigen.
- Bereits begründet abgelehnte Findings nicht erneut aufmachen.
- Bleiben nach **3 Runden** noch substanzielle Findings offen, den Menschen entscheiden lassen.

## Hinweise

- Zuweisen, Push/PR und Review-Kommentare schreiben **öffentlich** auf GitHub — vorher bestätigen lassen.
- Ergebnis ist ein **review-bereiter PR**, der den Kreuzverhör-Loop durchlaufen hat und weiter verfolgt wird. Der finale Merge bleibt beim Menschen.
- **CI-Mechanik** (VERDICT-Zeilen, Soft-Deadline, Label-Verbot) ist headless-only und ausschließlich in der [CI.md](CI.md) geregelt.
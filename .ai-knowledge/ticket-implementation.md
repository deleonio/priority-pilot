# Workflow: Ticket-Umsetzung (GitHub Issues)

Setzt freigegebene Tickets in Code um — **werkzeug-unabhängig** beschrieben. Konkrete
Slash-Commands (z. B. unter `.claude/commands/`) verweisen nur auf diese Schritte.

Tickets = GitHub-Issues von `deleonio/priority-pilot`. Voraussetzung: `gh` ist authentifiziert.

**Auswahlkriterium:** Umgesetzt werden **offene** Issues mit Label `ai:ready`, die **noch nicht
zugewiesen** sind. Die Zuweisung an sich selbst ist die „in Arbeit"-Markierung und verhindert,
dass dasselbe Ticket doppelt gegriffen wird (idempotenter Batch).

Label-Kette: `ai:analyzed` (analysiert, Analyse im Body-Block) → `ai:ready` (zur Umsetzung
freigegeben) → dieser Workflow setzt um. `ai:ready` wird bei **klarer Analyse (Ampel 🟢)** bereits
von der Triage automatisch gesetzt; bei 🟡/🔴 entscheidet der Mensch und gibt ggf. von Hand frei
(siehe [ticket-triage.md](ticket-triage.md), Schritt 5).

**Bearbeitung durch `/team3`:** Diesen Workflow setzt das cross-funktionale Multi-Agent-Team
`/team3` um — der Ticket-Kontext wird als Aufgabe an `/team3` übergeben. Dessen Architect
orchestriert die Rollen (Developer, Reviewer, Tester, Documenter …) sequentiell und autonom; die
folgenden Schritte beschreiben den fachlichen Ablauf, den das Team abarbeitet. **Abweichend** von
der team3-Standardregel „kein Commit durch das Team" ist die Umsetzung hier **ausdrücklich** zum
Zuweisen, Branch-Anlegen, Committen, Pushen und PR-Erstellen autorisiert (Schritt 4) — genau das
ist das erklärte Ziel dieses Workflows. Diese Abweichung ist damit dokumentiert
(team3-Docs-Konsistenz).

## Schritt 1 — Ticket wählen & sich zuweisen

- Offene, freigegebene, noch nicht zugewiesene Issues finden (index-unabhängig, sofort konsistent):
  `gh issue list --state open --label "ai:ready" --json number,title,assignees --jq '[.[] | select(.assignees | length == 0)] | .[] | "\(.number)\t\(.title)"'`
- Eine konkret übergebene Nummer hat Vorrang.
- Gibt es kein passendes Issue: klar sagen und stoppen (nichts erfinden).
- **Sich selbst zuweisen** (claimt das Ticket): `gh issue edit <nr> --add-assignee @me`
- Kontext + bisherige Analyse laden: den Analyse-Block aus dem **Body** lesen
  (`gh issue view <nr> --json body -q .body`, Abschnitt zwischen `<!-- KI-ANALYSE:START … -->` und
  `<!-- KI-ANALYSE:END -->`); fehlt er (Alt-Issue), Fallback auf den jüngsten `🤖 KI-Analyse`-Kommentar
  (`gh issue view <nr> --comments`)
- **Spec-Draft-PR aufgreifen (Stufe 3, Regelfall):** Die Spec-Stufe ([ticket-spec.md](ticket-spec.md))
  hat in der Regel bereits einen **Draft-PR mit roten Tests** angelegt. Ihn finden und auschecken:
  `gh pr list --state open --draft --json number,headRefName,closingIssuesReferences` → den PR
  wählen, dessen `closingIssuesReferences` `<nr>` enthält, dann `git fetch origin` und
  `git switch <headRefName>`. Existiert **kein** solcher Draft-PR (z. B. der Mensch hat `ai:ready`
  direkt gesetzt, ohne Spec-Stufe), gilt der **Fallback-Modus** (eigener Branch + Tests selbst
  schreiben, Schritt 3).

## Schritt 2 — Analyse gegen den aktuellen Repo-Stand verifizieren (Re-Triage)

Die im `ai:analyzed`-Body-Block hinterlegte Analyse **nicht ungeprüft übernehmen**: Zwischen Analyse
und Umsetzung kann sich der Repo-Stand geändert haben (neue/umbenannte Dateien, geänderte APIs,
bereits erledigte Teile). Deshalb beim Lesen des Tickets die Analyse **erneut analysieren**.

- **Re-Triage ausführen** — den Analyse-Workflow erneut auf das Ticket anwenden
  ([ticket-triage.md](ticket-triage.md), Schritt 1 — Re-Triage; Command `/triage-ticket <nr>`):
  aus Titel + (lektorierter) Beschreibung + **aktuellem** Repo erneut eine Lösung konzipieren
  (relevante Dateien via Grep/Glob/Read) und mit der vorhandenen Analyse abgleichen — dabei auch die
  **Akzeptanzkriterien + Testfälle** (Triage Schritt 4) auf Aktualität/Vollständigkeit prüfen, da sie
  der Umsetzung in Schritt 3 als Zielvorgabe dienen.
- **Noch konform →** die Analyse bildet den aktuellen Stand korrekt ab; unverändert weiter mit
  Schritt 3.
- **Nicht mehr konform / unvollständig →** die Analyse **aktualisieren** (den Analyse-Block im Body
  **in-place** neu schreiben, der den Stand korrigiert/vervollständigt, siehe ticket-triage.md
  Schritt 1/4) und erst auf dieser aktualisierten Analyse implementieren.
- **Ampel kippt auf 🔴** (Anforderung passt nicht mehr zum Repo, widersprüchlich, Infos fehlen) →
  **nicht** blind umsetzen, sondern den Stand zusammenfassen und den Menschen entscheiden lassen.

Diese Verifikation ist Teil des `/team3`-Laufs (der Architect ordnet sie **vor** der Implementierung
ein); sie ändert nur Analyse/Kommentare, **keinen** Produktivcode.

## Schritt 3 — Umsetzen (test-getrieben: Red-Green)

Grundlage ist der **Akzeptanzkriterien + Testfälle**-Block aus der Triage
([ticket-triage.md](ticket-triage.md) Schritt 4; Hintergrund: [tdd-strategy.md](tdd-strategy.md)).
Die Umsetzung folgt **Red → Green → Refactor**: die Tests sind der ausführbare Vertrag, der Code
wird dagegen geschrieben — ein binäres Ziel statt Prosa.

- **Branch:** Im **Spec-Modus** (Stufe 3, Regelfall) ist der Branch des Spec-Draft-PRs bereits
  ausgecheckt (Schritt 1). Im **Fallback-Modus** (kein Spec-PR) einen eigenen Branch anlegen (nicht
  auf `main`): `git switch -c feat/issue-<nr>-<kurzname>`.
- **(a) Red — Tests stehen vor dem Code:**
  - **Spec-Modus:** Die **roten Tests liegen bereits** vor (aus der Spec-Stufe). Sie sind der
    **Vertrag** und werden **nicht geändert** (Gewaltenteilung: wer den Code schreibt, ändert den
    Spec-Test nicht). Ist ein Spec-Test nachweislich falsch/unpassend zum geklärten Soll, **nicht**
    still editieren, sondern im PR/Issue begründet zurückmelden und ggf. Re-Triage anstoßen — der
    Mensch entscheidet.
  - **Fallback-Modus:** Je Akzeptanzkriterium den Testfall schreiben, **bevor** der Produktivcode
    entsteht (rot, als **erster Commit** `test: … (#<nr>)`). Testebene/Zieldatei nach Ticket-Typ:
    - **Backend-Logik / API** → `node:test` (`server/src/logics/*.test.ts`,
      `server/src/express/*.test.ts`).
    - **Frontend-Logik** → Vitest (`frontend/src/lib/*.test.ts`).
    - **Feature / UI-Verhalten** → Akzeptanz-e2e (`frontend/e2e/*.spec.ts`, Stil `crud.spec.ts`).
    - **Reines Styling/Layout** → keinen Unit-Test erzwingen: wo sinnvoll per e2e absichern, sonst
      visuell verifizieren und **im PR begründen**.
- **(b) Green — Code bis grün:** Produktivcode implementieren, bis **alle** Tests grün sind
  (`pnpm test` bzw. gezielt das betroffene Package als primärer Erfolgsindikator). Konventionen aus
  [conventions.md](conventions.md) beachten (Tabs, `strict`, ESM, keine Type-Assertions zum
  Unterdrücken von Fehlern). Tests **nicht** dem Code anpassen, um sie künstlich grün zu bekommen —
  im **Spec-Modus** sind die Spec-Tests ohnehin unantastbar (s. o.); im **Fallback-Modus** einen
  fehlerhaften eigenen Test **bewusst** und nachvollziehbar korrigieren.
- **(c) Refactor & Gate (CI-Spiegel, vor jedem Commit):** Erst mit grünen Tests aufräumen,
  dann das lokale CI-Gate fahren — exakt wie `ci.yml`:
  ```
  pnpm format                      # schreibt Formatierung
  pnpm exec prettier --check .     # verifiziert (wie CI-Format-Check)
  pnpm lint                        # repo-weit (CI lintet rekursiv, nicht nur ein Package)
  ```
  Erst wenn alle drei Kommandos grün sind, committen/pushen. Ein Format-/Lint-Fehler darf
  nicht in CI laufen.

## Schritt 4 — PR (ready to review) erstellen & mit dem Ticket verknüpfen

- Änderungen committen (Issue-Bezug in der Message, z. B. `… (#<nr>)`).
- Branch pushen (`git push`; im **Spec-Modus** auf den bereits bestehenden Branch des Draft-PRs).
- **PR review-bereit machen:**
  - **Spec-Modus (Stufe 3):** Den aus der Spec-Stufe vorhandenen **Draft-PR** aus dem Draft holen
    (`gh pr ready <pr>`) und seine Beschreibung um die Umsetzungs-Zusammenfassung ergänzen — **keinen
    neuen PR** anlegen (er ist via `Closes #<nr>` bereits mit dem Ticket verknüpft).
  - **Fallback-Modus:** Einen normalen PR (ohne `--draft`, sofort review-bereit) erstellen:
    `gh pr create --assignee @me --title "<titel> (#<nr>)" --body "… Closes #<nr> …"`.
- **Development-Verknüpfung (Ticket ↔ PR):** Das Schlüsselwort `Closes #<nr>` im PR-Body
  (Ziel-Branch = `main`) erzeugt genau die Zuordnung im **„Development"-Bereich** — der PR wird
  dem Ticket zugeordnet und schließt es beim Merge. Einen separaten `gh`-Befehl dafür gibt es
  nicht; das Schlüsselwort (im PR-Body oder Commit) ist der unterstützte Automatisierungsweg.
- PR-Beschreibung enthält außerdem: kurze Umsetzungs-Zusammenfassung, betroffene Dateien und die
  `pnpm format`-/Lint-/**Test**-Ergebnisse (siehe [conventions.md](conventions.md); Test-Ergebnisse
  sind seit Stufe 2 Pflicht, vgl. PR-Template).
- Verknüpfung prüfen: `gh pr view <pr> --json closingIssuesReferences --jq '.closingIssuesReferences[].number'`
  muss `<nr>` enthalten.
- Der PR ist **ready to review** (kein Draft) — die finale Freigabe/der Merge erfolgt durch einen Menschen.
- **PR verfolgen** — direkt nach dem Erstellen den PR **abonnieren**, damit eingehende
  Review-Anmerkungen, neue Commits und CI-Ergebnisse in der Session landen und automatisch die
  nächste Runde aus Schritt 5 anstoßen (in Claude Code: `subscribe_pr_activity` für den neuen PR).

## Schritt 5 — Kreuzverhör-Loop (umsetzen ⇄ prüfen, bis sauber)

Der frisch erstellte PR wird **nicht nur beobachtet, sondern aktiv im Kreuzverhör geprüft und
nachgebessert** — in Runden, bis **keine Anmerkung mehr offen** ist. Eine Runde besteht aus
_kreuzverhören → CI prüfen → Findings abarbeiten → erneut kreuzverhören_. Dabei sind zwei Rollen
strikt getrennt: Die **Kreuzverhör-Rolle** prüft nur und ändert keinen Code (vollständiger Ablauf:
[pr-review.md](pr-review.md), Command `/kreuzverhoer-review`); die **Umsetzer-Rolle** behebt die
Findings.

**PR verfolgen & automatisch reagieren:** Den frisch erstellten PR **abonnieren** und danach
**automatisch auf eingehende Review-Anmerkungen reagieren**. Eine Runde wird damit nicht nur vom
eigenen Kreuzverhör angestoßen, sondern auch von **neuen Review-Kommentaren** (von Menschen oder aus
`/kreuzverhoer-review`), **neuen Commits** und **CI-Ergebnissen** auf dem PR. In Claude Code: direkt
nach Schritt 4 `subscribe_pr_activity` für den neuen PR aufrufen; die Events wecken die Session und
stoßen die nächste Runde an. Eingehende Anmerkungen werden wie eigene Findings behandelt (siehe
„Pro Runde", Punkt 3) — bei Mehrdeutigkeit oder architektonisch relevanten Punkten **vorher
rückfragen** statt zu raten.

**Pro Runde:**

1. **Kreuzverhör auslösen** — den vollständigen PR-Diff adversarial gegen Ticket-Ziel, Edge Cases,
   Einfachheit, Performance/Security und Projekt-Konventionen prüfen (siehe [pr-review.md](pr-review.md)).
   Jedes Finding wird als an Datei/Zeile **verankerter** Review-Kommentar gepostet, abgeschlossen mit
   einem Urteil samt **Ampel** (🟢/🟡/🔴).
2. **CI prüfen** — `gh pr checks <pr>`. Schlägt etwas fehl, die Ursache diagnostizieren und — im
   Rahmen des Tickets — beheben (zählt als Finding der Runde). In der GitHub-Actions-Pipeline ist
   dieser Schritt zusätzlich deterministisch abgesichert: Der Gate/Auto-Merge-Workflow
   (`.github/workflows/claude-pr-gate-merge.yml`) prüft nach Abschluss die Allowlist-Checks **CI**
   und **Reviewer** und setzt bei rotem Ergebnis `ai:needs-changes` → der Fixup läuft an (bei beiden
   grün + `ai:ready-to-merge` mergt derselbe Workflow den PR).
3. **Findings abarbeiten** (Umsetzer-Rolle) — jeden offenen Punkt behandeln:
   - **Zutreffend, klein, eindeutig →** **fixen**: Fix committen + pushen, erneut
     `pnpm format && pnpm exec prettier --check . && pnpm lint`, kurz im Thread antworten
     (Bezug zum Fix-Commit) und den Thread **auflösen**.
   - **Mehrdeutig oder architektonisch relevant →** **nicht** raten, sondern **vorher rückfragen**;
     den Punkt bis zur Antwort offen lassen.
   - **Nicht zutreffend / kein Handlungsbedarf →** sachlich **kommentieren**, warum nichts geändert
     wird, und den Thread auflösen (nicht stillschweigend ignorieren).
4. **Erneut kreuzverhören** — nach den Fix-Commits den **aktualisierten** Diff erneut prüfen
   (zurück zu Schritt 1 dieser Runde). So entsteht das „Hin und Her", bis nichts mehr offen ist.

**Abbruchbedingung (eigene Kreuzverhör-Runden):** Der selbst angestoßene Loop endet, wenn das
Kreuzverhör **🟢** urteilt und **keine offenen Findings** mehr übrig sind (alle gefixt, auflösend
kommentiert oder mit dem Menschen geklärt). Ergebnis ist ein durchgeprüfter, review-bereiter PR —
der finale Merge bleibt beim Menschen.

**Verfolgung bleibt aktiv:** Das PR-Abo läuft darüber hinaus weiter. Kommen **später**
Review-Anmerkungen, neue Commits oder CI-Fehler herein, wird **erneut reagiert** (neue Runde nach
demselben Schema). Die Verfolgung endet, sobald der PR **gemergt oder geschlossen** ist oder der
Mensch sie stoppt — dann das Abo **aktiv beenden** (in Claude Code: `unsubscribe_pr_activity`
aufrufen), damit keine unnötigen Session-Weckrufe offen bleiben. Da nicht alle Zustände als Event
ankommen (CI-Erfolg, neue Pushes, Merge-Konflikt-Wechsel), den PR-Stand zwischendurch aktiv
nachprüfen (`gh pr checks`, `gh pr view`) statt sich allein auf Events zu verlassen.

**Schleifenschutz:**

- Antworten knapp halten; nicht jede Fix-Runde einzeln ankündigen — der PR-Diff ist der Nachweis.
- Bereits begründet abgelehnte Findings nicht erneut aufmachen — sonst dreht sich der Loop endlos.
- Bleiben nach **3 Runden** noch substanzielle oder mehrdeutige Findings offen, **nicht endlos
  weiterdrehen**, sondern den Stand zusammenfassen und den **Menschen** entscheiden lassen.

## Hinweise

- Zuweisen (Schritt 1), ein ggf. aktualisierter Re-Analyse-Body-Block (Schritt 2), Push/PR
  (Schritt 4) und die Review-Kommentare des Kreuzverhörs (Schritt 5) schreiben **öffentlich** auf
  GitHub — vor dem Posten bestätigen lassen.
- Ergebnis des Workflows ist ein **review-bereiter PR** (ready to review), der den Kreuzverhör-Loop
  durchlaufen hat und **weiter verfolgt** wird — eingehende Review-Anmerkungen werden bis zum
  Merge/Schließen automatisch nachbearbeitet. Der finale Merge bleibt beim Menschen.

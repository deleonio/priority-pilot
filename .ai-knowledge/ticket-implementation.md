# Workflow: Ticket-Umsetzung (GitHub Issues)

Setzt freigegebene Tickets in Code um — **werkzeug-unabhängig** beschrieben. Konkrete
Slash-Commands (z. B. unter `.claude/commands/`) verweisen nur auf diese Schritte.

Tickets = GitHub-Issues von `deleonio/priority-pilot`. Voraussetzung: `gh` ist authentifiziert.

**Auswahlkriterium:** Umgesetzt werden **offene** Issues mit Label `ai:ready`, die **noch nicht
zugewiesen** sind. Die Zuweisung an sich selbst ist die „in Arbeit"-Markierung und verhindert,
dass dasselbe Ticket doppelt gegriffen wird (idempotenter Batch).

Label-Kette: `ai:analyzed` (analysiert, Vorschlag als Kommentar) → vom Menschen auf `ai:ready`
gesetzt (zur Umsetzung freigegeben) → dieser Workflow setzt um.

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
- Kontext + bisherige Analyse laden: `gh issue view <nr> --comments`

## Schritt 2 — Analyse gegen den aktuellen Repo-Stand verifizieren (Re-Triage)

Die im `ai:analyzed`-Kommentar hinterlegte Analyse **nicht ungeprüft übernehmen**: Zwischen Analyse
und Umsetzung kann sich der Repo-Stand geändert haben (neue/umbenannte Dateien, geänderte APIs,
bereits erledigte Teile). Deshalb beim Lesen des Tickets die Analyse **erneut analysieren**.

- **Re-Triage ausführen** — den Analyse-Workflow erneut auf das Ticket anwenden
  ([ticket-triage.md](ticket-triage.md), Schritt 1 — Re-Triage; Command `/triage-ticket <nr>`):
  aus Titel + (lektorierter) Beschreibung + **aktuellem** Repo erneut eine Lösung konzipieren
  (relevante Dateien via Grep/Glob/Read) und mit der vorhandenen Analyse abgleichen.
- **Noch konform →** die Analyse bildet den aktuellen Stand korrekt ab; unverändert weiter mit
  Schritt 3.
- **Nicht mehr konform / unvollständig →** die Analyse **aktualisieren** (neuer
  `ai:analyzed`-Kommentar, der den Stand korrigiert/vervollständigt, siehe ticket-triage.md
  Schritt 1/4) und erst auf dieser aktualisierten Analyse implementieren.
- **Ampel kippt auf 🔴** (Anforderung passt nicht mehr zum Repo, widersprüchlich, Infos fehlen) →
  **nicht** blind umsetzen, sondern den Stand zusammenfassen und den Menschen entscheiden lassen.

Diese Verifikation ist Teil des `/team3`-Laufs (der Architect ordnet sie **vor** der Implementierung
ein); sie ändert nur Analyse/Kommentare, **keinen** Produktivcode.

## Schritt 3 — Umsetzen

- Grundlage: der im `ai:analyzed`-Kommentar vorgeschlagene Lösungsweg (falls vorhanden), sonst
  aus Titel + Beschreibung + Repo ableiten.
- Auf eigenem Branch arbeiten (nicht auf `main`): `git switch -c feat/issue-<nr>-<kurzname>`
- Änderungen umsetzen — Konventionen aus [conventions.md](conventions.md) beachten (Tabs, `strict`,
  ESM, keine Type-Assertions zum Unterdrücken von Fehlern).
- Gezielt prüfen: `pnpm format` und `pnpm --filter priority-pilot lint` (bzw. betroffenes Package).

## Schritt 4 — PR (ready to review) erstellen & mit dem Ticket verknüpfen

- Änderungen committen (Issue-Bezug in der Message, z. B. `… (#<nr>)`).
- Branch pushen: `git push -u origin <branch>`.
- **Pull-Request (ready to review)** erstellen — ein normaler PR ist ohne `--draft` sofort
  review-bereit:
  `gh pr create --assignee @me --title "<titel> (#<nr>)" --body "… Closes #<nr> …"`
- **Development-Verknüpfung (Ticket ↔ PR):** Das Schlüsselwort `Closes #<nr>` im PR-Body
  (Ziel-Branch = `main`) erzeugt genau die Zuordnung im **„Development"-Bereich** — der PR wird
  dem Ticket zugeordnet und schließt es beim Merge. Einen separaten `gh`-Befehl dafür gibt es
  nicht; das Schlüsselwort (im PR-Body oder Commit) ist der unterstützte Automatisierungsweg.
- PR-Beschreibung enthält außerdem: kurze Umsetzungs-Zusammenfassung, betroffene Dateien und die
  `pnpm format`-/Lint-Ergebnisse (siehe [conventions.md](conventions.md)).
- Verknüpfung prüfen: `gh pr view <pr> --json closingIssuesReferences --jq '.closingIssuesReferences[].number'`
  muss `<nr>` enthalten.
- Der PR ist **ready to review** (kein Draft) — die finale Freigabe/der Merge erfolgt durch einen Menschen.

## Schritt 5 — Kreuzverhör-Loop (umsetzen ⇄ prüfen, bis sauber)

Der frisch erstellte PR wird **nicht nur beobachtet, sondern aktiv im Kreuzverhör geprüft und
nachgebessert** — in Runden, bis **keine Anmerkung mehr offen** ist. Eine Runde besteht aus
*kreuzverhören → CI prüfen → Findings abarbeiten → erneut kreuzverhören*. Dabei sind zwei Rollen
strikt getrennt: Die **Kreuzverhör-Rolle** prüft nur und ändert keinen Code (vollständiger Ablauf:
[pr-review.md](pr-review.md), Command `/kreuzverhoer-review`); die **Umsetzer-Rolle** behebt die
Findings.

**Pro Runde:**

1. **Kreuzverhör auslösen** — den vollständigen PR-Diff adversarial gegen Ticket-Ziel, Edge Cases,
   Einfachheit, Performance/Security und Projekt-Konventionen prüfen (siehe [pr-review.md](pr-review.md)).
   Jedes Finding wird als an Datei/Zeile **verankerter** Review-Kommentar gepostet, abgeschlossen mit
   einem Urteil samt **Ampel** (🟢/🟡/🔴).
2. **CI prüfen** — `gh pr checks <pr>`. Schlägt etwas fehl, die Ursache diagnostizieren und — im
   Rahmen des Tickets — beheben (zählt als Finding der Runde).
3. **Findings abarbeiten** (Umsetzer-Rolle) — jeden offenen Punkt behandeln:
   - **Zutreffend, klein, eindeutig →** **fixen**: Fix committen + pushen, erneut `pnpm format` +
     Lint, kurz im Thread antworten (Bezug zum Fix-Commit) und den Thread **auflösen**.
   - **Mehrdeutig oder architektonisch relevant →** **nicht** raten, sondern **vorher rückfragen**;
     den Punkt bis zur Antwort offen lassen.
   - **Nicht zutreffend / kein Handlungsbedarf →** sachlich **kommentieren**, warum nichts geändert
     wird, und den Thread auflösen (nicht stillschweigend ignorieren).
4. **Erneut kreuzverhören** — nach den Fix-Commits den **aktualisierten** Diff erneut prüfen
   (zurück zu Schritt 1 dieser Runde). So entsteht das „Hin und Her", bis nichts mehr offen ist.

**Abbruchbedingung:** Der Loop endet, wenn das Kreuzverhör **🟢** urteilt und **keine offenen
Findings** mehr übrig sind (alle gefixt, auflösend kommentiert oder mit dem Menschen geklärt).
Ergebnis ist ein durchgeprüfter, review-bereiter PR — der finale Merge bleibt beim Menschen.

**Schleifenschutz:**

- Antworten knapp halten; nicht jede Fix-Runde einzeln ankündigen — der PR-Diff ist der Nachweis.
- Bereits begründet abgelehnte Findings nicht erneut aufmachen — sonst dreht sich der Loop endlos.
- Bleiben nach **3 Runden** noch substanzielle oder mehrdeutige Findings offen, **nicht endlos
  weiterdrehen**, sondern den Stand zusammenfassen und den **Menschen** entscheiden lassen.

> In Claude Code lässt sich der Loop unterstützen: Den PR per `subscribe_pr_activity` abonnieren —
> neue Commits, CI- und Review-Events landen dann direkt in der Session und stoßen die nächste
> Kreuzverhör-Runde an.

## Hinweise

- Zuweisen (Schritt 1), ein ggf. aktualisierter Re-Analyse-Kommentar (Schritt 2), Push/PR
  (Schritt 4) und die Review-Kommentare des Kreuzverhörs (Schritt 5) schreiben **öffentlich** auf
  GitHub — vor dem Posten bestätigen lassen.
- Ergebnis des Workflows ist ein **review-bereiter PR** (ready to review), der den Kreuzverhör-Loop
  durchlaufen hat — kein Merge.

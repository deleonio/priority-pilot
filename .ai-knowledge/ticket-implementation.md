# Workflow: Ticket-Umsetzung (GitHub Issues)

Setzt freigegebene Tickets in Code um — **werkzeug-unabhängig** beschrieben. Konkrete
Slash-Commands (z. B. unter `.claude/commands/`) verweisen nur auf diese Schritte.

Tickets = GitHub-Issues von `deleonio/priority-pilot`. Voraussetzung: `gh` ist authentifiziert.

**Auswahlkriterium:** Umgesetzt werden **offene** Issues mit Label `ai:ready`, die **noch nicht
zugewiesen** sind. Die Zuweisung an sich selbst ist die „in Arbeit"-Markierung und verhindert,
dass dasselbe Ticket doppelt gegriffen wird (idempotenter Batch).

Label-Kette: `ai:analyzed` (analysiert, Vorschlag als Kommentar) → vom Menschen auf `ai:ready`
gesetzt (zur Umsetzung freigegeben) → dieser Workflow setzt um.

## Schritt 1 — Ticket wählen & sich zuweisen

- Offene, freigegebene, noch nicht zugewiesene Issues finden (index-unabhängig, sofort konsistent):
  `gh issue list --state open --label "ai:ready" --json number,title,assignees --jq '[.[] | select(.assignees | length == 0)] | .[] | "\(.number)\t\(.title)"'`
- Eine konkret übergebene Nummer hat Vorrang.
- Gibt es kein passendes Issue: klar sagen und stoppen (nichts erfinden).
- **Sich selbst zuweisen** (claimt das Ticket): `gh issue edit <nr> --add-assignee @me`
- Kontext + bisherige Analyse laden: `gh issue view <nr> --comments`

## Schritt 2 — Umsetzen

- Grundlage: der im `ai:analyzed`-Kommentar vorgeschlagene Lösungsweg (falls vorhanden), sonst
  aus Titel + Beschreibung + Repo ableiten.
- Auf eigenem Branch arbeiten (nicht auf `main`): `git switch -c feat/issue-<nr>-<kurzname>`
- Änderungen umsetzen — Konventionen aus [conventions.md](conventions.md) beachten (Tabs, `strict`,
  ESM, keine Type-Assertions zum Unterdrücken von Fehlern).
- Gezielt prüfen: `pnpm format` und `pnpm --filter priority-pilot lint` (bzw. betroffenes Package).

## Schritt 3 — PR (ready to review) erstellen & mit dem Ticket verknüpfen

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

## Schritt 4 — PR beobachten & Review-Kommentare behandeln

Nach dem Erstellen den PR **weiter beobachten** (CI-Status und eingehende Review-Kommentare) und
darauf reagieren, bis er **gemergt oder geschlossen** ist.

- **CI prüfen:** Status der Checks ansehen (`gh pr checks <pr>`). Schlägt etwas fehl, die Ursache
  diagnostizieren und — wenn im Rahmen des Tickets — beheben (Fix committen, pushen, erneut
  `pnpm format` + Lint).
- **Review-Kommentare** der Reihe nach durchgehen und je nach Fall behandeln:
  - **Zutreffend, klein, eindeutig →** direkt **umsetzen**: Fix committen + pushen, kurz im Thread
    antworten (Bezug zum Fix-Commit) und den Thread auflösen.
  - **Mehrdeutig oder architektonisch relevant →** **nicht** raten, sondern **vorher rückfragen**.
  - **Nicht zutreffend / kein Handlungsbedarf →** sachlich **kommentieren**, warum nichts geändert
    wird (statt stillschweigend zu ignorieren).
- Antworten knapp halten; nicht jede Fix-Runde einzeln ankündigen — der PR-Diff ist der Nachweis.
- Der PR ist **ready to review**: Fixes verbessern ihn, der finale Merge bleibt beim Menschen.

> In Claude Code lässt sich das Beobachten automatisieren: Der PR kann per
> `subscribe_pr_activity` abonniert werden, dann landen CI- und Review-Events direkt in der Session.
> Kritische Reviews liefert der Command `/kreuzverhoer-review` (siehe [pr-review.md](pr-review.md)).

## Hinweise

- Zuweisen (Schritt 1) und Push/PR (Schritt 3) schreiben **öffentlich** auf GitHub —
  vor dem Push/PR bestätigen lassen.
- Ergebnis des Workflows ist ein **review-bereiter PR** (ready to review), kein Merge.

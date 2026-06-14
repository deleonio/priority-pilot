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

## Schritt 3 — Draft-PR erstellen & mit dem Ticket verknüpfen

- Änderungen committen (Issue-Bezug in der Message, z. B. `… (#<nr>)`).
- Branch pushen: `git push -u origin <branch>`.
- **Draft-Pull-Request** erstellen:
  `gh pr create --draft --assignee @me --title "<titel> (#<nr>)" --body "… Closes #<nr> …"`
- **Development-Verknüpfung (Ticket ↔ PR):** Das Schlüsselwort `Closes #<nr>` im PR-Body
  (Ziel-Branch = `main`) erzeugt genau die Zuordnung im **„Development"-Bereich** — der PR wird
  dem Ticket zugeordnet und schließt es beim Merge. Einen separaten `gh`-Befehl dafür gibt es
  nicht; das Schlüsselwort (im PR-Body oder Commit) ist der unterstützte Automatisierungsweg.
- PR-Beschreibung enthält außerdem: kurze Umsetzungs-Zusammenfassung, betroffene Dateien und die
  `pnpm format`-/Lint-Ergebnisse (siehe [conventions.md](conventions.md)).
- Verknüpfung prüfen: `gh pr view <pr> --json closingIssuesReferences --jq '.closingIssuesReferences[].number'`
  muss `<nr>` enthalten.
- Der PR bleibt **Draft** — die finale Freigabe/der Merge erfolgt durch einen Menschen.

## Hinweise

- Zuweisen (Schritt 1) und Push/Draft-PR (Schritt 3) schreiben **öffentlich** auf GitHub —
  vor dem Push/PR bestätigen lassen.
- Ergebnis des Workflows ist ein **Draft-PR**, kein Merge.

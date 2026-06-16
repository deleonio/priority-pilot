---
description: Setzt offene Issues mit Label ai:ready um und weist sie dir zu
argument-hint: '[issue-nummer]'
allowed-tools: Bash(gh issue list:*), Bash(gh issue view:*), Bash(gh issue edit:*), Bash(gh pr create:*), Bash(gh pr view:*), Bash(gh pr diff:*), Bash(gh pr checks:*), Bash(gh pr comment:*), Bash(gh pr review:*), Bash(gh api:*), Bash(git switch:*), Bash(git status:*), Bash(git diff:*), Bash(git add:*), Bash(git commit:*), Bash(git push:*), Bash(pnpm:*), Read, Edit, Write, Grep, Glob
---

Führe den Umsetzungs-Workflow aus der Wissensbasis aus: @.ai-knowledge/ticket-implementation.md

Ziel-Issue: $ARGUMENTS (leer = offene Issues mit Label `ai:ready` **ohne** Assignee, ältestes zuerst).

Pro Ticket:

1. **Zuweisen** — sich selbst zuweisen (`gh issue edit <nr> --add-assignee @me`).
2. **Umsetzen** — Lösung aus dem `ai:analyzed`-Kommentar bzw. Titel + Beschreibung + Repo in Code;
   auf eigenem Branch, Konventionen beachten, anschließend `pnpm format` + Lint.
3. **PR (ready to review) + Ticket-Verknüpfung** — committen, Branch pushen, PR erstellen
   (`gh pr create --assignee @me`, **kein** `--draft` → sofort review-bereit); `Closes #<nr>` im
   Body verknüpft den PR mit dem Ticket (erscheint im „Development"-Bereich, schließt es beim
   Merge). PR-Beschreibung mit format-/lint-Ergebnissen.
4. **Kreuzverhör-Loop (umsetzen ⇄ prüfen)** — den PR in Runden kritisch prüfen und nachbessern,
   bis **keine Anmerkung mehr offen** ist. Pro Runde:
   1. **Kreuzverhör** auslösen — den vollständigen PR-Diff adversarial prüfen (siehe
      `/kreuzverhoer-review` bzw. [pr-review.md](../../.ai-knowledge/pr-review.md)); Findings als an
      Datei/Zeile **verankerte** Review-Kommentare posten, mit Urteil + **Ampel** (🟢/🟡/🔴). Die
      Kreuzverhör-Rolle ändert **keinen** Code.
   2. **CI prüfen** (`gh pr checks`) — Fehler diagnostizieren und im Ticket-Rahmen beheben.
   3. **Findings abarbeiten** — zutreffende, kleine, eindeutige Punkte direkt **fixen** (committen,
      pushen, `pnpm format` + Lint, im Thread antworten + **auflösen**); bei Mehrdeutigkeit oder
      architektonisch relevanten Änderungen **vorher rückfragen**; sonst begründet **kommentieren**
      und auflösen.
   4. **Erneut kreuzverhören** auf dem aktualisierten Diff — zurück zu (1).
   **Ende:** Urteil **🟢** und keine offenen Findings mehr. Bereits begründet abgelehnte Findings
   nicht erneut aufmachen; bleiben nach **3 Runden** substanzielle/mehrdeutige Punkte offen, den
   Stand zusammenfassen und den **Menschen** entscheiden lassen (nicht endlos weiterdrehen).

Zuweisen, Push/PR und die Review-Kommentare des Kreuzverhörs schreiben öffentlich auf GitHub —
vorher bestätigen lassen.

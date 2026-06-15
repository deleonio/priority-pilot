---
description: Setzt offene Issues mit Label ai:ready um und weist sie dir zu
argument-hint: '[issue-nummer]'
allowed-tools: Bash(gh issue list:*), Bash(gh issue view:*), Bash(gh issue edit:*), Bash(gh pr create:*), Bash(gh pr view:*), Bash(gh pr checks:*), Bash(gh pr comment:*), Bash(gh pr review:*), Bash(gh api:*), Bash(git switch:*), Bash(git status:*), Bash(git diff:*), Bash(git add:*), Bash(git commit:*), Bash(git push:*), Bash(pnpm:*), Read, Edit, Write, Grep, Glob
---

Führe den Umsetzungs-Workflow aus der Wissensbasis aus: @.ai-knowledge/ticket-implementation.md

Ziel-Issue: $ARGUMENTS (leer = offene Issues mit Label `ai:ready` **ohne** Assignee, ältestes zuerst).

Pro Ticket:

1. **Zuweisen** — sich selbst zuweisen (`gh issue edit <nr> --add-assignee @me`).
2. **Umsetzen** — Lösung aus dem `ai:analyzed`-Kommentar bzw. Titel + Beschreibung + Repo in Code;
   auf eigenem Branch, Konventionen beachten, anschließend `pnpm format` + Lint.
3. **Draft-PR + Ticket-Verknüpfung** — committen, Branch pushen, **Draft**-PR erstellen
   (`gh pr create --draft --assignee @me`); `Closes #<nr>` im Body verknüpft den PR mit dem
   Ticket (erscheint im „Development"-Bereich, schließt es beim Merge). PR-Beschreibung mit
   format-/lint-Ergebnissen.
4. **Beobachten & Review-Kommentare behandeln** — den erstellten PR weiter beobachten (CI-Status
   und Review-Kommentare). Pro Kommentar: zutreffende, kleine, eindeutige Punkte direkt **fixen**
   (committen, pushen, format/Lint, kurz im Thread antworten + auflösen); bei Mehrdeutigkeit oder
   architektonisch relevanten Änderungen **vorher rückfragen**; sonst begründet **kommentieren**.
   CI-Fehler diagnostizieren und beheben. Bis **Merge oder Close** dranbleiben.

Zuweisen und Push/Draft-PR schreiben öffentlich auf GitHub — vorher bestätigen lassen.

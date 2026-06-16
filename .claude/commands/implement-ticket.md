---
description: Setzt offene Issues mit Label ai:ready um, erstellt den PR und verfolgt ihn (reagiert automatisch auf Review-Anmerkungen)
argument-hint: '[issue-nummer]'
allowed-tools: Bash(gh issue list:*), Bash(gh issue view:*), Bash(gh issue edit:*), Bash(gh issue comment:*), Bash(gh label list:*), Bash(gh label create:*), Bash(gh pr create:*), Bash(gh pr view:*), Bash(gh pr diff:*), Bash(gh pr checks:*), Bash(gh pr comment:*), Bash(gh pr review:*), Bash(gh api:*), Bash(git switch:*), Bash(git status:*), Bash(git diff:*), Bash(git add:*), Bash(git commit:*), Bash(git push:*), Bash(pnpm:*), Read, Edit, Write, Grep, Glob, Skill, Task, subscribe_pr_activity, unsubscribe_pr_activity
---

Führe den Umsetzungs-Workflow aus der Wissensbasis aus: @.ai-knowledge/ticket-implementation.md

Ziel-Issue: $ARGUMENTS (leer = offene Issues mit Label `ai:ready` **ohne** Assignee, ältestes zuerst).

**Orchestrierung durch `/team3`:** Die Umsetzung übernimmt das Multi-Agent-Team `/team3` — den
Ticket-Kontext als Aufgabe an `/team3` übergeben; dessen Architect orchestriert Developer, Reviewer,
Tester und Documenter autonom durch die Schritte unten. Abweichend von der team3-Regel „kein Commit
durch das Team" sind Zuweisen, Committen, Pushen und PR-Erstellen hier ausdrücklich Teil des
Auftrags (dokumentierte Abweichung).

Pro Ticket:

1. **Zuweisen** — sich selbst zuweisen (`gh issue edit <nr> --add-assignee @me`).
2. **Analyse verifizieren (Re-Triage)** — beim Lesen des Tickets die `ai:analyzed`-Analyse **nicht
   ungeprüft übernehmen**, sondern via `/triage-ticket <nr>` (Re-Triage, siehe
   [ticket-triage.md](../../.ai-knowledge/ticket-triage.md) Schritt 1) gegen den **aktuellen**
   Repo-Stand erneut analysieren. Noch konform → weiter. Veraltet/unvollständig →
   Analyse-Kommentar aktualisieren und darauf umsetzen. Kippt die Ampel auf 🔴 → **nicht** umsetzen,
   den Menschen entscheiden lassen. (Ändert nur Analyse/Kommentare, **keinen** Code.)
3. **Umsetzen** — Lösung aus dem (ggf. aktualisierten) `ai:analyzed`-Kommentar bzw. Titel + Beschreibung + Repo in Code;
   auf eigenem Branch, Konventionen beachten, anschließend `pnpm format` + Lint.
4. **PR (ready to review) + Ticket-Verknüpfung + Verfolgen** — committen, Branch pushen, PR erstellen
   (`gh pr create --assignee @me`, **kein** `--draft` → sofort review-bereit); `Closes #<nr>` im
   Body verknüpft den PR mit dem Ticket (erscheint im „Development"-Bereich, schließt es beim
   Merge). PR-Beschreibung mit format-/lint-Ergebnissen. **Direkt nach dem Erstellen den PR
   verfolgen** (`subscribe_pr_activity` für den neuen PR), damit eingehende Review-Anmerkungen, neue
   Commits und CI-Ergebnisse die nächste Runde aus Schritt 5 automatisch anstoßen.
5. **Kreuzverhör-Loop + PR-Verfolgung (umsetzen ⇄ prüfen)** — den PR in Runden kritisch prüfen und
   nachbessern **und automatisch auf eingehende Review-Anmerkungen reagieren**, bis **keine Anmerkung
   mehr offen** ist. Eine Runde wird vom eigenen Kreuzverhör **oder** von einem Event des PR-Abos
   (Review-Kommentar von Mensch/`/kreuzverhoer-review`, neuer Commit, CI-Ergebnis) angestoßen. Pro Runde:
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

   **Ende:** Die eigenen Kreuzverhör-Runden sind fertig bei Urteil **🟢** und keinen offenen Findings.
   Bereits begründet abgelehnte Findings nicht erneut aufmachen; bleiben nach **3 Runden**
   substanzielle/mehrdeutige Punkte offen, den Stand zusammenfassen und den **Menschen** entscheiden
   lassen (nicht endlos weiterdrehen). Das **PR-Abo bleibt aktiv** und reagiert auf **später**
   eingehende Review-Anmerkungen/CI erneut — sobald der PR **gemergt/geschlossen** ist (oder der
   Mensch stoppt), das Abo **aktiv beenden** (`unsubscribe_pr_activity` aufrufen). Da nicht alle
   Zustände als Event kommen (CI-Erfolg, neue Pushes), den PR-Stand zwischendurch aktiv nachprüfen
   (`gh pr checks`/`gh pr view`).

Zuweisen, ein ggf. aktualisierter Re-Analyse-Kommentar, Push/PR und die Review-Kommentare des
Kreuzverhörs schreiben öffentlich auf GitHub — vorher bestätigen lassen. Die PR-Verfolgung läuft
danach weiter, bis der PR gemergt/geschlossen ist oder du sie stoppst (`unsubscribe_pr_activity`).

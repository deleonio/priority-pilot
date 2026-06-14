---
description: Offene GitHub-Issues ohne Label ai:analyzed analysieren, kommentieren und markieren
argument-hint: "[issue-nummer]"
allowed-tools: Bash(gh issue list:*), Bash(gh issue view:*), Bash(gh issue comment:*), Bash(gh issue edit:*), Bash(gh label list:*), Bash(gh label create:*), Read, Grep, Glob
---

Führe den vollständigen Ticket-Triage-Workflow aus der Wissensbasis aus: @.ai-knowledge/ticket-triage.md

Ziel-Issue: $ARGUMENTS (leer = offene Issues **ohne** Label `ai:analyzed`, ältestes zuerst).

Pro Ticket alle Schritte ausführen:

1. **Analysieren** — aus Titel + Beschreibung + Repo eine Lösung konzipieren (relevante Dateien via Grep/Glob/Read).
2. **Kommentieren** — Lösungsvorschlag als **deutschen** Kommentar anhängen (`gh issue comment`).
3. **Markieren** — Label `ai:analyzed` setzen (`gh issue edit --add-label`; bei Bedarf vorher `gh label create`).

Schritt 2 und 3 schreiben **öffentlich** auf GitHub — vor dem Posten bestätigen lassen, besonders bei mehreren Issues.
Kein Code committen.

---
description: Offene GitHub-Issues ohne Label ai:analyzed analysieren, lektorieren, ggf. zerlegen, kommentieren und markieren
argument-hint: '[issue-nummer]'
allowed-tools: Bash(gh issue list:*), Bash(gh issue view:*), Bash(gh issue create:*), Bash(gh issue comment:*), Bash(gh issue edit:*), Bash(gh api:*), Bash(gh label list:*), Bash(gh label create:*), Read, Grep, Glob
---

Führe den vollständigen Ticket-Triage-Workflow aus der Wissensbasis aus: @.ai-knowledge/ticket-triage.md

Ziel-Issue: $ARGUMENTS (leer = offene Issues **ohne** Label `ai:analyzed`, ältestes zuerst; eine
konkrete Nummer wird auch bei vorhandenem `ai:analyzed` als Re-Triage verarbeitet).

Pro Ticket alle Schritte ausführen:

1. **Analysieren** — aus Titel + Beschreibung + Repo eine Lösung konzipieren (relevante Dateien via Grep/Glob/Read). Liegt schon eine Analyse vor: prüfen, ob sie noch passt und vollständig ist, sonst aktualisieren/ergänzen.
2. **Lektorieren** — Beschreibung sprachlich verbessern (Rechtschreibung, Grammatik, Verständlichkeit), **ohne den Inhalt zu verändern** (`gh issue edit --body`).
3. **Zerlegen (optional)** — zu große Tickets in 2–5 unabhängige Sub-Issues aufteilen, als echte GitHub-Sub-Issues verknüpfen, mit `ai:analyzed` anlegen (Rekursionsschutz, max. eine Ebene, max. 5).
4. **Kommentieren** — Lösungsvorschlag als **deutschen** Kommentar anhängen, mit Umsetzbarkeits-**Ampel** (🟢/🟡/🔴) am Anfang (`gh issue comment`).
5. **Markieren** — Label `ai:analyzed` setzen (`gh issue edit --add-label`; bei Bedarf vorher `gh label create`).

Schritt 2–5 schreiben **öffentlich** auf GitHub — vor dem Posten bestätigen lassen, besonders bei mehreren Issues.
Kein Produktivcode committen.

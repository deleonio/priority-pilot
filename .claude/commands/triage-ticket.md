---
description: Offene GitHub-Issues ohne Label ai:analyzed analysieren, lektorieren, ggf. zerlegen, kommentieren und markieren
argument-hint: '[issue-nummer]'
allowed-tools: Bash(gh issue list:*), Bash(gh issue view:*), Bash(gh issue create:*), Bash(gh issue comment:*), Bash(gh issue edit:*), Bash(gh api:*), Bash(gh label list:*), Bash(gh label create:*), Read, Grep, Glob
---

Führe den vollständigen Ticket-Triage-Workflow aus der Wissensbasis aus: @.ai-knowledge/ticket-triage.md

Ziel-Issue: $ARGUMENTS

- **Leer** → **alle** offenen Issues **ohne** Label `ai:analyzed` als Batch abarbeiten, **ältestes
  zuerst** — so viele Tickets pro Lauf, wie der Kontext zuverlässig zulässt (siehe »Batch &
  Kontext« unten).
- **Konkrete Nummer(n)** → nur diese verarbeiten; ein bereits vorhandenes `ai:analyzed` wird dabei
  als Re-Triage behandelt (siehe Schritt 1). Mehrere Nummern (z. B. `7 8 9`) werden der Reihe nach
  abgearbeitet.

Pro Ticket alle Schritte ausführen:

1. **Analysieren** — aus Titel + Beschreibung + Repo eine Lösung konzipieren (relevante Dateien via Grep/Glob/Read). Liegt schon eine Analyse vor: prüfen, ob sie noch passt und vollständig ist, sonst aktualisieren/ergänzen.
2. **Lektorieren** — Beschreibung sprachlich verbessern (Rechtschreibung, Grammatik, Verständlichkeit), **ohne den Inhalt zu verändern** (`gh issue edit --body`).
3. **Zerlegen (optional)** — zu große Tickets in 2–5 unabhängige Sub-Issues aufteilen, als echte GitHub-Sub-Issues verknüpfen, mit `ai:analyzed` anlegen (Rekursionsschutz, max. eine Ebene, max. 5).
4. **Kommentieren** — Lösungsvorschlag als **deutschen** Kommentar anhängen, mit Umsetzbarkeits-**Ampel** (🟢/🟡/🔴) am Anfang (`gh issue comment`).
5. **Markieren** — Label `ai:analyzed` setzen (`gh issue edit --add-label`; bei Bedarf vorher `gh label create`).

**Batch & Kontext:** Mehrere Tickets in **einem** Lauf verarbeiten, solange der Kontext ausreicht.
Jedes Ticket vollständig abschließen (inkl. Label in Schritt 5), **bevor** das nächste begonnen wird
— so ist der Lauf jederzeit sauber abbrechbar und idempotent. Wird der Kontext knapp, das **aktuelle**
Ticket sauber zu Ende führen, dann **stoppen** und die noch offenen Nummern für einen Folgelauf
nennen (ein erneuter Aufruf nimmt sie dank `ai:analyzed`-Filter automatisch wieder auf). Für
Batch-Läufe die `--json`/`jq`-Auswahl aus Schritt 1 der Wissensbasis nutzen, damit ein gerade
gelabeltes Issue nicht erneut gewählt wird.

Schritt 2–5 schreiben **öffentlich** auf GitHub — vor dem Posten bestätigen lassen, besonders bei
mehreren Issues (die Bestätigung kann **einmal für den ganzen Batch** eingeholt werden).
Kein Produktivcode committen.

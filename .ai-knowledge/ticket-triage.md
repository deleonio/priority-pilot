# Workflow: Ticket-Triage (GitHub Issues)

KI-gestützte Erst-Analyse offener Tickets — **werkzeug-unabhängig** beschrieben. Konkrete
Slash-Commands (z. B. für Claude Code unter `.claude/commands/`) verweisen nur auf diese Schritte.

Tickets = GitHub-Issues von `deleonio/priority-pilot`. Voraussetzung: `gh` ist authentifiziert.

## Schritt 1 — Ticket analysieren

- Ticket wählen: konkrete Nummer, sonst das älteste **offene, nicht zugewiesene** Issue:
  `gh issue list --state open --search "no:assignee" --limit 20`
- Gibt es kein passendes Issue: klar sagen und stoppen (nichts erfinden).
- Details laden: `gh issue view <nr> --comments`
- In die Codebase einordnen (relevante Dateien mit Grep/Glob/Read finden, nicht raten).
- Strukturierte Analyse: Problemzusammenfassung, betroffene Dateien/Bereiche (mit Pfaden),
  Root Cause bzw. Lösungsskizze, offene Fragen/Risiken.

## Schritt 2 — Lösungsvorschlag als Kommentar

- Konkreten, umsetzbaren Lösungsweg ausarbeiten: betroffene Dateien, Schritte, Alternativen,
  Risiken, grobe Aufwandseinschätzung.
- Als Kommentar posten (Markdown, Deutsch, klar strukturiert):
  `gh issue comment <nr> --body "🤖 KI-Analyse — Lösungsvorschlag: …"`

## Schritt 3 — Label setzen

- Label `ai:analyzed` bei Bedarf anlegen:
  `gh label create "ai:analyzed" --color 1D76DB --description "Von der KI analysiert; Lösungsvorschlag als Kommentar vorhanden"`
- Setzen: `gh issue edit <nr> --add-label "ai:analyzed"`

## Hinweise

- Schritt 2 und 3 schreiben **öffentlich** auf GitHub (Kommentar/Label, Benachrichtigungen) —
  vor der Ausführung bestätigen lassen.
- **Kein Code committen**; nur Analyse + Kommentar + Label.

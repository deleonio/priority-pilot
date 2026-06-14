# Workflow: Ticket-Triage (GitHub Issues)

KI-gestützte Analyse offener Tickets — **werkzeug-unabhängig** beschrieben. Konkrete
Slash-Commands (z. B. für Claude Code unter `.claude/commands/`) verweisen nur auf diese Schritte.

Tickets = GitHub-Issues von `deleonio/priority-pilot`. Voraussetzung: `gh` ist authentifiziert.

**Auswahlkriterium:** Analysiert werden alle **offenen** Issues, die **noch nicht** das Label
`ai:analyzed` tragen. Das Label markiert ein Issue als erledigt und verhindert Doppel-Analysen —
der Workflow ist damit wiederholbar (idempotent).

## Schritt 1 — Ticket(s) wählen & analysieren

- Offene, noch nicht analysierte Issues finden:
  `gh issue list --state open --search '-label:"ai:analyzed"' --limit 30`
- Eine konkret übergebene Nummer hat Vorrang; sonst der Reihe nach abarbeiten (ältestes zuerst).
- Gibt es kein passendes Issue: klar sagen und stoppen (nichts erfinden).
- Pro Issue Details laden: `gh issue view <nr> --comments`
- **Titel und Beschreibung** des Issues zusammen mit dem **Repo** zu einer Lösung konzipieren:
  relevante Dateien via Grep/Glob/Read finden, Architektur/Konventionen aus der Wissensbasis
  berücksichtigen — nicht raten.
- Ergebnis: Problemzusammenfassung, betroffene Dateien/Bereiche (mit Pfaden), Root Cause bzw.
  Lösungsweg, offene Fragen/Risiken.

## Schritt 2 — Lösungsvorschlag als deutscher Kommentar

- Den konzipierten Lösungsweg konkret und umsetzbar formulieren: betroffene Dateien, Schritte,
  Alternativen, Risiken, grobe Aufwandseinschätzung.
- Als **deutschen** Kommentar (Markdown, klar strukturiert) an das Issue anhängen:
  `gh issue comment <nr> --body "🤖 KI-Analyse — Lösungsvorschlag: …"`

## Schritt 3 — Als analysiert markieren

- Label `ai:analyzed` bei Bedarf anlegen:
  `gh label create "ai:analyzed" --color 1D76DB --description "Von der KI analysiert; Lösungsvorschlag als Kommentar vorhanden"`
- Setzen: `gh issue edit <nr> --add-label "ai:analyzed"`
- Damit fällt das Issue aus dem Auswahlkriterium von Schritt 1 heraus.

## Hinweise

- Schritt 2 und 3 schreiben **öffentlich** auf GitHub (Kommentar/Label, Benachrichtigungen) —
  vor der Ausführung bestätigen lassen, besonders bei Batch-Verarbeitung mehrerer Issues.
- **Kein Code committen**; nur Analyse + Kommentar + Label.

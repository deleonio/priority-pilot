# Subagent-Ausführungsvertrag (Modell-Delegation)

Kanonischer, werkzeug-unabhängiger Vertrag für Subagenten, die der Sonnet-Koordinator per
Agent-Tool **in derselben Session** an eine andere Modell-Stufe delegiert (siehe
[AGENTS.md](../AGENTS.md), Abschnitt „Modell-Wahl per Subagent-Delegation"). Die konkreten
Agent-Definitionen unter [`.claude/agents/`](../.claude/agents/) verweisen nur hierher und ergänzen
lediglich ihre modellspezifische Eskalationsrichtung.

## Rahmen

- Läuft in derselben Session und demselben Repository-Checkout wie der delegierende Koordinator —
  kein Kalt-Spawn, kein Kontextverlust.
- Setzt die übergebene Aufgabe vollständig, sorgfältig und **autonom** um — kein interaktives
  Nachfragen beim Menschen.

## Scope-Disziplin

- Bleibt strikt im übergebenen Scope.
- Findings außerhalb des Scopes werden **gemeldet, nicht still mitgefixt**.

## Ergebnis-Übergabe

- Am Ende ein präzises, knappes Ergebnis an den Koordinator: was getan wurde, welche
  Dateien/PRs/Labels betroffen sind, was offen blieb.

## Eskalation bei Unklarheit

- Bei Unklarheit, Mehrdeutigkeit oder unerwartetem Aufwand: abbrechen und an den Koordinator melden,
  statt zu raten. Die jeweilige Agent-Definition legt fest, wohin eskaliert wird (z. B. `light` →
  `heavy`); die oberste Modell-Stufe meldet den offenen Punkt zurück an den Koordinator/Menschen.

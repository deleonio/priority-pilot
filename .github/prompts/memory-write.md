## MEMORY SCHREIBEN — PFLICHT

**ZWEI ZWECKE**:
1. Folgelauf DIESER Phase bei Soft-Abort → nahtlos weitermachen
2. NÄCHSTE Phase dieses Tickets → Arbeit nicht nochmal machen

**DATEI**: `.ai-memory/issue-{{ISSUE_NR}}-{{PHASE}}.md`

**FORMAT**:
```markdown
## Erledigt          — was läuft / ran (mit Datei:Zeile)
## Relevante Stellen — die Dateien/Funktionen, je EIN Halbsatz warum
## Annahmen          — worauf du dich verlässt, ohne bewiesen
## Verworfen         — was geprüft und NICHT genommen, mit Grund
## Offen             — was blockiert, inkl. Fehlermeldung/Ursache
## Nächster Schritt  — der EINE nächste Handgriff
## Fallstricke       — Entscheidungen/Dinge, die leicht falsch laufen
```

**WICHTIG**:
- Schreib für JEMANDEN OHNE DEINEN KONTEXT → Nenne Dateien, Zeilen, Namen
- Aussagen prüfbar (Datei:Zeile plus was dort stand) — Dateistände altern!
- ERSTEN Stand SOFORT nach Analyse, vor JEDEM Soft-Deadline-Check aktualisieren
- Leere Abschnitte mit `-` füllen, nicht weglassen

---

## DAUERGEDÄCHTNIS FORTSCHREIBEN — `MEMORY.md`

**WANN** (streng, im Zweifel KEIN Eintrag): Nur wenn ein ANDERES Ticket ohne dies denselben Fehler machen würde. Nicht-offensichtliche Werkzeug-/CI-Eigenheiten, Befehle nach Fehlversuchen.

**NICHT HIERHER**: Ticket-Spezifisches (→ Phasen-Notiz), was in AGENTS.md/.ai-knowledge/ steht, Selbstverständliches, Erfolgsmeldungen. Meistens GAR NICHTS schreiben.

**FORMAT** (eine Zeile):
`- YYYY-MM-DD · <Bereich> — <was schiefging> → <Lösung>.`

**WO**: Am Ende von `## Learnings & Erfahrungen` anhängen. Bestehende Zeilen NICHT umschreiben/umsortieren/löschen (union-Merge). AUSNAHME: Eintrag ist nachweislich FALSCH → korrigieren + Beleg.

**WER**: Nur Phasen mit Commit-Auftrag (Spec, Umsetzung, Fixup) — Eintrag reist im normalen Phasen-Commit mit. Ohne Commit → Kandidat unter `## Fallstricke` der Phasen-Notiz.

**KURATIERUNG**: Max. ~40 Einträge. Voll oder zur Regel geworden → nach `.ai-knowledge/conventions.md` überführen, Zeile entfernen.
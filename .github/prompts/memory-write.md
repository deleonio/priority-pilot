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

## DAUERGEDÄCHTNIS FORTSCHREIBEN — `.ai-memory/MEMORY.md`

**FORMAT** (eine Zeile, ans Ende von `## Learnings & Erfahrungen`):
`- YYYY-MM-DD · <Bereich> — <was schiefging> → <Lösung>.`

**Aufnahmekriterium, Merge- und Kuratierungsregeln, wer committen darf**: AGENTS.md → Abschnitt „Memory" (verbindlich, hier nicht wiederholt). Kurz: streng — im Zweifel KEIN Eintrag, die meisten Läufe schreiben gar nichts.
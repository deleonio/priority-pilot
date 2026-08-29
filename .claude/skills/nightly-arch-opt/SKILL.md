---
name: nightly-arch-opt
description: "Nightly architecture optimization — scan the codebase for exactly one stability/maintainability improvement and emit a structured result block for the workflow. Use for 'arch-opt' (German: Architektur-Optimierung), nightly CI run."
---

# Nightly Architecture Optimization

Scan the repository for exactly ONE architecture optimization that measurably improves
stability or maintainability, and output a structured result block. Read-only: the workflow
turns the result into a GitHub issue — this skill never creates issues itself.

Note: this file's prose is English; the ticket fields in the result block stay German — that
content is for the project's German-speaking contributors.

## PROCEDURE

1. **Research** with the **Grep/Glob/Read tools**. Bash `find`/`grep` are NOT permitted in the
   restricted tools tier — use the tools instead. Read only files that are actually relevant.
2. **Analyze** suspects against the architecture principles below.
3. **Output**: result block if something was found; otherwise `FOUND: false` — honest, never forced.

## Architecture principles

- **Minimalprinzip:** Nur so viel Code wie nötig — jede Zeile ist Wartungslast.
- **Muster-Treue:** Gleiche Struktur, Namen und Ablagen wie der Nachbar-Code.
- **Mobile-First:** UI funktioniert zuerst auf 375px.
- **KoliBri-First:** Shadow-Web-Components nicht selbst stylen.
- **ESM überall:** `"type": "module"`; Server-Importe mit `.js`-Endung.
- **TypeScript strict:** Keine Type-Assertions zum Unterdrücken von Fehlern.
- **Test-Coverage:** Logic-Schicht gezielt abgedeckt (90/85/85).

## Search areas

1. **Code-Duplizierung:** Wiederholte Muster, die in eine gemeinsame Abstraktion gehören.
2. **Typanomalien:** any/unknown statt typsicherer Alternativen.
3. **Schichten-Verletzungen:** UI-Logik in der Logic-Schicht oder umgekehrt.
4. **Ungetestete kritische Pfade:** Logik ohne Test, die bei Fehlern teuer wäre.
5. **Imports/Exports:** ESM-Verstöße, fehlende `.js`-Endungen auf Server.
6. **Muster-Brüche:** Abweichungen vom etablierten Coding-Stil ohne Begründung.

## Result format

If something was found (ASCII field names, one marker per line, German content, concrete and
observable wording — the pipeline's quality gate rejects vague tickets):

```
TITLE: <kurze, praegnante Beschreibung>

AFFECTED_FILES:
- <datei/pfad>

DESCRIPTION:
<2-3 Saetze: Was ist das Problem, warum lohnt sich die Behebung?>

PROPOSAL:
<konkrete Umsetzungsschritte, kein allgemeiner Rat>

IMPACT:
- Wartbarkeit: <hoch|mittel|gering> - <Begruendung>
- Stabilitaet: <hoch|mittel|gering> - <Begruendung>
- Aufwand: <gering|mittel|hoch> - <Begruendung>

ACCEPTANCE:
- <pruefbarer Punkt als Bullet-Zeile, von aussen nachpruefbar; mindestens einer>

FOUND: true
```

If nothing was found:

```
REASON: <kurze Begruendung, warum kein Handlungsbedarf besteht>

FOUND: false
```

The `FOUND:` line is always the LAST line of the reply.

## Notes

- Prefer optimizations spanning more than one file (pattern breaks).
- Ignore cosmetics (formatting, comments).
- Never propose anything listed as a known open issue (appended to the prompt by the workflow).

---
name: pr-documenter
description: "PR-Documenter — gemergte PRs analysieren und als /tmp/doc.json für Changelog/Release Notes dokumentieren (Klassifikation, Titel, Zusammenfassungen, Migration). Nutzen bei ‚dokumentiere PR‘, CI-Phase 6."
---

# Workflow: PR-Documenter (nach Merge)

Nutzen für gemergte PRs — analysiert den PR und schreibt Dokumentations-Output (`/tmp/doc.json`) für Changelog/Release Notes.

**Auswahlkriterium:** Gemergte PRs, die der Workflow via `{{PR_NR}}` übergibt. Kein `gh pr edit/comment/label` — nur Output schreiben.

## Inputs (selbst lesen)

- `gh pr diff {{PR_NR}}`
- `gh pr view {{PR_NR}} --json title,body,files,labels,author`
- `{{LINKED_ISSUES}}` (Kontext zu verknüpften Issues)
- `{{TITLE_OK}}` — ist der Titel bereits konform?
- `{{SUGGESTED_TYPE}}` — vorgeschlagener Typ aus Titel-Parsing
- `{{SUGGESTED_SCOPE}}` — vorgeschlagener Scope aus Titel-Parsing

## Klassifikation (genau eine)

- `breaking` — API/Vertragsänderung, Migration nötig
- `new` — neue Funktion/Komponente/Endpoint
- `improved` — Erweiterung, UX, Performance (nicht reine Optik)
- `fixed` — Bugfix, Fehlerkorrektur
- `internal` — nur Tests/CI/Refactoring ohne Nutzer-Impact (Im Zweifel **NICHT** internal)

## Output (`/tmp/doc.json`)

```json
{
  "classification": "breaking|new|improved|fixed|internal",
  "title": "leer oder neuer Titel (Conventional Commits, englisch, klein, ≤72)",
  "title_reason": "ein Satz, warum umbenannt (nur wenn title gesetzt)",
  "summary_en": "3-5 Sätze: Dateien/Komponenten, technische Kernänderung",
  "summary_de": "gleiche Aussage auf Deutsch",
  "release_note_en": "2-4 Sätze: Was können Endnutzer jetzt tun? (bei internal: ein Satz, warum keine Note nötig)",
  "migration_en": "nur bei breaking, sonst leer",
  "files": [{"path": "pfad", "note_de": "ein Satz: was geändert"}],
  "issues": [{"ref": "Closes #692", "note": "kurze Beschreibung"}]
}
```

## Regeln

- `title`: Leer wenn `{{TITLE_OK}}`=`true` und Typ passt. Sonst Conventional Commits, englisch, klein, ≤72 Zeichen.
- `files`: 3-8 relevanteste Dateien aus Diff
- `issues`: Aus `{{LINKED_ISSUES}}` + Body („Closes #", „Fixes #")
- Nach Schreiben: `jq . /tmp/doc.json` prüfen

## Zeitlimit

`{{SOFT_DEADLINE}}`. Bei Timeout: Minimal-stand schreiben (nicht komplett leeres JSON).
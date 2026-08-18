---
name: issue-679-kolinput-counter
description: Spec für Issue 679 - Zeichenzähler für KolInputText/KolTextarea via _hasCounter/_maxLength
metadata:
  type: project
---

# Issue 679: Zeichenzähler für KolInputText/KolTextarea

**Stand:** 2026-08-17

## Ziel

KolInputText und KolTextarea sollen den eingebaute Zeichenzähler von KoliBri nutzen (via `_hasCounter` und `_maxLength` Props).

## Vorbedingung

- KoliBri-Komponenten sind korrekt installiert und konfiguriert (@public-ui/react-v19 v4.3.0)
- KoliBri-Komponenten unterstützen `_hasCounter` und `_maxLength` Props

## Schritte

1. `KolInputText` mit `_hasCounter` und `_maxLength` ausstatten
2. Optional: `KolTextarea` mit Counter ausstatten (falls benötigt)

## Erwartetes Ergebnis

- KolInputText zeigt die aktuelle Zeichenanzahl im Format "X/Y" an
- Counter wird bei Eingabe aktualisiert (reaktiv auf User-Input)
- Counter wird von KoliBri-Komponente automatisch gerendert

## Testfälle

- Titel-Input (KolInputText) mit `_maxLength={TITLE_MAX_LENGTH}` und `_hasCounter` zeigt Counter an
- Eingabe von Zeichen → Counter zeigt "X/Y" Format
- Counter wird reaktiv bei Eingabe aktualisiert

## Technische Hinweise

- `_hasCounter`: Boolean Prop, aktiviert den eingebauten Counter
- `_maxLength`: Number Prop, definiert das Maximum für "X/Y" Anzeige
- Keine manuelle Counter-Implementierung nötig (KoliBri übernimmt)

---

## Versionierung

- **v1.0** (2026-08-17): Initialefassung für Issue #679. Zeichenzähler für KolInputText/KolTextarea spezifiziert.
- **v1.1** (2026-08-17): Nightly-Sync — Ist-Stand-Korrektur. Feature ist bereits implementiert: TaskForm.tsx nutzt _hasCounter und _maxLength für Titel-Input.

---

## Status

**ABGESCHLOSSEN** — Zeichenzähler für KolInputText ist implementiert und in Produktion.

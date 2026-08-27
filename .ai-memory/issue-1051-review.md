# Issue 1051 — Review-Phase (Kreuzverhör Runde 1, 2026-08-27)

Verdict: needs-fixup (🟡 F1). Sammelkommentar `<!-- ai-review -->` erstellt
(https://github.com/deleonio/priority-pilot/pull/1054#issuecomment-5434668195),
Inline-Review mit F1 gepostet (pullrequestreview-5037438269), PR-Titel auf
`fix(frontend): unify header toolbar buttons and align mic button in search dialog` geändert.

## Erledigt
- Modus bestimmt: kein `<!-- ai-review -->-Marker vorhanden → Kreuzverhör (Gesamt-PR)
- Diff geprüft (4 Dateien, +186/−4): Spec-Doc, e2e-Datei, App.tsx:402 (`primary`→`secondary`), app.css:1279-1283 (Bottom-Anker)
- Impl-Commit 388f40ef änderte nur App.tsx + app.css → Spec-Tests unverändert gelassen (Trennung der Pflichten ✓)
- F1 als Inline-Kommentar app.css:1282 + Sammelkommentar gepostet, Titel-Gate erledigt

## Relevante Stellen
- `frontend/src/app.css:1279-1283` — neue Regel `bottom: calc((var(--pp-input-height, 2.75rem) - 2rem) / 2)`; Annahme „Inputbox = unterstes Wrapper-Element" (Kommentar app.css:1258-1260)
- `frontend/src/components/TaskForm.tsx:723-744` — Titelfeld: `variant="input"` MIT `_hasCounter` (Zeile 739) → Counter-Zeile unter der Inputbox, Bottom-Anker trifft Counter statt Input
- `frontend/e2e/issue-1051-header-toolbar-mic-align.spec.ts` — 3 AK-Tests, unverändert grün laut Impl-Phase
- `--pp-input-height` ist nirgends definiert (nur Fallback 2.75rem in app.css:1282) — funktioniert, nur Kalibrier-Hebel

## Annahmen
- KoliBri rendert den Counter unter der Inputbox innerhalb des Hosts (Wrapper wird höher) — gestützt durch den eigenen CSS-Kommentar app.css:1278 („Mit _hasCounter erhöht sich die Container-Höhe")
- Alter `top:50%`-Anker war im TaskForm näherungsweise richtig (Label-Höhe ≈ Counter-Höhe) → F1 ist wohl eine Regression, nicht nur fortbestehender Mangel
- e2e 3/3 grün laut Impl-Phase (lokal nicht erneut ausgeführt — CI-e2e-Shards waren bei Review noch pending)

## Verworfen
- Eigener e2e-Lauf zur Verifikation — Zeitbudget (Soft Deadline) + CI-e2e-Shards für den PR liefen ohnehin
- Finding zu undefiniertem `--pp-input-height` — Fallback ist die Definition, Kommentar dokumentiert den Kalibrier-Gedanken; kein Mangel
- MEMORY.md-Eintrag — rein issue-spezifisch (Aufnahmekriterium nicht erfüllt)

## Offen
- F1 wartet auf Fixup: Counter-Versatz (z. B. `--pp-input-below` oder `.voice-field--input--counter`) + TaskForm-Bounding-Box-e2e

## Nächster Schritt
- Fixup-Runde: F1 umsetzen, dann Fixup-Nachweis (Modus über `<!-- ai-review -->`-Marker in PR 1054)

## Fallstricke
- Bei Fixup-Verifikation: nur F1 + Fixup-Diff prüfen, nicht den ganzen PR neu kreuzverhören
- Finding-Nummer F1 stabil halten; nach Behoben-Verschiebung in „Behobene Anmerkungen"-Tabelle
- `--pp-input-height`-Fallback 2.75rem ist KoliBri-Default-Annahme — falls Theme/Input-Höhe wechselt, Custom Property überschreiben

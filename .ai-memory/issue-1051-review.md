# Issue 1051 — Review-Phase (Fixup-Nachweis Runde 2, abgeschlossen 2026-08-27)

Verdict: reviewed (🟢, F1 vollständig behoben, CI grün). Sammelkommentar aktualisiert
(issuecomment-5434668195, jetzt Runde 2, Status "reviewed").

## Erledigt
- Modus bestimmt: `<!-- ai-review -->`-Marker vorhanden (updatedAt vor diesem Update 2026-08-27T06:24:16Z) → Fixup-Verifikation Runde 2
- Fixup-Commit seit letztem Update ermittelt: `df0bf10c` ("Mic-Button-Anker auf gemessene Geometrie kalibrieren")
- Diff geprüft (`git show df0bf10c`): `frontend/src/app.css:1286/1294` (`--pp-input-height` 2.75rem→2.5rem, `--pp-counter-height` 1.5rem→1.925rem) + `frontend/e2e/issue-1051-header-toolbar-mic-align.spec.ts:145-165` (Locator `getByRole('textbox', {name:'Titel'})` statt `[data-testid="task-title"] input`, Toleranz von "innerhalb Inputbox" auf "±4px zur Feldmitte" verschärft, analog AK10)
- Kollateral-Check: `grep -rn "pp-input-height\|pp-counter-height\|pp-input-below" frontend/src frontend/e2e` → nur an dieser einen Stelle referenziert, kein anderer Call-Site betroffen
- CI-Status geprüft (`gh pr checks 1054`): `e2e (1)`, `e2e (2)`, `e2e (3)`, `e2e (4)` (der zuvor rote Job, AK10/`voice-transcription.spec.ts:246`), `verify`, `precheck`, `label` alle grün
- Titel-Gate geprüft: `fix(frontend): unify header toolbar buttons and align mic button in search dialog` — Conventional Commits konform, kein Rename nötig
- Sammelkommentar aktualisiert: F1 in "✅ Behobene Anmerkungen" verschoben, "📋 Offene Findings" leer, Status "reviewed", Review-Typ "Fixup-Nachweis"

## Relevante Stellen
- `frontend/src/app.css:1286` — `--pp-input-height` Default jetzt 2.5rem (gemessene native Inputbox-Höhe, nicht die 44px a11y-Container-Mindesthöhe)
- `frontend/src/app.css:1294` — `--pp-counter-height` Default jetzt 1.925rem (4px Grid-Gap + ~26.8px Zählerzeile, e2e-gemessen)
- `frontend/e2e/issue-1051-header-toolbar-mic-align.spec.ts:145-165` — F1-Test, jetzt ±4px-Center-Toleranz wie AK10 (#264)

## Annahmen
- Die im Commit-Message dokumentierten Messwerte (40px Inputbox, 30.8px Stack darunter) sind plausibel und durch CI-Grünwerden von AK10 bestätigt — keine eigene Nachmessung nötig

## Verworfen
- Erneutes Kreuzverhör des Gesamt-PR — Modus bleibt Fixup-Verifikation (nur Diff seit letztem Sammelkommentar-Update)

## Offen
- keine

## Nächster Schritt
- keiner — Review abgeschlossen, Verdict "reviewed"; PR kann in den Merge-Gate-Workflow übergehen (CI bereits grün)

## Fallstricke
- Falls ein weiterer Fixup nötig wird: F1 ist jetzt in "Behobene Anmerkungen" — bei einer Regression eine NEUE Findingnummer (F2) vergeben, F1 nicht wiederverwenden

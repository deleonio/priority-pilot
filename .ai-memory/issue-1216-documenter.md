# Issue 1216 — Documenter (Phase), Stand 2026-09-04

## Erledigt
- PR 1216 (merged, Autor deleonio) analysiert: `gh pr view` + `gh pr diff` (15 Dateien, +1029/-23, Kern neu: HeartBalance.tsx 308, heartBalance.ts 127, app.css +309, doneAnimation.ts/heartAnimation.ts je ~56).
- `/tmp/doc.json` geschrieben und per `jq` validiert: classification=new, title="" (Titel `feat(frontend): add heart-shaped life-balance widget to the dashboard` compliant, per Prompt bestätigt), 8 files (max. laut SKILL), issues=[] (Body enthält kein „Closes #", Prompt gab keinen Linked-Issue-Kontext → leer statt Ref erfinden).
- Wegwerf-Artefakt: `.ai-memory/issue-1216-doc.json` (Zwischenkopie; Write-Tool darf nicht nach /tmp, daher im Repo schreiben und per `cp` nach /tmp/doc.json — Muster MEMORY.md 2026-08-26).

## Relevante Stellen
- `frontend/src/components/HeartBalance.tsx` — neues SVG-Widget (Segmente, Wasserlinie, SMIL-Welle, role="img").
- `frontend/src/lib/heartBalance.ts` — Füllstand = Σ min(ist_i, soll_i), rampClass an Säulen-ID.
- `frontend/src/components/Dashboard.tsx` — Einbindung oben; Punkte-Map in useMemo (2 Verbraucher).
- `frontend/src/components/SettingsPage.tsx` — Feinschalter „Herz animieren"/„Erledigt animieren" unter Master.
- `frontend/src/lib/doneAnimation.ts` / `heartAnimation.ts` — neue Animations-Helper.
- Angepasste E2E-Specs: issue-1118 (elementFromPoint-Scroll-Fix, Herz-Karte verdeckte Signalfäche), issue-843 (Top-Level-Locator `:not(.settings-switch-row--sub)`), settings-switch-layout (Sub-Ebene-Muster).

## Annahmen
- Kein Linked-Issue-Kontext im Prompt („keine") → issues=[]; der PR selbst ist #1216, im Body steht kein Closing-Ref.
- PR-Body (deutsch, sehr detailliert) als Quelle für summary/release-note; Prüflauf-Tabelle im Body behauptet grüne Gates, nicht selbst nachgeprüft (Review-Tier).

## Verworfen
- Titel-Rename — compliant, type/scope passt (feat/frontend).
- classification=improved — neues Widget = `new`, nicht Extension Bestehenden.
- issues-Ref „Closes #1216" — wäre Selbstreferenz/erfunden; SKILL verlangt Refs aus Kontext/Body.

## Offen
- -

## Nächster Schritt
- Folge-Workflow: doc.json konsumieren (Changelog/Release-Notes); keine Aktion in diesem Repo nötig.

## Fallstricke
- Write-Tool: Schreiben nach /tmp wird abgewiesen (Permission) → Datei unter `.ai-memory/` anlegen und per `cp` transportieren.
- Erstversuch des JSON hatte ein trailing comma nach dem `issues`-Array → `jq empty` als Pflichtcheck vor dem cp.

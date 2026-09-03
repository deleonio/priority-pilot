# Issue 1183 — Documenter (Phase 6), Stand 2026-09-03

## Erledigt
- PR #1188 analysiert (`gh pr view/diff`), Ausgabe `/tmp/doc.json` geschrieben, `jq empty` = OK. Kein PR-Edit/Comment/Label (Review-Tier).
- Classification `new`: neuer Settings-Schalter + neues Modul `animations.ts` = Feature, nicht nur UX-Verbesserung.
- Titel als compliant übernommen (Vorgabe true, feat/frontend) → `title`/`title_reason` leer.
- files (7): animations.ts, confetti.ts, SettingsPage.tsx, animations.test.ts, confetti.test.ts, e2e/issue-1183-animations.spec.ts, e2e/issue-1169-confetti.spec.ts. .ai-memory-Notizen + docs/spec + issue-1182/settings-switch-layout E2E bewusst weggelassen (3-8 relevanteste).
- issues: `Closes #1183` aus dem PR-Body.

## Relevante Stellen
- `frontend/src/lib/animations.ts` — neu; STORAGE_KEY 'pp-animations-enabled' bewusst nicht exportiert, Default false, Best-Effort-try/catch.
- `frontend/src/lib/confetti.ts` — Gate `readAnimationsEnabled()` NACH reduced-motion-Frühcheck (AK4: reduce gewinnt); Aufrufer App.tsx unverändert.
- `frontend/e2e/issue-1169-confetti.spec.ts` + `frontend/src/lib/confetti.test.ts` — Test-Pflege: Vorbelegung `pp-animations-enabled=true`, sonst bricht der neue Default die #1169-Assertionen.

## Annahmen
- #1182 (Dashboard-Konfetti) hängt am selben `launchConfetti`-Gate und braucht keinen eigenen files-Eintrag (Gate sitzt zentral; Dashboard-E2E nur Assert bleibt).
- `.ai-memory/*` und `docs/spec/issue-1183.md` zählen nicht als relevante Release-Dateien.

## Verworfen
- `classification: improved` — neuer Einstellungswert + neues Modul sprechen für `new`.
- files-Eintrag für `.ai-memory/issue-1183-*.md`, `docs/spec/issue-1183.md`, `settings-switch-layout.spec.ts`, `issue-1182-dashboard-confetti.spec.ts`, `SettingsPage.test.tsx` — Meta/Spec/Starre-Layout-Tests, kein Informationsgewinn fürs Changelog.

## Offen
- -

## Nächster Schritt
- `.` — Phase abgeschlossen; Ausgabe liegt unter `/tmp/doc.json` (jq-valide).

## Fallstricke
- Neuer Default „aus" bricht alle bestehenden Konfetti-Tests, die ein Overlay erwarten — bei künftigen Konsumenten (weitere Animationen) denselben Vorbelegungs-Pflege-Bedarf einplanen.
- reduce-Check bleibt VOR dem Schalter-Gate: Tests, die „Schalter an ⇒ Konfetti" erwarten, brauchen zusätzlich stubReducedMotion(false).

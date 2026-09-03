# Issue 1183 — Implement (Phase 4), Stand 2026-09-02

## Erledigt
- Branch `ai/harness/1183` (Spec-Commit `820dd1a2` rote Tests) ausgecheckt; Draft-PR **#1188** identifiziert (headRefName ai/harness/1183, isDraft=true, closingIssuesReferences via Body).
- Neu `frontend/src/lib/animations.ts` nach voiceAutostart-Muster: `STORAGE_KEY = 'pp-animations-enabled'` (nicht exportiert — knip), `readAnimationsEnabled`/`storeAnimationsEnabled` (Best-Effort, Default false), Hook `useAnimationsEnabled`.
- `frontend/src/lib/confetti.ts`: `launchConfetti()` liest jetzt `readAnimationsEnabled()` (Import :2, Gate :87-90) — nach dem reduced-motion-Frühcheck, der unverändert Vorrang behält (AK4). Aufrufer App.tsx unangetastet.
- `frontend/src/components/SettingsPage.tsx`: Import :5, Hook :107-109, Schalter „Animationen" als `kol-input-checkbox _variant="switch"` in eigener `.settings-switch-row` im tab-0-Panel nach der Voice-Zeile (:265-277).
- Targeted Unit-Tests grün: animations + confetti + SettingsPage = 29 passed (vitest run).
- Targeted E2E grün: `issue-1183-animations.spec.ts` + `issue-1169-confetti.spec.ts` = 11 passed (npx playwright test im frontend-Verzeichnis).
- Gate-Runde 1: format/prettier/lint ok; knip rot („Unused exports: STORAGE_KEY") → Export entfernt. Runde 2 lief (Ergebnis im PR-Body).

## Relevante Stellen
- `frontend/src/lib/animations.ts` — neues Speicher-Modul (Key, read/store, Hook).
- `frontend/src/lib/confetti.ts:74-90` — `launchConfetti` mit beiden Gates (reduce + Master-Schalter).
- `frontend/src/components/SettingsPage.tsx` — Schalter-Einbau (tab-0 „Allgemein").
- `docs/spec/issue-1183.md` — AK-Vertrag der Spec-Phase.
- Rote Tests (Contract, unverändert): `frontend/src/lib/animations.test.ts`, `frontend/src/lib/confetti.test.ts` (#1183-Describe ab :105), `frontend/src/components/SettingsPage.test.tsx` (:384ff), `frontend/e2e/issue-1183-animations.spec.ts`.

## Annahmen
- Schalter-Platzierung nach der Sprachaufnahme-Zeile (vor Push) — der #1151-Reihenfolge-Test (voice vor push) bleibt grün, E2E verlangt keine Position.
- STORAGE_KEY nicht exportiert: Tests/E2E verwenden das String-Literal („muss übereinstimmen"-Kommentar), kein Import — knip-konform, Vertrag unberührt.

## Verworfen
- Export von STORAGE_KEY — knip „Unused exports" (voiceAutostart.ts hat denselben Export dort weiterhin in Nutzung/Ignore; hier ohne Verbraucher).
- Änderungen an App.tsx-Aufrufer oder #1169-Tests — Gate sitzt laut Spec in `launchConfetti`, Tests sind Spec-Vertrag.

## Offen
- -

## Nächster Schritt
- Gate grün → Commit (Code + diese Notiz) + Push + `gh pr ready 1188` + PR-Body erweitern (Implementierungs-Zusammenfassung, Testergebnisse, Test-Pflege #1169, knip-Korrektur).

## Fallstricke
- PR #1188 NICHT neu erstellen — existierenden Draft per `gh pr ready 1188` scharf schalten.
- `gh pr edit --body-file` mit Datei aus `.ai-memory/` (Body-Klammern sonst Bash-Parser-Falle, Memory 2026-08-24).
- Issue-Zuweisung war bei Laufbeginn schon vorhanden (`gh issue edit --add-assignee` meldete „failed to update", assignees=deleonio — kein Handlungsbedarf).

# Issue 1151 — Review-Phase (PR #1152), Stand 2026-08-31T15:57Z

## Erledigt
- MODE bestimmt: kein `<!-- ai-review -->`-Kommentar auf PR #1152 (0 Kommentare insgesamt) → **Kreuzverhör** (Erst-Review), volles Diff.
- Issue-ACs geladen: `gh issue view 1151` → Harness-Kommentar (`<!-- ai-harness -->`, KI-ANALYSE stand=2026-08-31T15:42:48Z), AK1–AK5 + TF1–TF5 + KI-UX-Block; Kopie in `.ai-memory/issue-1151-review-harness.md` (Wegwerf-Artefakt).
- PR + Diff gelesen (`gh pr diff 1152 --patch` → `.ai-memory/issue-1152-pr.diff`, 891 Zeilen): closing issue #1151 verlinkt; 6 Commits (2× triage/ux-memory, spec-tests 6ca55469, impl 21491ec6, implement-memory).
- Prod-Diff beurteilt: `App.tsx:60` `SETTINGS_PATH_SEGMENTS` + `'standort'`; `SettingsPage.tsx` `SETTINGS_TABS` + Index 3, Geo-Block (Switch/Alerts/Button/Adresse/3 Slider) in `slot="tab-3"`, tab-1/tab-2-Blöcke byte-identisch davor geschoben ( JSX-Move, alter Ort gelöscht).
- PR-Body räumt selbst **1 roten Unit-Test** ein (`SettingsPage.test.tsx:361` AK3) mit zwei behaupteten Harness-Defekten — Verifikation läuft (Separation of Duties: Testdatei selbst ist Fix-Ziel der Pflege, nicht der Impl).

## Relevante Stellen
- `frontend/src/components/SettingsPage.tsx:702-776` (Diff-Zeilen) — tab-0 schließt jetzt vor dem Geo-Block; `slot="tab-3"` am Ende, `className="settings-general"` wiederverwendet.
- `frontend/src/components/SettingsPage.test.tsx:356,370` — die zwei vom PR behaupteten Harness-Defekte (missing `pushState.supported`; `toContain` auf numerischer Bitmaske).
- `.ai-memory/issue-1151-implement.md` „Fallstricke“ — `useShadowDOMLayout`-Ref hängt weiter an tab-0 (`settingsGeneralRef`, Zeile 234) → prüfen, ob der Umzug dessen Messmenge verändert.
- `frontend/e2e/issue-1098-geo-settings.spec.ts:95,119` — auf `/settings/standort` umgestellt, aber `waitForStableView(page, 'Allgemein')` beibehalten (Helper-Semantik prüfen).

## Annahmen
- Lokaler Checkout enthält den PR-Head (git log zeigt Merge von 79e80a76 + 21491ec6) → Tests lokal lauffähig gegen den PR-Stand.

## Verworfen
- — (noch keine)

## Offen
- Node-Module/Chromium fehlen in der Sandbox → F4-Defekt 2 (Vitest-`toContain` auf Bitmaske) nur code-gelesen, nicht ausgeführt; F1 nicht per e2e-Lauf reproduziert — Fixup verifiziert beide.

## Nächster Schritt
- Fixup-Runde: F1–F4 (Sammelkommentar PR #1152) abarbeiten; danach Fixup-Nachweis-Review (Diff-Scoping ab 2026-08-31, Sammelkommentar-ID 5481298207 updaten, Findings-Nummern stabil lassen).

## Fallstricke
- PR #1152 bricht Bestands-e2e-Specs AUSSERHALB des Diffs: settings-action-buttons.spec.ts:92-122 (Helper verlangt „Standort ermitteln" in /settings/general → alle 4 Tests rot), settings-switch-layout.spec.ts:62/89 (`.settings-switch-row` nth(2) liegt im versteckten tab-3 → boundingBox null), useShadowDOMLayout-Ref bleibt an tab-0 (SettingsPage.tsx:234) → Geo-Controls in tab-3 (Zeile 378) ohne #843-Margin.
- `.settings-general` ist seit #1152 doppelt belegt (tab-0 + tab-3) — Locatoren mit `.first()` kaschieren das.
- F4: Push-Mock setzt nur `enabled` (test:356), Komponente gated auf `pushSupported` (SettingsPage.tsx:257) → Defekt 1 verifiziert; Defekt 2 (Z. 370) ungeprüft.
- `gh pr edit` hat kein `--jq`; `gh pr diff <n> --stat` existiert nicht (nur --patch/--name-only).
- Findings F1-F4 als eine Review (id 5068793927, COMMENT) + Inline-Kommentar an SettingsPage.tsx:378 gepostet; Verdict needs-fixup.

## Fallstricke
- `gh pr diff 1152 --stat` existiert nicht (Flag unbekannt) → `--patch` + `grep '^diff --git'`.
- Vitest-`toContain` auf einer Zahl (Bitmaske) ist der zentrale Streitpunkt des roten Tests — erst selbst gegenprüben, bevor der PR-Behauptung gefolgt wird.

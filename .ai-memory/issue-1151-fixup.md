# Issue 1151 — Fixup zu PR #1152 (Runde 1), Stand 2026-08-31

## Erledigt
- Alle 4 Findings des ai-review-Kommentars (needs-fixup, Kreuzverhör Runde 1) sind FIXABLE und wurden umgesetzt; keine Entscheidungs-Findings, keine Threads offen (1 Thread = F2/F3 auf SettingsPage.tsx:378).
- F2 (`SettingsPage.tsx:70-89`): zweiter Ref `settingsGeoRef` auf das tab-3-Panel + zweiter `useShadowDOMLayout`-Aufruf mit denselben Selektoren (`kol-input-checkbox, kol-button` / `[role="switch"], button...`).
- F3 (`SettingsPage.tsx:386`): Panel-Klasse `settings-general` → `settings-geo` + neue Gruppenregel `.settings-general, .settings-geo` in `frontend/src/app.css:1548` (padding-inline 1.5rem, flex column, gap var(--pp-gap-base)); Kommentar mit #1080-Präzedenz.
- F1 (`frontend/e2e/settings-action-buttons.spec.ts` komplett umgebaut): Helper-Split `fakeActionButtonsScene` + `openGeneral` (/settings/general) + `openStandort` (/settings/standort, Tab-Verifikation `aria-selected`); Locators `pushButtonHost` (`.settings-general > kol-button`) / `geoButtonHost` (`.settings-geo > kol-button`); `containerMetrics(page, panelSelector)` gescoppt; AK2/AK3/AK4/AK5 je Button im eigenen Tab (Zeilen-Trennungs-Assertion AK2 entfallen → auf settings-tabs.spec.ts AK4 verwiesen, im Testkommentar begründet).
- F4 (`frontend/src/components/SettingsPage.test.tsx:357,371`): `pushState.supported = true;` ergänzt (Mock ist `Record<string, unknown>`, TS-sicher) und `compareDocumentPosition(...)`-Bitmaske auf `& Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()` umgestellt.
- CI-Ergänzung (Step 5, real failure — 5. gebrochene Bestands-Spec, vom Review nur als „3 Bestands-e2e-Specs" zusammengefasst): `frontend/e2e/geolocation.spec.ts` fuhr weiterhin `/settings/general` an (AK1–AK5 alle rot: Switch nicht gefunden / Klick-Timeout) → alle 5 `goto('/settings/general')` → `/settings/standort` (sed, mit #1151-Kommentar).
- CI-Verifikation der Fehlerbilder (Run 33414433813): verify = genau der AK3-Unit-Test (SettingsPage.test.tsx:368 `push` null → F4), e2e(4) = settings-action-buttons AK2–AK5 (→ F1), e2e(2) = issue-843 AK2 (`boundingBox` null, weil inaktive KolTabs-Panels gematcht wurden → F3), e2e(1) = geolocation.spec.ts. Alle Fehlerbilder durch die Fixes gedeckt, nichts Flaky/Unabhängiges.

## Relevante Stellen
- `frontend/src/components/SettingsPage.tsx:70-89,386` — Refs + Hook-Aufrufe + Panel-Klasse.
- `frontend/src/app.css:1542-1560` — Gruppenregel für beide Panels.
- `frontend/e2e/settings-action-buttons.spec.ts` — ganzes File neu (Split nach Tab).
- `frontend/src/components/SettingsPage.test.tsx:349-372` — AK3-Unit-Test.

## Annahmen
- `waitForStableView(page, 'Priority Pilot')` funktioniert auch auf `/settings/standort` (Tablist immer gerendert — vom Review als kosmetisch ok vermerkt, Muster steht so in issue-1098-geo-settings.spec.ts).
- Gate = `pnpm gate` im Root (falls Script fehlt: lint + vitest); Playwright-e2e bewusst NICHT lokal ausgeführt (Zeitlimit) — der PR-Gate läuft sie.
- Übrige `.settings-general`-Locatoren (issue-843.spec.ts, issue-969, issue-1028) treffen jetzt nur noch tab-0 → durch F3 behoben, keine Änderung nötig.

## Verworfen
- Geo-Assertions in issue-843.spec.ts anpassen — Review hat sie nur als Kollateral von F3 genannt; Klassen-Split löst die Doppelbelegung.
- E2E lokal ausführen — Soft-Deadline; Gate/CI deckt es.

## Offen
- Gate-Ergebnis steht aus (gate-runner-Subagent läuft); Commit+Push erst nach Grün.

## Nächster Schritt
- Gate-Grün abwarten → Commit (inkl. dieser Notiz) + Push → Thread F2/F3 resolven, F1/F4 vermerken.

## Fallstricke
- `KolTabs` hält inaktive Panels gemountet — KLASSEN nie doppelt vergeben, sonst treffen Locatoren zwei Panels (#1080-Präzedenz).
- Der Layout-Hook wirkt NUR innerhalb des Ref-Containers → jeder Tab-Panel braucht eigenen Ref + eigenen Aufruf.
- `compareDocumentPosition` liefert eine Bitmaske — `toContain` auf dem Zahlenwert ist ein Typ-Fehler im Test, `& FLAG` + `toBeTruthy()` ist das Muster.

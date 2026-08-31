# Issue 1151 — Review-Phase (PR #1152), Stand 2026-08-31T18:56Z (Fixup-Nachweis, Runde 3)

## Runde 3 (dieser Lauf, VERDICT: needs-fixup)
- Trigger: neuer Code-Commit `4e09dcdc` (18:44Z, „fix(e2e): switch-layout tests an 2 Switches …") nach Runde-2-Verdict reviewed; danach nur Merge `c6e436dc`. Delta = nur `frontend/e2e/settings-switch-layout.spec.ts` (+39/−14): Counts 3→2 in AK1/AK2/AK3, Labels-Array ohne „Standort erfassen", neuer AK7 (Standort-Switch im Standort-Tab, Default aus, in `.settings-switch-row`).
- **F5 (neu, inline-Thread PRRT_kwDONloM186d1k5s, Zeile 66):** AK1/AK2 nutzen page-weiten `page.locator('.settings-switch-row')` + `toHaveCount(2)` — KolTabs hält tab-3 gemountet (app.css:1630-1631 dokumentiert das selbst für #1080), Standort-Row rendert bei `geoSupported` (SettingsPage.tsx:387-388, in Chromium wahr) → DOM-Count auf /settings/general = 3, Tests rot. Fix: auf `.settings-general .settings-switch-row` scopen (Zeilen 66+93), analog AK3 :117. e2e-CI zum Commit war bei Review noch pending.
- **F6 (Mitnahmefall):** app.css:1630 Kommentar „genau 3 im Tab Allgemein" stale (jetzt 2+1 versteckt) + Tippfehler „Sicherungs- Tests" im Spec-Header (aus 4e09dcdc).
- **Sammmelkommentar-Defekt aus Runde 2 behoben:** Kommentar 5481298207 hatte wörtlich „@/tmp/review-body.md" als Body (gh `--body @file`-Missverständnis, Datei weg) → vollständigen Verlauf (F1–F6) neu aufgebaut via `gh api --method PATCH …/issues/comments/5481298207 --input` (JSON per python3). Neuer Body: `.ai-memory/issue-1152-review-body.md`.
- Titel-Gate: „feat(frontend): own standort tab for geo settings (#1151)" — konform, kein Rename.



## Erledigt
- MODE: `<!-- ai-review -->`-Kommentar vorhanden (id 5481298207, erstellt 16:29:03Z, needs-fixup, F1–F4) → **Fixup-Verifikation**, Diff-Scoping ab updatedAt.
- Fixup-Commit `f02b8f65` (16:42:36Z) = einziger Code-Commit nach updatedAt (danach nur Memory-Commits 2e09fe1b/9a9fc471).
- **F1 verifiziert** (`frontend/e2e/settings-action-buttons.spec.ts`, komplett neu): Helper-Split `fakeActionButtonsScene`/`openGeneral`/`openStandort` (mit `aria-selected`-Check), `pushButtonHost` = `.settings-general > kol-button`, `geoButtonHost` = `.settings-geo > kol-button`, `containerMetrics(page, panelSelector)` gescoppt; AK2–AK5 je Button im eigenen Tab; AK2-Zeilen-Trennung entfallen → im Testkommentar auf settings-tabs.spec.ts AK4 verwiesen.
- **F2 verifiziert** (`SettingsPage.tsx:71-72,81-86`): `settingsGeoRef` + zweiter `useShadowDOMLayout`-Aufruf mit denselben Selektoren; Ref am tab-3-Panel (`SettingsPage.tsx:386`).
- **F3 verifiziert** (`SettingsPage.tsx:386` `.settings-geo`; `app.css:1548` Gruppenregel `.settings-general, .settings-geo` mit #1080-Kommentar) — Locatoren treffen jetzt wieder nur tab-0.
- **F4 verifiziert** (`SettingsPage.test.tsx:357` `pushState.supported = true;`, `:370` `& Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()`) — exakt die empfohlenen Fixes.
- CI-Kollateral geprüft: `frontend/e2e/geolocation.spec.ts` 5× `goto('/settings/general')` → `/settings/standort` (nur goto-Zeilen + #1151-Kommentar) — legitimer 5. gebrochener Bestands-Spec, vom Erst-Review als „3 Bestands-e2e-Specs" zusammengefasst.
- Keine neuen Findings im Fixup-Delta; Review-Typ im Footer auf Fixup-Nachweis gestellt, Sammelkommentar (id 5481298207) aktualisiert statt neu erstellt. VERDICT: reviewed.

## Relevante Stellen
- `frontend/src/components/SettingsPage.tsx:386` — tab-3-Panel jetzt `.settings-geo` + `ref={settingsGeoRef}`.
- `frontend/src/app.css:1548` — Gruppenregel; Padding/Flex nur an dieser Stelle gepflegt (gemeinsamer Selektor, keine Duplizierung nötig).
- `frontend/e2e/settings-action-buttons.spec.ts` — Datei komplett neu; AK2–AK5 je Tab.
- `frontend/e2e/geolocation.spec.ts:66,82,102,125,143` — goto-Umzüge.

## Annahmen
- CI für den Fixup-Code ist noch NIE fertig gelaufen: Verify-Run zu `f02b8f65` = cancelled (von Memory-Pushes überholt), aktueller Run (33415710875, Head 9a9fc471 = gleicher Code) pending/in_progress. Kein roter Nachweis mehr → 🟢-Inhaltsempfehlung; der deterministische Gate-Step entscheidet ready-to-merge.
- `e2e (3)` war im Vor-Fix-Run grün (Fixup-Notiz listet nur e2e(1)/(2)/(4) als Fehlerbilder) → settings-switch-layout.spec.ts und die `.settings-general`-Locatoren (issue-843/969/1028) durch F3 behoben.

## Verworfen
- Volles Zweitzreuzverhör — MODE verbietet es; nur Delta + offene Findings.
- Neues Finding für die AK2-Assert-Streichung (Zeilen-Trennung) — im Test begründet und durch settings-tabs.spec.ts AK4 gedeckt; Substanz bleibt erhalten.
- Weiteres Warten auf den CI-Lauf — Zeitlimit; Gate prüft ohnehin deterministisch.

## Offen
- **F5/F6 aus Runde 3** (s.o.) — auf Fixup warten, dann Runde 4 als Fixup-Verifikation (nur Delta + F5/F6 abhaken).

## Nächster Schritt
- Fixup-Runde: Zeilen 66+93 der Spec scopen (`.settings-general .settings-switch-row`), app.css:1630-Kommentar + „Sicherungs- Tests"-Tippfehler mitnehmen; danach Review-Runde 4.

## Fallstricke
- Verify-Runs werden bei jedem Push (auch Memory-Commits) gecancelt — für CI-Evidenz den Head-Run lesen, nicht den zum Code-Commit.
- `containerMetrics` muss je Panel gescoppt werden, sonst misst es das falsche von zwei gemounteten Panels (KolTabs hält inaktive gemountet).
- Fixup hat Thread 3896359411 beantwortet + resolved (PRRT_kwDONloM186dy9WT) — bei Folgeläufen Thread-Status checken, bevor Findings erneut aufgemacht werden.

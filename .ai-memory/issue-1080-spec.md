# Issue 1080 — Spec-Phase-Notizen (abgeschlossen 2026-08-28)

## Erledigt
- Spec geschrieben: `docs/spec/issue-1080.md` (AK1–AK6, Testmapping, KI-UX-Annahmen eingearbeitet).
- Rote Tests geschrieben und als erster Commit (`test: red spec tests for #1080`) auf
  `feat/issue-1080-ki-deaktivierbar` gepusht; Draft-PR #1082 erstellt (Closes #1080, verifiziert).
- `frontend/src/lib/aiPreferences.test.ts` — 7 Vitest-Fälle: Defaults `{aiEnabled:true, quickCaptureEnabled:true}`,
  exakte Keys, Roundtrip, `'true'/'false'`-Format, ungültiger Wert → Default, gesperrter Storage → kein Crash.
  ROT bestätigt: `TS2307 Cannot find module './aiPreferences'` (legitimer Erst-Zustand).
- `frontend/e2e/ai-disable.spec.ts` — 6 Tests (AK1+AK3 kombiniert, AK2 zweimal: Toolbar+Create-Form,
  Bearbeiten-Dialog; AK4, AK5, AK6). AK1-Test lokal gegen Chromium gelaufen: rot an der richtigen
  Stelle (`toBeVisible` schlägt fehl, Switch existiert nicht) — Serverstart + KoliBri-Hydration funktionieren.
- Storage-Keys festgenagelt: `pp-ai-enabled`, `pp-quick-capture-enabled` (Unit-Test ↔ e2e-Mirror).

## Relevante Stellen
- `frontend/src/lib/aiPreferences.ts` (FEHLT noch) — umzusetzen nach Muster `voiceAutostart.ts`;
  exportiert `AI_ENABLED_STORAGE_KEY`, `QUICK_CAPTURE_ENABLED_STORAGE_KEY`, `readAiPreferences()`, `storeAiPreferences()`.
- `frontend/src/components/SettingsPage.tsx:303` — `div.settings-llm`, hier beide Switches einhängen
  (`.settings-switch-row`-Muster, Zeilen 153-236 als Vorbild).
- `frontend/src/App.tsx:432` (Toolbar „Säulen-Berater"), `App.tsx:652` (`dialog.kind === 'create'` →
  QuickCaptureModal), `App.tsx:685` (Advisor) — Umschaltpunkte AK2/AK4.
- `frontend/src/components/TaskForm.tsx:775,983` — Lektorat-Buttons (AK2).
- `frontend/e2e/settings-switch-layout.spec.ts:28` — `switchControl`-Fallback (`switch`|`checkbox`) kopiert.
- `frontend/e2e/helpers.ts:42` — `headerAction` ist `async` → gibt `Promise<Locator>`; `await expect(headerAction(...))`
  ist ein TS-Fehler, Locator-Expect direkt bauen.

## Annahmen
- Switch-Labels exakt „KI-Features aktiv" und „Schnellerfassung aktiv" (positiv, KI-UX-Empfehlung) —
  Tests addressieren sie per Regex `^…$`; Labels müssen wortgleich umgesetzt werden.
- Werte im localStorage als `'true'`/`'false'`; ungültig (`'1'`, sonstiges) → Default `true`.
- Präferenzen werden beim Mount gelesen (kein Live-Reaktivitäts-Contract über Tabs hinweg getestet).

## Verworfen
- e2e für alle AK2-Kombinationen (Toolbar + Create + Edit in einem Test) — in zwei Tests getrennt
  (Create braucht `quickCapture=false`, Edit testet den `TaskForm`-Dialog unabhängig).
- `--with-deps` bei der Playwright-Installation — nicht nötig, Chromium-Headless-Shell lief ohne System-Deps-Install.

## Offen
- Pre-commit-Hook (lefthook) scheitert an den roten Tests zwangsläufig (knip: unresolved import
  `./aiPreferences`, `tsc` TS2307) → Commit mit `--no-verify`. Nicht als Fehler der Tests werten.

## Nächster Schritt
- Impl-Phase: `aiPreferences.ts` anlegen (Key-Namen EXAKT wie im Unit-Test), Switches in
  `SettingsPage.tsx` (`.settings-llm`) einhängen, `App.tsx`/`TaskForm.tsx` bedingen — bis alle
  13 Tests grün sind.

## Fallstricke
- Bestehende e2e (`pillar-advisor*.spec.ts`, `lektorat-button.spec.ts`, `header-consistency`,
  `mobile-shell`, `issue-691`) setzen den Berater-Button voraus → Default MUSS „KI aktiv" bleiben.
- KolTabs hält beide Panels gemountet (nur ausgeblendet) — Assertions auf „nicht gerendert" mit
  `toHaveCount(0)` statt `toBeHidden` innerhalb von Panels formulieren.
- Switch-Zustand per `toBeChecked()` prüfen, nicht per `aria-checked`-Attribut (KoliBri implizit).
- AK6: `.settings-llm kol-input-checkbox[_variant="switch"]` muss genau 2 Treffer liefern —
  weitere Switches im Tab würden den Guard brechen.

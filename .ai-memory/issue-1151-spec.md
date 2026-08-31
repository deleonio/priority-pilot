# Issue 1151 — Spec-Phase (rote Tests), Stand 2026-08-31

## Erledigt
- Branch `ai/harness/1151` fortgeführt (vorher nur Triage-/UX-Memory-Commits); Spec `docs/spec/issue-1151.md` neu erstellt (kein voriger Spec-Eintrag vorhanden).
- Rote Tests geschrieben, alle verifiziert rot bzw. rot-by-construction:
  - Unit (Vitest): `frontend/src/components/SettingsPage.test.tsx`, neuer Block `#1151: Standort-Tab` — 4 Tests (AK1 tab-3-Panel, AK2 Geo raus aus tab-0, AK2 Geo vollständig in tab-3, AK3 tab-0-Reihenfolge Darstellung→Sprachaufnahme→Push). `pnpm vitest run` dort: 4 failed | 9 passed (bestehende #933/#1017/#1098-Tests bleiben grün).
  - E2E: `frontend/e2e/settings-tabs.spec.ts`, neuer Block `#1151` — 5 Tests (AK1 Route+4 Tabs, AK2 Geo-Switch nur im Standort-Tab, AK2/AK3 Slider bei Standort an, AK4 URL/Back/Fallback `/settings/xyz`→Säulen, AK5 375px Bounding-Boxen).
  - E2E-Anpassung (TF2): `frontend/e2e/issue-1098-geo-settings.spec.ts` — 2× `goto('/settings/general')` → `/settings/standort` (Zeilen ~95/120); dadurch rot bis zur Impl, dann wieder grün (Test-Pflege-Bedarf im PR-Body).
- beforeEach in `SettingsPage.test.tsx` auf `/settings/standort` umgestellt (fachlicher Kontext; Panels bleiben in jsdom gemountet — assertions hängen an Slots, nicht an der URL).
- Draft-PR erstellt, `Closes #1151`; Label-Regeln eingehalten (keine Labels gesetzt).

## Relevante Stellen
- `frontend/src/components/SettingsPage.tsx:32` — `SETTINGS_TABS` (3 Einträge) → 4. Eintrag `{ _label: 'Standort' }`.
- `frontend/src/App.tsx:60` — `SETTINGS_PATH_SEGMENTS = ['general','pillars','llm']` → `'standort'` anhängen (Index-Parität!).
- `frontend/src/components/SettingsPage.tsx:224-426` — Geo-Block (Switch Z.309-337, Button+Adresse Z.338-361, Slider Z.363-426) aus `slot="tab-0"` in neuen `slot="tab-3"` verschieben; Remount-Keys (`key={geoPending…}` Z.346, `key=…geoEnabled…` Z.372/392/412) MIT umziehen (KI-UX).
- `frontend/src/components/SettingsPage.tsx:229,232,251+` — bleibt in tab-0: AppearanceSetting (KolInputRadio `_label="Darstellung"` — NICHT KolInputCheckbox), Sprachaufnahme, Push.
- Fallback unverändert: `App.tsx:123-126` unbekanntes Segment → Index 1 (Säulen); Test `AK4: unbekanntes Segment` sichert das.

## Annahmen
- Tab-Position Index 3 (hinter KI-Provider) fixiert — UX-Empfehlung (Position 2) verworfen, Analyse fixiert Index 3; in Spec dokumentiert.
- URL-Segment `standort` (nicht `location`) — in Spec festgelegt (KI-UX offene Frage 2).
- jsdom rendert `kol-tabs` unregistriert: alle `slot="tab-N"`-Panels bleiben im DOM → Slot-Vertrag per DOM-Abfrage prüfbar; URL-/Tab-Auswahl nur e2e (settings-tabs.spec.ts).

## Verworfen
- Unit-Test auf `kol-tabs._tabs`-Property (4 Tab-Labels) — KoliBri-Adapter setzt Props in jsdom unzuverlässig (Property vs. Attribut); Tab-Labels sind e2e-Vertrag.
- `scrollWidth`-Assertion für AK5 — App-Shell clippt `overflow-x:hidden` (Memory 2026-08-24); Bounding-Boxen benutzt.
- Playwright-Lauf zur Rot-Verifikation — Chromium in der Sandbox nicht installiert; Rot folgt zwingend (Geo lebt aktuell in `/settings/general`, `/settings/standort` fällt auf Säulen zurück).
- `expect(...).not.toBeNull()` auf `tab3?.querySelector(...)` — liefert `undefined` bei fehlendem Panel und würde grün; auf `toBeTruthy()` + vorherige Panel-Null-Prüfung umgestellt.

## Offen
- -

## Nächster Schritt
- Impl-Phase (Routing: sonnet/high): Spec umsetzen — 4. Tab + Slot-Umzug (s. Relevante Stellen), dann alle roten Tests grün fahren (Vitest + `npx playwright test e2e/settings-tabs.spec.ts e2e/issue-1098-geo-settings.spec.ts` im `frontend`-Verzeichnis).

## Fallstricke
- `SETTINGS_PATH_SEGMENTS` und `SETTINGS_TABS` müssen Index-paritätisch erweitert werden; `changeSettingsTab` (App.tsx:351-357) mappt sonst auf das falsche Segment.
- AppearanceSetting ist ein `kol-input-radio` (`_label="Darstellung"`), kein Checkbox — Unit-Selector entsprechend.
- Bestehende Tests nicht kaputtspielen: `settings-tabs.spec.ts` (#271/#323-Blöcke) und `SettingsPage.test.tsx` (#933/#1017/#1098) bleiben unverändert grün — der 13er-Vitest-Lauf muss 9 grün behalten.
- `waitForStableView(page, 'Allgemein')` im #1098-Spec bleibt gültig (Tab-Label existiert weiter).

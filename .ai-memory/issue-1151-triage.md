# Issue 1151 — Triage (Phase 1), Stand 2026-08-31T15:42:48Z

**ERGEBNIS: VERDICT analyzed, Ampel 🟢.** Initial-Triage (kein Harness-Kommentar; einziger Kommentar = github-actions-Qualitätscheck 15:37:57Z, keine Entscheidung). Harness-Kommentar erstellt (id `IC_kwDONloM188AAAABRq10ag`, KI-ANALYSE + ai-phase-routing verifiziert), Labels `ai:needs-analyse` entfernt, `ai:analysed` + `ai:needs-ux-ui` gesetzt (Endstand verifiziert). Kein Ping-Kommentar, kein Titel-/Body-Edit (Titel „Geo-Location-Settings in eigenes Tab verschieben" — trifft exakt zu), kein Split (eine Komponente + Tests = ein PR). Kein Auto-Close: `SETTINGS_TABS` (SettingsPage.tsx:32) hat nur 3 Tabs, kein „Standort" — Anforderung klar nicht erfüllt.

## Erledigt
- Trigger geprüft, Issue-Body analysiert, Code-Recherche per `recherche`-Subagent (ADR 0008).
- Harness-Kommentar per Write-Datei + `gh issue comment --body-file` erstellt; Landing verifiziert (1× Marker, beide Blöcke).

## Relevante Stellen
- `frontend/src/components/SettingsPage.tsx:32` — `SETTINGS_TABS = [{_label:'Allgemein'},{_label:'Säulen'},{_label:'KI-Provider'}]`; neuer Tab = Eintrag `Standort` (Index 3).
- `frontend/src/components/SettingsPage.tsx:221-487` — KolTabs `_selected={activeTab}` + Slots `tab-0..tab-2`; Geo-Block = Zeilen 309-427 (Switch 310-331, Ermitteln-Button 340-356, Addressanzeige 357-361, 3 Slider 363-426) → wandert in neuen `slot="tab-3"`; in „Allgemein" bleiben Appearance :229, Sprachaufnahme :232-250, Push :251-308 (Reihenfolge unantastbar, AK3).
- `frontend/src/App.tsx:60` — `SETTINGS_PATH_SEGMENTS = ['general','pillars','llm']` → `'standort'` anhängen; :123-126 `settingsTab`-Ableitung (unbekanntes Segment → Fallback Index 1 „pillars", NICHT ändern); :351-357 `changeSettingsTab`; :347 `openSettings` → `/settings/general`.
- `frontend/src/components/SettingsPage.test.tsx:81-83` — setzt `/settings/general` per history.replaceState; Geo-Tests auf `/settings/standort` umstellen (TF4).
- `frontend/e2e/issue-1098-geo-settings.spec.ts:95,119` — öffnet Geo-Settings über `/settings/general`; muss auf `/settings/standort` (TF2), sonst rot.
- `frontend/e2e/settings-tabs.spec.ts` — Erweiterungsziel TF1/TF3 (bestehende AK3-Struktur Saeulen↔Allgemein bleibt).

## Annahmen
- Vierter Tab hinten (Index 3, Segment `standort`) — Issue lässt Reihenfolge offen („neuer vierter Tab oder dritter"); hinten ist der nicht-invasive Fall, im Analyse-Block als AK1 verankert.
- Kein i18n-System — Tab-Labels hartcodiert deutsch (recherche-Befund); „Standort" direkt als Label.
- Routing-Tabelle (ux ja/sonnet/medium, spec ja/sonnet/medium, impl ja/sonnet/high, review ja/sonnet/high) = etabliertes Muster (#1083-Präzedenz), für Folgephasen bindend.

## Verworfen
- Titel-/Body-Edit — Titel exakt, Body gut strukturiert; pro-forma-Editz verboten (ADR 0009: Body nie anfassen).
- Split — eine Seite + Routing + Testumbau, ein PR.
- UX=nein — Issue-Thema ist UX/UI (Tab-Platzierung, 4-Tab-Leiste mobil relevanter Design-Input); ux=ja gesetzt.
- MEMORY.md-Eintrag — kein neuer Fehler/noch nicht gelöste Erfahrung; Aufnahmekriterium nicht erfüllt.

## Offen
- `.ai-memory/issue-1151-harness.md` ist Wegwerf-Artefakt (gesendeter Kommentar-Stand) — NICHT committen; nur diese Datei hier ist die Phasen-Notiz. `rm` braucht Freigabe (Muster #1083/#1095/#1098).

## Nächster Schritt
- UX-Phase (Label `ai:needs-ux-ui` gesetzt): KI-UX-Block in den Harness-Kommentar (read-modify-write, Analyse-Block byte-frei halten), Fokus 4-Tab-Leiste @375px + ggf. Tab-Reihenfolge.

## Fallstricke
- KolTabs blendet inaktive Panels nur AUS (SettingsPage.tsx:429-431) — „nicht sichtbar"-Assertions müssen Sichtbarkeit prüfen, nicht DOM-Abwesenheit; umgekehrt dürfen Geo-Tests nicht auf Mount-Reihenfolge pochen.
- `SETTINGS_TABS` und `SETTINGS_PATH_SEGMENTS` müssen Index-konsistent bleiben (Tab N ↔ Segment N) — sonst navigiert `changeSettingsTab` auf den Fallback.
- Unbekanntes Segment fällt auf Index 1 („pillars") — Fallback-Verhalten ist getestet/erwartbar, nicht „verbessern".
- E2E-Filter: `pnpm --filter frontend test:e2e -- <pattern>` filtert nicht — direkt `npx playwright test e2e/<datei>.spec.ts` im `frontend`-Verzeichnis (MEMORY 2026-08-26).
- TF5: Bounding-Box-Assertions statt scrollWidth (App-Shell clippt overflow-x:hidden, MEMORY 2026-08-24).

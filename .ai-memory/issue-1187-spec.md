# Issue 1187 — Spec (Phase 3), Stand 2026-09-03T01:15Z

## Erledigt
- Branch `ai/harness/1187` von main (016d3432) neu aufgesetzt; kein offener PR existierte (Idempotenz geprüft).
- Spec `docs/spec/issue-1187.md` geschrieben (AK1–AK6, Test-Abdeckung, Abgrenzungen).
- Rote Tests geschrieben und Rot-Verifikation gefahren:
  - `frontend/src/lib/reducedMotion.test.ts` NEU (AK2a–e: Hook `usePrefersReducedMotion` Initial/Flip/Cleanup) — Datei-Level rot (Import `./reducedMotion` scheitert, Modul existiert nicht).
  - `frontend/src/components/SettingsPage.test.tsx` neuer Describe „#1187" (AK1 ×2, AK4 ×1). Rot verifiziert: `AK1 reduce → AssertionError „Info-Meldung … fehlt: expected 0 to be greater than 0"`; AK1-no-preference + AK4 aktuell grün (Regression-Guards, Mutations-Biss: `_disabled` am Schalter oder Wert-Verlust würde sie rot machen). Bestehende 18 Tests der Datei unberührt grün.
  - `frontend/e2e/issue-1187-reduced-motion.spec.ts` NEU (AK1/AK2/AK5/AK6; AK3 bewusst nicht dupliziert).
- Prettier + ESLint aller neuen/geänderten Dateien grün.

## Relevante Stellen
- `frontend/src/lib/confetti.test.ts:120` — existierender Test „AK4: Key true + reduced-motion → kein Overlay" (#1183) = AK3-Unit-Abdeckung; `frontend/e2e/issue-1169-confetti.spec.ts` AK6 = AK3-E2E-Abdeckung (beforeEach setzt Key `true`, emulateMedia reduce) → Dedup, keine neuen AK3-Tests.
- `frontend/src/lib/theme.ts:92-103` — Listener-Muster-Vorgabe für den neuen Hook (matchMedia change + Cleanup).
- `frontend/src/components/SettingsPage.tsx:246,271-283,308-311` — Panel tab-0, Animationen-Schalter (Hook `useAnimationsEnabled` :105), Push-Info-Banner als Stilvorlage.
- `frontend/src/lib/confetti.ts:78` — reduce-Frühcheck pro Aufruf = AK5-Konfetti-Seite bereits live; nur E2E-Integration fehlt (jetzt vorhanden).
- E2E-Hilfen kopiert aus `issue-1169-confetti.spec.ts` (createTask/fetchStatus/deleteAllTasks/openTasksTab/doneToggle) + Settings-Navigation aus `settings-page.spec.ts` (Toolbar „Kopf-Aktionen" → Einstellungen).

## Annahmen
- Vertragspunkt Banner = `kol-alert[_type="info"]` in `[slot="tab-0"]`, dessen Label/Text „Bewegung reduzieren" enthält; konkreter Wortlaut der Impl freigegeben (in Spec-Abgrenzungen verankert).
- Hook-Name `usePrefersReducedMotion` in `frontend/src/lib/reducedMotion.ts` ist die von den Tests erzwungene API (Datei-Name aus KI-ANALYSE, Name analog theme.ts-Konvention).
- AK4-Unit-Test darf grün starten (bestehendes Verhalten), Biss über `_disabled`-Verbot + Key-Sync.

## Verworfen
- AK3-Neutests (Unit + E2E) — Dedup lt. SKILL Schritt 3; Abdeckung existiert (s. Relevante Stellen), kein Widerspruch → kein Test-Pflege-Bedarf.
- Mocken des zukünftigen `reducedMotion`-Moduls in SettingsPage-Tests — bewusst NICHT gemockt, damit AK1 gegen die echte Integration rot läuft.

## Offen
- Draft-PR **#1195** erstellt (closes #1187 verifiziert). Branch-Push war Force (`--force-with-lease`): Remote `ai/harness/1187` trug nur veraltete Triage-Memory-Commits auf altem main (v0.1.681, ohne #1183-Code) — deren Inhalt (Re-Triage-Notiz 2026-09-03T01:02:30Z) wurde in neuerer Fassung übernommen.

## Nächster Schritt
- Impl-Phase: `frontend/src/lib/reducedMotion.ts` + Banner in SettingsPage tab-0 bauen, alle roten Tests grün; danach E2E-Verifikation.

## Fallstricke
- E2E `issue-1187` AK5: emulateMedia NACH App-Load (kein `page.reload()`), sonst wertlos — beforeEach setzt `pp-animations-enabled`=`true` (Default aus seit #1183).
- SettingsPage-Unit: Push-Info-Banner (pushSupported falsy → `pushState={}`) ist ebenfalls `_type="info"` in tab-0 — Banner-Filter MUSS auf Text „Bewegung reduzieren" laufen, nicht nur auf `_type`.
- KolTabs lässt Panels gemountet: E2E-Banner-Locator auf `[slot="tab-0"]` scopen; „nicht vorhanden" per `toHaveCount(0)` (bedingtes Rendern), nicht `toBeHidden`.
- AK6: Lesbarkeit per Bounding-Box im Viewport prüfen (scrollWidth hat keinen Biss, App-Shell clippt overflow-x — Memory 2026-08-24).

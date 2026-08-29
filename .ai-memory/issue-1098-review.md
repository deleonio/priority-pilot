# Issue 1098 — Review (Phase 5/7), Stand 2026-08-29 (Runde 4)

## Erledigt
- MODE = Fixup-Nachweis: Sammelkommentar mit `<!-- ai-review -->` gefunden (id 5459252697, updatedAt 2026-08-29T01:00:01Z), Delta per Commit-Liste gescoped: nur `9a7ec8c5`/`bba27efc` (memory), `c5baa245` (CI-Harness ADR 0008/Mentor-Gate), `1d4f1949` (`session.test.ts` Skip-Fix) + Merge `912966ae`.
- Kein Delta-Commit berührt `server/src/models/user.ts`, `server/src/logics/migrate.ts`, `SettingsPage.tsx`, `routes/tasks.ts`, `PillarList.tsx`, `LlmSettings.tsx` → keine neuen Findings, kein Verhandeln alter Punkte.
- Findings am Head `912966ae` re-verifiziert: F1 (grep `migrateUserGeoConfig` server/src = 0 Treffer), F3 (`PillarList.tsx:48` `data ?? []`, `LlmSettings.tsx:61` `?? null` mit Bestätigungs-Kommentar), F4 (`SettingsPage.tsx:192` `('true' as unknown as boolean)`), F5 (`tasks.ts:356` `User.findByPk(getUserId(req))`) — alle unverändert offen. F2 bleibt behoben.
- Sammelkommentar per PATCH in-place aktualisiert (id 5459252697, Review-Typ: Fixup-Nachweis, Updated: 2026-08-29). VERDICT: needs-fixup. Keine Labels gesetzt, kein Code geändert.

## Relevante Stellen
- `server/src/logics/migrate.ts` + `server/src/index.ts:136-144` — F1-Fixziel: `migrateUserGeoConfigColumns` vor `sync()`.
- `frontend/src/components/SettingsPage.tsx:192` — F4-Cast.
- `server/src/express/routes/geoConfig.ts` (`resolveGeoUser`) + `routes/tasks.ts:356` — F5: gemeinsames Modul + geteilter Default.
- `frontend/src/components/PillarList.tsx:48`, `LlmSettings.tsx:61`, `frontend/src/components/SettingsPage.test.tsx:40-46` — F3: Revert + Test-Double schärfen.

## Annahmen
- `c5baa245` (CI-Harness) ist beabsichtigter Harness-Transport auf diesem Branch (Muster wie Merge `6d9f93d5`/#1104) — nur als Randnotiz im Sammelkommentar, kein Finding (kein #1098-Vertrag betroffen).

## Verworfen
- Neue inline Kommentare — die 4 offenen Findings sind bereits in früheren Runden inline verankert; Re-Posting würde duplizieren.
- Titel-Gate-Eingriff — `feat(frontend): server-side geo config, alarm distance, interval (#1098)` erfüllt Conventional Commits.

## Offen
- F1/F3/F4/F5 blocken den 🟢; Fixup-Phase muss liefern (F1 zuerst — Blocker, Bruch auf Bestands-DBs).

## Nächster Schritt
- 5. Runde Fixup-Nachweis: nur den Diff seit dem `updatedAt` des Sammelkommentars prüfen; F1 zuerst verifizieren (`migrate.ts` + `index.ts`), dann F3/F4/F5.

## Fallstricke
- Die Fixup-Läufe landen bisher nur Memory-/CI-Commits — für den Fortschritt zählt der Produktcode-Diff, nicht die Commit-Anzahl.
- `session.test.ts`-Fix (`1d4f1949`) ist ein Test-Body-Abbruch-Fix: `t.skip()` bricht nicht ab → `return` nach Skip; relevant falls weitere Redis-Skips ergänzt werden.

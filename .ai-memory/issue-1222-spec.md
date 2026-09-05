# Issue 1222 — Spec (Phase 3), Stand 2026-09-05T21:20Z

**ERGEBNIS: VERDICT spec-partial (erster Lauf, Soft-Deadline).** Server-rote Tests (AK1–AK7)
+ Spec liegen auf `ai/harness/1222` im Draft-PR; AK8–AK10 (Frontend) fehlen noch → Folgelauf
ergänzt sie im SELBEN Branch/PR.

## Erledigt
- Branch `ai/harness/1222` ausgecheckt (vorhanden, Triage- + UX-Notes drauf); lokale untracked
  Duplikate von `issue-1222-triage.md`/`-ux.md` mit `rm` entfernt (byte-identisch mit Branch-Stand, per diff verifiziert).
- `docs/spec/issue-1222.md` neu (TF1–TF10 → AK1–AK10, KI-UX-Anforderungen eingearbeitet).
- `server/src/express/series-created-by.test.ts` NEU: AK1 (POST ohne userId), AK2 (403 ohne
  gemeinsame Gruppe + userId-Typ-Check 400), AK3 (userId=Empfänger, createdById=Ersteller),
  AK5 (GET /series mit forUserId/forUserName), AK7 (Bestandsserie ohne createdById lesbar).
- `server/src/express/series-recipient-instances.test.ts` NEU: AK4 beide Generate-Wege
  (generate-all als Empfänger; /series/:id/generate, Orakel über Task.findAll),
  AK6 (PATCH/DELETE ?cascade=true durch Ersteller → 404, Empfänger bleibt patchbar).

## Relevante Stellen
- `server/src/express/routes/series.ts:342` — POST setzt `userId: getUserId(req) ?? null` → Empfänger-Logik (#1213-Muster tasks.ts:460-489) hier rein.
- `server/src/logics/series.ts:154` — Instanz-`userId: options.userId ?? null` → auf `series.userId` defaulten (AK4-Kernstelle).
- `server/src/express/routes/tasks.ts:116-169` — `serializeTask`-Kennzeichen + `taskReadScope` als Vorbild für serializeSeries/Lese-Scope; `loadUserNames` (tasks.ts:105) wiederverwendbar.
- `server/src/logics/migrate.ts:481-496` — `migrateTaskCreatedById` als Migrationsvorlage; Registrierung `server/src/index.ts:148/195`.
- `frontend/src/components/TaskForm.tsx:921` — `!isEdit && !isSeriesMode` → Bedingung auf `!isEdit` reduzieren (AK8); Payload-Stelle `:682` (createSeries ohne userId).
- `frontend/src/components/SeriesTab.tsx:145-154` — Badge-Gruppe + Toolbar (AK9: KolBadge „Für: …", Aktionen bei fremder Serie nicht rendern).
- Test-Muster: `server/src/express/tasks-created-by.test.ts` (#1213), e2e-Muster `frontend/e2e/groups-foreign-task.spec.ts` (test-login + zweiter Context + boundingBox-Helper).

## Annahmen
- Series-DTO erhält `createdById/createdByName/forUserId/forUserName` (Spiegel zum Task-DTO); Tests deklarieren die Felder optional (`CreatedBySeriesDto`), damit tsc grün bleibt bis zur Impl.
- AK6 ist mit bestehendem `ownerScope` automatisch erfüllt, sobald die Serie den Empfänger als `userId` trägt — Test sichert den Spiegel gegen eine zu großzügige Lese-/Schreib-Scope-Erweiterung.
- Migrationstest (idempotent, frische DB No-op) bewusst NICHT als Export-Import-Test geschrieben (tsc-Risiko bei fehlendem Export); AK7 verhält sich über die Lesbarkeits-Vertragstestung.

## Verworfen
- dedup: series-dataisolation.test.ts (AK „Alice sieht nur eigene Serien") bleibt unverändert gültig — neuer Lese-Scope `{userId} OR {createdById}` verletzt es nicht; kein Test-Pflege-Bedarf.
- Unit-Test für 403-Fallback-Wording („Serie" statt „Aufgabe", KI-UX): Fehlerpfad nur nach sichtbarer Auswahl erreichbar, in jsdom nicht deterministisch triggerbar → im Spec als Review-Verifikation dokumentiert.
- Migration-Red-Test gegen noch nicht existierenden Export `migrateSeriesCreatedById` — Typfehler-Risiko im Workspace-Check, kein Verhaltensgewinn gegenüber TF7.

## Offen
- AK8 (`TaskForm.test.tsx`: Empfänger-Select im Serie-Modus, Vorbelegung, Moduswechsel erhält Wahl, userId im createSeries-Payload, ausgeblendet im Edit) — NICHT geschrieben.
- AK9 (`SeriesTab.test.tsx`: „Für: Name"-Badge für fremde Serie, eigene ohne, Bearbeiten/Löschen nicht gerendert; dazu `KolBadge` im Komponenten-Mock ergänzen) — NICHT geschrieben.
- AK10 (`frontend/e2e/issue-1222-series-recipient.spec.ts`, 375 px + 320 px boundingBox, Muster groups-foreign-task.spec.ts) — NICHT geschrieben.

## Nächster Schritt
- Folgelauf Spec (derselbe Branch `ai/harness/1222`, derselbe Draft-PR): AK8–AK10 ergänzen, `.ai-memory/issue-1222-spec.md` aktualisieren, erneut pushen. Danach VERDICT: ready.

## Fallstricke
- `Series`-Fixtures in TaskForm/SeriesTab-Tests: neue DTO-Felder per Intersection-Typ (`Series & { forUserId?: … }`) + Cast — sonst tsc rot (MUSTER aus Memory 2026-08-23).
- SeriesTab.test.tsx hat aktuell KEINEN `KolBadge`-Mock — beim Ergänzen an den bestehenden `vi.mock('@public-ui/react-v19')`-Block anhängen, nicht neu mocken.
- generate-all-Test: `materializeDueSeries(userId)` läuft nur über Serien des Aufrufers → Empfänger (Bob) muss den Lauf starten, nicht der Ersteller.
- e2e: KolSingleSelect ist im echten Browser eine Combobox — `getByLabel('Empfänger').click()` + `getByRole('option', …)` (Muster groups-foreign-task.spec.ts), nicht `select`-API.
- Deadline des Laufs war knapp (Soft-Deadline 1788640958 ≈ 21:22 UTC): Server-Tests + Spec schafften es, Frontend-Tests wurden für den Folgelauf hinterlegt.

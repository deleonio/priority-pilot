# Issue 1213 — Review (Kreuzverhör PR #1218), Stand 2026-09-04

**ERGEBNIS: VERDICT reviewed, Ampel 🟢, NIT-ONLY (kein Fixup).** Sammelkommentar `<!-- ai-review -->` neu angelegt (id 5542280261). Titel-Gate vorher: PR-Titel auf `feat(server): create tasks for group members (#1213)` geändert.

## Erledigt
- MODE-Klausel: kein existierender ai-review-Kommentar (pulls/comments + issues/comments je 0 Treffer) → Kreuzverhör-Erstrunde, ganzer Diff (1518 Zeilen, 19 Dateien) gelesen.
- AK-Quelle: Harness-Kommentar 5541327071 (`<!-- ai-harness -->` + KI-ANALYSE, stand=2026-09-04T13:44:18Z) — AK1–AK8 + KI-UX-Block; Issue-Body selbst nicht gebraucht.
- AK-Abgleich: AK1–AK6 server/src/express/tasks-created-by.test.ts (echte HTTP-Tests, rot-fähig), AK7 TaskForm.test.tsx:1793+ / QuickCaptureModal.test.tsx:506+, AK8 e2e groups-foreign-task.spec.ts (2 Tests, 375 px per Bounding-Box). CI: verify pass, e2e (1)–(4) pass, mergeable_state=unstable nur wegen laufender Review-Phase.
- Sicherheitsabgleich: `userId`/`createdById` werden in `Task.create({...validation.attrs, userId: …, createdById: requesterId})` NACH dem Spread gesetzt → keine Injektion aus dem Body möglich; 403 (AK2) vor Transaktion; Schreib-Scope (findOwnTask, PATCH/DELETE, GET /tasks/:id) unverändert ownerScope; GET /tasks/:id für Ersteller bewusst 404 (AK5 verlangt nur Listen-Sicht — kein Finding).
- KoliBri/Mobile/A11y: KolSingleSelect/KolBadge/KolAlert wie im UX-Block, kein Custom-Styling, keine neuen @media.

## Relevante Stellen
- `server/src/express/routes/tasks.ts:108-176` — TaskSerializeContext, serializeTask (handedOff-Logik: forUser* nur aus Ersteller-Sicht), taskReadScope (Op.or userId/createdById, NULL-sicher), serializeTasksFor.
- `server/src/express/routes/tasks.ts:445-490` — POST: userId-Validierung (400 bei Nicht-Integer), Gruppen-Check via GroupMember, recipientId/createdById.
- `server/src/logics/migrate.ts:482-1491` (migrateTaskCreatedById) + `server/src/index.ts:148,193` — Spalte vor sync(), idempotent; migrate.test.ts:331 dokumentiert nachgezogen.
- `frontend/src/components/TaskForm.tsx:546-606,928-949` — Empfängerauswahl (nur Anlege-Modus, ≥1 Gruppe, eigene ID vorbelegt, userId nur bei abweichender Auswahl im Payload).
- `frontend/src/components/TaskTree.tsx:869-893` — handedOff blendet task-tree-actions aus; Badges „Für:"/"Erstellt von:"; App.tsx:696,711 übergibt userId={user.id}.

## Annahmen
- Client-Typen (api.d.ts/schema.d.ts) sind Build-Artefakte aus openapi.yml (`client/package.json` generate-Script) — PR-Dateiliste enthält sie nicht, aber verify/build grün belegt, dass fürUserName etc. typseitig vorhanden sind.
- GroupMember-Zeilen entstehen erst mit Annahme der Einladung (separate invitations-API, e2e belegt Flow) — „shared group"-Check prüft also nur echte Mitgliedschaften.

## Verworfen
- Type-Assertion-Nit (`tasks.ts:144` `task.userId as number`): guarded durch handedOff und mit In-File-Präzedenz (`:418` latitude/longitude) — kein Konventionsbruch, nicht gemeldet.
- Finding „Ersteller kann Aufgabe nicht löschen": AK5 gibt Schreibrechte ausdrücklich nur dem Empfänger (Issue-Entscheidung) — kein Review-Finding.
- MEMORY.md-Eintrag: kein neuer Fehler/Experience-Kriterium erfüllt (strenger Maßstab).

## Offen
- - (Nits sind im Sammelkommentar dokumentiert, kein Fixup nötig)

## Nächster Schritt
- Workflow übernimmt (Label/Gate); bei menschlicher Nachfrage: Nits 1–3 aus dem Sammelkommentar (resolveGeoUser-Doppelauflösung, TaskForm own===null-Hinweis, e2e-Cleanup über Empfänger-Kontext).

## Fallstricke
- Fixup-Nachweis-Runde (falls Mensch doch einen Fixup ordert): Sammelkommentar 5542280261 per PATCH aktualisieren, nicht neu anlegen; Finding-Nummern gibt es noch keine — Nits bei Übernahme unter „✅ Behobene Anmerkungen" historisieren.
- `gh api repos/deleonio/priority-pilot/...` — Owner korrekt `deleonio` (Tippfehler `deleonionlaw` → 404).

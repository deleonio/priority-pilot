# Issue 1250 — Triage (Phase 1), Stand 2026-09-06T11:01:28Z

**ERGEBNIS: VERDICT analyzed, Ampel 🟢.** Initial-Triage (kein Harness-Kommentar; einziger Kommentar = github-actions-Qualitätscheck 2026-09-06T10:00:22Z, keine Entscheidung). Harness-Kommentar erstellt (issuecomment-5558777727), Labels `ai:analysed` + `ai:needs-spec` gesetzt (ux=nein → direkt Spec). Kein Ping, kein Titel-/Body-Edit, kein Split (server-only, 2 Routendateien, ein PR), kein Auto-Close (Bug real, `createdById`-Grant bedingungslos im Code).

## Erledigt
- Issue + Memory geladen, Trigger als Initial-Triage bestimmt.
- Code-Recherche: `taskReadScope` (`server/src/express/routes/tasks.ts:167-172`, Einsatz Z. 392 in GET /tasks), `seriesReadScope` (`server/src/express/routes/series.ts:158-160`, Einsatz Z. 378 in GET /series) — beide `{ [Op.or]: [{ userId }, { createdById: requesterId }] }` ohne Gruppenprüfung. Gruppenlöschung (`groups.ts:227-228`, GroupMember-Zeilen destroy) und Mitglied-Entfernung (`groups.ts:553`, target.destroy()) löschen nur Mitgliedschaften → Issue-These am Code bestätigt.
- Nebenbefund verankert (AK7): `GET /tasks/:id` (tasks.ts:526-532) und `GET /series/:id` (series.ts:471) sind bereits owner-only (404 für Ersteller) — Issue-AC „GET /tasks/{id} antwortet 404" ist dort Status quo, nur die LISTE leakt.
- Muster identifiziert: POST /tasks Empfängerprüfung (tasks.ts:477-485) — GroupMember findAll(requester) + findOne(groupId IN, userId=recipient); wandert in die Read-Scopes.
- Harness-Kommentar aus `–.ai-memory/issue-1250-harness.md` erstellt (stand=2026-09-06T11:01:28Z); Landing verifiziert: 5 Marker je 1×, Labels ["bug","ai:needs-spec","ai:analysed"].

## Relevante Stellen
- `server/src/express/routes/tasks.ts:167-172,392` — taskReadScope + Einsatz GET /tasks; hier die Gruppen-Bindung rein.
- `server/src/express/routes/series.ts:158-160,378` — seriesReadScope + Einsatz GET /series; gleiche Änderung.
- `server/src/express/routes/tasks.ts:477-485` — Vorlage für „teilt ≥1 Gruppe"-Prüfung (GroupMember).
- `server/src/models/groupMember.ts:42` — Tabelle `group_members` (groupId, userId).
- `server/src/express/tasks-created-by.test.ts` (#1213) + `server/src/express/series-created-by.test.ts` (#1222) — Test-Erweiterung TF1-TF6; Infrastruktur (Gruppe, 2 Mitglieder, fremd angelegte Task/Serie) existiert dort.

## Annahmen
- Abfragezeit-Bindung deckt alle Szenarien ab (Austritt, Admin-Entfernung, Gruppenlöschung, Wiedereintritt) → KEINE Änderung an `groups.ts` nötig (Issue nennt die DELETE-Endpunkte nur als Auslöser).
- `groups.ts`-Mitgliedschaftszeilen sind bei allen Exit-Wegen physisch weg (verifiziert destroy-Aufrufe) — Read-Scope prüft nur gegen `group_members`-Ist-Zustand.
- Routing-Tabelle (ux nein/-/-, spec ja/sonnet/medium, impl ja/sonnet/high, review ja/sonnet/high) folgt Präzedenz #1083/#1098 (Backend-Security).

## Verworfen
- Titeländerung („Lesezugriff des Erstellers bleibt nach dem Gruppenaustritt bestehen") — trifft exakt; kein Edit.
- Nullen von `createdById` beim Austritt — vom Issue-Autor explizit verworfen (zerstört „Erstellt von", nicht reversibel).
- UX-Phase — kein UI, reines Server-Verhalten.
- MEMORY.md-Eintrag — kein neuer Fehler/Werkzeug-Eigenheit; Kriterium nicht erfüllt.

## Offen
- `.ai-memory/issue-1250-harness.md` ist Wegwerf-Artefakt (gesendeter Kommentar-Stand) — NICHT committen; nur diese Datei hier ist die Phasen-Notiz.

## Nächster Schritt
- Spec-Phase (Label `ai:needs-spec` gesetzt): rote API-Tests TF1-TF6 in `tasks-created-by.test.ts` + `series-created-by.test.ts` (Mitgliedschafts-Exit-/Rejoin-/Multi-Gruppen-Szenarien gegen aktuellen Code → rot).

## Fallstricke
- Read-Scope-Erweiterung darf Pass-Through (`userId === undefined` → `{}`) und `requesterId === null` (`{ userId }`) nicht verändern (Dev/E2E hängen daran).
- Eigentümer == Ersteller (userId == createdById) läuft über den userId-Zweig — darf durch die Gruppen-Bedingung nicht berührt werden.
- `Op.in` mit leerer Gruppenliste (requester in keiner Gruppe) → Sequelize liefert `IN (NULL)`/leer, Task muss trotzdem weg sein; leere Liste explizit testen.
- `/tasks/nearby` (ownerScope, tasks.ts:423) und alle Schreibrouten NICHT anfassen — #1213/#1222 haben sie bewusst owner-only gelassen.

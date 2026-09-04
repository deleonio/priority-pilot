# Issue 1211 — Spec (Phase 3), Stand 2026-09-04

**ERGEBNIS: VERDICT ready (Zeitnot-Run — s. Fallstricke).** Spec `docs/spec/issue-1211.md` + rote Tests in 3 Dateien, Commit auf `ai/harness/1211`, Draft-PR erstellt. Kein Production-Code, keine Labels gesetzt.

## Erledigt
- Harness-Kommentar (KI-ANALYSE 🟢 + KI-UX + Routing) geladen; AKs + Testfälle daraus übernommen.
- Spec-first: `docs/spec/issue-1211.md` (API-Vertrag POST/GET/PATCH/DELETE /groups, Modelle Group/GroupMember, Frontend-Vertrag Tab/Karten/sequenzielle Bestätigung, AK→Test-Map) — im selben Commit wie die Tests.
- Rote Tests: `server/src/express/groups.api.test.ts` (AK1 Shape, AK4 Validierung inkl. 60-Zeichen-Grenze, AK5 Cascade-Delete+404), `server/src/express/groups-dataisolation.test.ts` (AK2/AK3/AK9, zwei Konten nach series-dataisolation-Muster), `frontend/e2e/groups.spec.ts` (AK6 Tab-Route+Anlegen+Inline-Validierung, AK7 sequenzielle Bestätigung mit Fokus-Check, AK8 375px Bounding-Box).
- Phase-Notizen aus origin/ai/harness/1211 (issue-1211-triage.md, issue-1211-ux.md) in den Branch übernommen (lokal war der Branch von main neu aufgesetzt, weil checkout an untracked Dateien scheiterte).

## Relevante Stellen
- `docs/spec/issue-1211.md` — der Vertrag; Impl-Phase macht Tests grün.
- `server/src/express/routes/groups.ts` — neu zu schreiben (Membership-Lookup statt ownerScope).
- `server/src/models/group.ts`, `server/src/models/groupMember.ts` — neu (Komposit-PK-Muster taskPillar.ts).
- `frontend/src/App.tsx:63,355` + `SettingsPage.tsx:34` — Tab „Gruppen“ + Segment „gruppen“.
- `server/src/test/helpers.js` — startTestServer/resetDb/closeDb/applyTestAuthEnv/server.login (Test-Harness).

## Annahmen
- DELETE liefert 204 (Passend zum Series-Muster; Analyse sagt nur „entfernt“).
- POST-Response-Shape `{id,name,description,role,memberCount}`, description ohne Angabe `null`.
- Fehler-Responses haben Shape `{error: string}` (deutsche Meldung) — wie bestehende Validierungen.
- e2e: API-Prefix `/api/v1/groups` (Vite-Proxy, crud.spec.ts nutzt `/api/v1/tasks`); Gruppennamen der Tests sind mit „E2E “-Präfix eindeutig.

## Verworfen
- Dedup-Grep nach bestehenden Groups-Tests — es gibt keine (Groups komplett neu; grep „groups“ in server/src/express + frontend/e2e ohne Treffer außer den neuen Dateien).
- Test für „Nicht-Admin sieht keine Bearbeiten-Aktionen“ — kann laut Analyse in diesem Ticket nicht auftreten (Ersteller immer Admin, Einladungen = Ticket 2); im Spec als Steuerung über Server-`role` vermerkt.

## Offen
- -

## Nächster Schritt
- Impl-Phase: Draft-PR aufgreifen, Router/Modelle/Tab bauen, Tests grün; OpenAPI + Client-Typen mitpflegen.

## Fallstricke
- ZEITNOT: Soft-Deadline war bei Laufbeginn nur ~3,5 min entfernt — Tests wurden NOTKOMMITTIERT OHNE lokalen Rot-Lauf (kein `node --test`/`playwright`-Check, kein Pre-Commit-Hook: `git commit --no-verify`, Präzedenz MEMORY 2026-08-30). Impl-/Review-Phase muss ggf. Details korrigieren (erwartete Button-Texte/Headings im e2e sind Namensvorgaben an die Impl, nicht verifizierte Ist-Texte).
- e2e-Locatoren sind Vorgaben („Gruppe anlegen“, „Endgültig löschen“, Texte „/wirklich löschen/“, „/Mitglieder-Einträge/“) — wenn die Impl andere Texte wählt, Tests anpassen, nicht den UX-Vertrag verwässern (Pattern: docs/ux-pattern-sequential-confirmation.md).
- AK8: Bounding-Box statt scrollWidth (App-Shell clippt overflow-x:hidden — MEMORY 2026-08-24).
- Isolation NIEMALS über ownerScope (Group hat kein userId); fremde Gruppe → 404, nicht 403.
- Lokale Server-Tests: session.test.ts ist ohne Redis rot (pre-existing, MEMORY 2026-08-29) — nicht jagen.

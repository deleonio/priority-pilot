# Issue 1221 — Triage (Phase 1), Stand 2026-09-05

**ERGEBNIS: VERDICT analyzed, Ampel 🟢.** Initial-Triage (kein Harness-Kommentar; einziger Kommentar = github-actions-Qualitätscheck 2026-09-04T17:21:46Z, keine Entscheidungen). Analyse-Block + Routing-Tabelle in neuen Harness-Kommentar geschrieben, Labels `ai:needs-analyse` entfernt, `ai:analysed` + `ai:needs-ux-ui` gesetzt. Kein Ping, Titel unangetastet („Rolle eines Gruppenmitglieds ändern" — korrekt), kein Body-Edit, kein Split, kein Auto-Close (PATCH-Route existiert nicht).

## Erledigt
- Trigger geprüft: Initial-Triage; kompletten Body analysiert (AK-Messgrößen 1–8 bereits vom Autor vorgegeben).
- Code-Recherche: `server/src/express/routes/groups.ts` (DELETE members :439, inline letzte-Admin-Prüfung :462–468, `findMembership` :55, Admin-Gate-Muster :277/:311), `server/src/models/groupMember.ts` (role 'admin'|'member' — #1212 gemergt, Issue CLOSED), `frontend/src/components/GroupDetail.tsx` (Mitgliederliste :104–124, ownRole-Gate :114, `roleLabel` :9), `openapi.yml:1316` (`/groups/{id}/members/{userId}` hat NUR delete/removeGroupMember — PATCH fehlt), `frontend/src/api.ts` (API-Wrapper).
- Harness-Kommentar via `gh issue comment 1221 --body-file` erstellt (`/tmp/issue-1221-harness.md`); Landing verifiziert: alle 5 Marker je 1×, Labels `ai:needs-ux-ui` + `ai:analysed`, kein `ai:needs-analyse` mehr.

## Relevante Stellen
- `server/src/express/routes/groups.ts:439–471` — DELETE members: Berechtigungs-Kaskade 401→404→403→409 als Vorlage für PATCH; :462–468 inline `adminCount <= 1`-Prüfung + 409-Meldung „Die Gruppe braucht mindestens einen Administrator — ernenne zuerst eine andere Person." → in gemeinsame Prüffunktion extrahieren (AK6).
- `server/src/models/groupMember.ts` — role-Spalte, zusammengesetzter PK (groupId+userId).
- `openapi.yml:1316–1357` — Pfad um `patch` (operationId z.B. `updateGroupMemberRole`) erweitern; `frontend/src/api.ts` Wrapper mitpflegen.
- `frontend/src/components/GroupDetail.tsx:9,104–124` — `roleLabel` + Mitgliederliste; Umschalter (AK7) neben bestehendes ownRole-Gate (:114) neben KolBadge (:113).
- Tests: `server/src/express/groups.api.test.ts` (TF1–TF6), letzte-Admin-Präzedenz `groups-invitations.api.test.ts:261` (AK10 aus #1212), `frontend/src/components/GroupDetail.test.tsx` (TF7), `frontend/e2e/groups.spec.ts` (TF8).

## Annahmen
- #1212 vollständig gemergt (Model + Rollen + UI vorhanden, verifiziert am Code; Issue 1212 CLOSED).
- AK6 generalisiert als „Rückstufung, die die Gruppe ohne Administrator lassen würde" (Issue-Formulierung „letzter Administrator stuft sich nicht selbst zurück" ist der Spezialfall; Deckungsgleichheit mit DELETE-Logik `target.role === 'admin' && adminCount <= 1`).
- 409-Meldung im PATCH wortgleich der DELETE-Meldung (gemeinsame Funktion) — naheliegend, nicht vom Issue erzwungen.
- Routing sonnet (impl high, review medium, ux/spec medium) — einfache, isolierte Änderung (Issue-Komplexität „Einfach"); Präzedenz #1083.

## Verworfen
- Split — ein zusammenhängender AK-Satz, ein PR (Server+Frontend, Präzedenz #1083/#1098).
- Titel-/Body-Änderung — Issue präzise formuliert; Body-Edit verboten (ADR 0009).
- UX-Skip — Umschalter ist UI-Relief (Mobile-375px-AK vorhanden) → ux ja.
- MEMORY.md-Eintrag — kein neuer Fehler, Kriterium nicht erfüllt.

## Offen
- -

## Nächster Schritt
- UX-Phase (Label `ai:needs-ux-ui` gesetzt): Umschalter in der Mitgliederliste designen (AK7/AK8), danach Spec/Impl gemäß Routing-Tabelle.

## Fallstricke
- Gemeinsame letzte-Admin-Prüffunktion für PATCH UND DELETE nutzen — keine Kopie (explizite Issue-Forderung, AK6); DELETE-Verhalten + bestehende AK10-Tests (groups-invitations.api.test.ts:261) dürfen nicht rot werden.
- Validierungs-Reihenfolge wie DELETE: 401 → 404 (fremde Gruppe) → 403 (kein Admin) → 400 (Rollenwert) → 409 (letzter Admin). Issue misst 404 für Nicht-Mitglieder und 403 für Nicht-Admin-Mitglieder — `findMembership` liefert 404 zuerst.
- Eigene Rückstufung des letzten Admins = wichtigster 409-Fall; bei 2 Admins muss Rückstufung des anderen erlaubt sein (200).
- openapi patch + `frontend/src/api.ts` Wrapper + `client`-Typen synchron halten (Muster aus #1098-Randbedingung).
- 375-px-e2e: `scrollWidth <= innerWidth` auf dem Listen-Container, nicht window-weit scopen (KolTabs/Grid-Fallen aus MEMORY 2026-08-29/09-04 greifen hier nicht direkt, aber scoping bleibt Regel).

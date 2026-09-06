# Issue 1249 — Spec (Phase 3), Stand 2026-09-06

## Erledigt
- Rote API-Tests `server/src/express/pillar-ownership.test.ts` geschrieben und ROT verifiziert
  (AK1–AK4/AK6; alle 4 failen an der Status-Assertion: AK1 201≠400, AK2 400≠201, AK3 201≠400,
  AK4 200≠400; Lauf: `NODE_ENV=test npx tsx --test src/express/pillar-ownership.test.ts` im `server`-Verzeichnis).
- `server/src/logics/pillarContributions.test.ts` für AK5 angepasst: JEDER `arePillarsExistent`-Aufruf
  übergibt jetzt das Konto; Seed mit `User.create` (Achtung `passwordHash: '__test__'` Pflicht!) und
  nutzer-eigenen Pillars; neuer Test „Säule eines FREMDEN Kontos zählt nicht". Datei bleibt GRÜN
  (18 pass) — AK5 ist Compile-time-Eigenschaft, läuft über `tsc --noEmit` in den Gates.
- Spec `docs/spec/issue-1249.md` erstellt; Commit + Draft-PR (gleicher Commit).
- Dedup geprüft: keine bestehenden Tests decken Säulen-Eigentum bei Empfänger-Anlage ab
  (`groups-tasks.api.test.ts` = GET-Liste, `tasks-created-by.test.ts` = #1213 ohne pillars).

## Relevante Stellen
- `server/src/express/routes/tasks.ts:454` — POST /tasks prüft pillars gegen ERSTELLER (Bug, AK1/AK2); :492 Anlage mit Empfänger.
- `server/src/express/routes/series.ts:395` (POST, ohne Kontobezug), `:499` (PATCH, ohne Kontobezug) — AK3/AK4-Ziele.
- `server/src/logics/pillarContributions.ts:70` — `arePillarsExistent(pillarIds, userId?)` optionaler Fallback → AK5 Pflichtparameter.
- `server/src/express/pillar-ownership.test.ts` — neue Test-Datei, Seed-Muster `groups-tasks.api.test.ts` (server.login + Group/GroupMember + je Konto gleichnamige Pillar).
- Series-POST-Validierung verlangt `priority` UND `estimatedEffort` (sonst 400 aus falschem Grund — Fallstricke!).

## Annahmen
- AK5 ohne Laufzeit-Rot-Test (nicht testbar ohne Produktivcode-Änderung); Abdeckung über tsc-Gate, in Spec + PR-Body dokumentiert.
- AK7 (read-only SQL-Nachweis) ist Impl-/Review-Aufgabe, kein Spec-Test; im PR-Body als Hinweis für Phase 4.

## Verworfen
- Eigener Test für „Aufruf ohne Konto ist nicht kompilierbar" — geht nur als Compile-Fehler, nicht als Laufzeit-Test.

## Offen
- -

## Nächster Schritt
- Impl-Phase: Routen gegen Eigentümer-Konto prüfen (Empfänger vor Ersteller), `arePillarsExistent`-userId Pflichtparameter, AK7-SQL im PR dokumentieren.

## Fallstricke
- `Series`-POST-Body braucht `title`, `rhythm`, `priority`, `estimatedEffort`, `startDate` — sonst 400 aus Validierungs-, nicht aus Säulen-Grund (Test wäre grün aus falschem Grund).
- `User.create` ohne `passwordHash` → SequelizeValidationError (notNull).
- Direkter Test-Lauf braucht `NODE_ENV=test` (sonst 401, weil /auth/test-login nicht registriert).
- 403-Empfängerprüfung bleibt VOR der Säulen-Prüfung (Reihenfolge nicht ändern).
- `PATCH /tasks/{id}` korrekt und unangetastet lassen.

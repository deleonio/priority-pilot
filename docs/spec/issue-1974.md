# Spec #1974 — Duo: gemeinsamer Streak, nur Säulenwerte sichtbar

**Ziel:** Zwei Nutzer bilden per Einladung ein Duo (Gruppe mit `kind='duo'`), sehen einen gemeinsamen Streak und gegenseitig nur Säulenwerte.

## Vorbedingung

Zwei angemeldete Nutzer, Plan-Feature `groups` verfügbar.

## Schritte / erwartetes Ergebnis

1. `POST /groups` mit `kind: 'duo'` → 201, `GroupDto.kind === 'duo'`; ohne `kind` → `'group'`; ungültiger `kind` → 400 (AK1).
2. Ein Duo hat höchstens zwei Mitglieder: Einladung annehmen, Einladungslink einlösen oder neue Einladung bei vollem Duo → 409, keine dritte Mitgliedschaft (AK2).
3. `GET /groups/:id/duo` → `{ streak: { aktuell, best }, members: [{ userId, name, saeulen: [{ pillarId, name, wert }] }] }`. Streak = `berechneStreak` über die Schnittmenge der aktiven Tage beider Mitglieder; `berechneDuoStreak(zeitpunkteA, zeitpunkteB, heute, zeitZone)` in `server/src/logics/duoStreak.ts` (AK3).
4. Je Mitglied nur Säulenwerte, keine Task-Felder (AK4).
5. Freigabe von Aufgaben (`POST /tasks` mit `groupId` eines Duos) → 400; `GET /groups/:id/tasks` eines Duos → `[]` (AK5).
6. Nicht-Mitglied oder `kind='group'` auf `GET /groups/:id/duo` → 404 (AK6).

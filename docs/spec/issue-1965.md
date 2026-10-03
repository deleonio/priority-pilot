# Meilenstein-Stände bleiben erhalten (sticky, #1965)

**Stand:** 2026-10-04

## Ziel

Ein einmal erreichter Meilenstein (Streak- oder Punkte-Stufe, #1362) verschwindet nicht mehr, wenn
die zugrunde liegende Aufgabe wieder geöffnet wird und die Punkte-/Erledigungsdaten unter die
Schwelle fallen. Der erreichte Zustand wird pro Nutzer gespeichert und bei der Berechnung
zusammengeführt — nach dem Muster der unverfallbaren Streak-Stufen (Prüfung gegen `bestStreak`).

## Voraussetzungen

- `berechneMeilensteine({ bestStreak, punkteSumme })` bleibt eine reine Funktion; Punkte-/Streak-Berechnung unverändert.
- Neu: Tabelle `milestone_reached` (userId, schluessel, zeitpunkt; unique(userId, schluessel)) nach dem Muster der eigenständigen Nutzer-Tabellen (`api_tokens`, `push_subscriptions`).
- Ein gemeinsamer Helper berechnet den Stand wie bisher und merged die gespeicherten Schlüssel als `erreicht: true` dazu; neu erreichte Stufen werden beim Lesen idempotent persistiert (`findOrCreate`-Muster `awardScoreOnDone`).
- Der Helper wird an allen drei Lesestellen verwendet: `GET /scores/milestones`, `GET /scores/balance` (meilensteine-Filter) und `meilensteinStandVon` (PATCH `/tasks/:id`, #1363). Dadurch wird Bestand beim ersten Lesen rückwirkend persistiert (#1362-Muster) — keine Migration.

## Verhalten

- **AK1 — Sticky über Reopen:** Task erledigt (Punktesumme ≥ Schwelle) → `GET /scores/milestones` zeigt die Stufe `erreicht: true`. Wiedereröffnen der Aufgabe (`PATCH /tasks/:id { status: 'Open' }`) entfernt den `ScoreEntry` (#228) und senkt die Punktesumme — die Stufe bleibt `erreicht: true`. Gilt für Punkte- und (bereits über `bestStreak` unverfallbare) Streak-Stufen.
- **AK2 — Reopen-Verhalten #228 unverändert:** `GET /scores` listet den Eintrag nicht mehr, die Punktesumme fällt korrekt (bereits durch `tasks-reopen-score.test.ts` AK-5.1/5.2 abgedeckt — hier kein Duplikat-Test).
- **AK3 — Alle Lesestellen sticky + idempotent:** `GET /scores/milestones` und `GET /scores/balance` (meilensteine-Filter) zeigen nach dem Reopen keinen erloschenen Zustand; ein zweiter Leselauf ändert nichts (Idempotenz der Rückwirkungs-Persistierung).
- **AK4 — Push höchstens einmal je Schwelle:** Der Meilenstein-Push (#1363) feuert je Schwelle höchstens einmal — auch nicht erneut, wenn dieselbe Schwelle nach Reopen + erneutem Done wieder erreicht wird (Dedupe weiter über `NotificationLog`, `dedupeKey = <userId>:<schluessel>`).
- **AK5 — DSGVO:** Die Kontolöschung (`DELETE /auth/me`) entfernt alle `milestone_reached`-Zeilen des Nutzers.

## Randbedingungen

- DTO `MilestoneDto` unverändert; nur der Wert von `erreicht` bleibt stabil `true`.
- Bestehende Tests `scores-milestones`, `tasks-reopen-score`, `tasks-milestone-push`, `scores-balance` bleiben grün.

## Erwartetes Ergebnis

- Reopen senkt Punkte und Score-Einträge sichtbar, aber kein einmal erreichter Meilenstein verschwindet aus Anzeige und Balance-Endpoint.
- Der Meilenstein-Push bleibt auf genau eine Meldung je Schwelle begrenzt.
- Kontolöschung räumt die neue Tabelle mit.

## Testabdeckung (rote Spec-Tests)

| AK                     | Test                                                                                | Datei                                             |
| ---------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------- |
| AK1 (+ AK3-Idempotenz) | Punkte-Stufe bleibt nach Reopen erreicht; zweiter Leselauf identisch                | `server/src/express/scores-milestones.test.ts`    |
| AK3                    | Balance-Filter zeigt die Stufe nach Reopen weiterhin; zweiter Leselauf identisch    | `server/src/express/scores-balance.test.ts`       |
| AK4                    | Done → Reopen → Done: genau ein Versand und ein NotificationLog-Eintrag je Schwelle | `server/src/express/tasks-milestone-push.test.ts` |
| AK5                    | Nach Kontolöschung 0 `milestone_reached`-Zeilen                                     | `server/src/express/delete-account.test.ts`       |

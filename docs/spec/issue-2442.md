# Spec #2442 — Prüfkonto startet bei jedem Login im Ersteinstieg

Ziel: Jeder erfolgreiche Login über `POST /auth/review-login` (Vorgabe: #2426) liefert ein frisches
Konto, damit Play-Prüfer immer den Ersteinstieg sehen.

## Server

Nach erfolgreicher Passwortprüfung wird ein bestehendes Konto mit der Prüf-E-Mail per `deleteAccount`
entfernt, danach legt `upsertOAuthUser` es neu an (neue Id, Standard-Säulen) und `plan='pro'` wird gesetzt.

| Schritt                                    | Erwartung                                                                                               |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Login, Aufgabe anlegen, erneuter Login     | Aufgabenliste der neuen Sitzung leer (AK1)                                                              |
| Zustimmung erteilt, erneuter Login         | `/auth/me`: `termsAccepted: false`, andere `id` als zuvor; Onboarding-Merker (je Id) greift nicht (AK2) |
| Jeder erfolgreiche Login                   | `plan: 'pro'` (AK3)                                                                                     |
| Login, während ein zweites Konto Daten hat | Daten des zweiten Kontos unverändert (nur die Prüf-E-Mail wird gelöscht) (AK4)                          |
| Falsches Passwort (401)                    | Prüfkonto und seine Daten bleiben bestehen; Löschung erst nach Passwortprüfung (AK5)                    |
| `deleteAccount` liefert nicht `deleted`    | Fehlerantwort statt stiller Wiederverwendung des Altkontos                                              |

Eine parallel angemeldete Prüf-Sitzung darf dabei enden. Frontend unverändert.

## Doku (AK6)

`docs/auth-setup.md`, Abschnitt Prüfzugang: Reset bei jedem Login, parallele Sitzung kann enden. Kein Test (Markdown, ADR 0001).

# Spec #2426 — Prüfzugang für Google Play (versteckter Passwort-Login)

Ziel: Play-Prüfer kommen ohne Google-Konto in die App. Ein verstecktes Passwort-Feld hinter einer
Logo-Geste meldet ein festes Pro-Prüfkonto an. Normale Logins bleiben unverändert.

## Server

**Config:** `PLAY_REVIEW_PASSWORD` (leer/fehlend = Prüfzugang aus), `PLAY_REVIEW_EMAIL` (optional, fester Default).
Wird bei jeder Anfrage gelesen (Passwortwechsel = Env ändern + Neustart).

| Schritt                                      | Erwartung                                                                                                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /auth/providers`                        | `reviewAccess: true` genau dann, wenn `PLAY_REVIEW_PASSWORD` nicht leer ist (AK1)                                                     |
| `POST /auth/review-login {password}` korrekt | 200, Session, Prüfkonto per findOrCreate, `plan='pro'` bei jedem Login; `/auth/me` zeigt `plan: 'pro'`; kein zweites Konto (AK2, AK3) |
| falsch / leer / Zugang aus                   | 401, keine Session, auch für das zuvor gültige Passwort (AK4)                                                                         |
| 5 Fehlversuche (je IP, 15 min)               | weiteres Passwort, auch korrekt → 429; Erfolge zählen nicht; greift auch außerhalb production (AK5)                                   |

Vergleich per `timingSafeEqual`; Passwort nie loggen oder ausliefern.

## Frontend (Login-Seite)

| Schritt                                             | Erwartung                                                                      |
| --------------------------------------------------- | ------------------------------------------------------------------------------ |
| Login-Seite ohne Geste                              | kein Passwortfeld (AK6)                                                        |
| 7 Taps auf die Logo-Wortmarke, `reviewAccess: true` | Dialog mit genau einem Passwortfeld und Button „Anmelden" (AK6)                |
| 6 Taps oder `reviewAccess: false`                   | nichts öffnet sich (AK6)                                                       |
| Korrektes Passwort                                  | Login wie gewohnt, Dashboard sichtbar (AK7)                                    |
| Falsches Passwort                                   | Fehlermeldung (`role="alert"`) im Dialog (AK7)                                 |
| 375 px                                              | Dialog vollständig sichtbar, Feld und Button ≥ 44 px hoch, kein Überlauf (AK8) |

API-Client: `api.reviewLogin(password)` (POST `/auth/review-login`, wirft bei Nicht-2xx).

## Doku (AK9)

`docs/auth-setup.md`: Env-Variablen, Ein/Aus, Passwortwechsel, Play-Console-Schritte, englischer
Hinweistext ≤ 500 Zeichen. Kein Test (Markdown, ADR 0001).

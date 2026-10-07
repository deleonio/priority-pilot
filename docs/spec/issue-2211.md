# Spec #2211 — Kalender per CalDAV (lesend, App-Passwort)

Teil von #1973, baut auf #2209 (ICS) auf. Tests: `server/src/logics/secret-crypto.test.ts`,
`server/src/logics/calendar-caldav.test.ts`, `server/src/express/calendar-caldav.test.ts`,
`frontend/src/components/CalendarSourcesSection.test.tsx`.

## Vertrag

**Verschlüsselung** `server/src/logics/secret-crypto.ts` (AES-256-GCM, Schlüssel aus Env `CALDAV_ENCRYPTION_KEY`,
beliebiger nichtleerer String, wird zum 32-Byte-Schlüssel abgeleitet; Env wird bei jedem Aufruf gelesen)

- `isSecretKeyConfigured(): boolean`
- `encryptSecret(plain: string): string` — Chiffrat enthält den Klartext nicht, zufälliger IV (zweimal verschlüsseln → verschieden); ohne Schlüssel `throw`.
- `decryptSecret(cipher: string): string` — mit falschem Schlüssel `throw`.

**CalDAV-Abruf** `server/src/logics/calendar-caldav.ts`

- `fetchCaldavEvents(url, username, password, now, fetchImpl?): Promise<ParsedEvent[]>` — Methoden ausschließlich `PROPFIND`/`REPORT`/`GET`
  (AK3), HTTP Basic, derselbe Netz-Guard und dieselben Grenzen wie `fetchIcs` (interne Adresse → Fehler, keine Redirects);
  Ergebnis wie `parseIcsEvents` (Fenster heute 00:00 UTC bis +14 Tage, AK1).

**Modell** `CalendarSource`: neue Attribute `type` (`'ics' | 'caldav'`, Standard `'ics'`), `username` (nullable),
`passwordEncrypted` (nullable, nur Chiffrat, AK2).

**API**

| Aufruf                         | Verhalten                                                                                                                                                                                                                                                                     |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /calendar-sources`       | Body zusätzlich `{ type: 'caldav', username, password }`. Ohne `type` = ICS wie bisher. CalDAV ohne Schlüssel → 400 `{ message }` (nennt CalDAV), nichts wird angelegt/abgerufen (AK5). Paketgrenze zählt alle Quellen (AK6). 201 `{ id, name, type }`, nie Adresse/Passwort. |
| `GET /calendar-sources`        | `[{ id, name, type }]` — nie Adresse, Benutzername oder Passwort (AK2).                                                                                                                                                                                                       |
| `DELETE /calendar-sources/:id` | löscht Quelle (samt Zugangsdaten) und Termine (AK4).                                                                                                                                                                                                                          |

`runCalendarSync` verzweigt nach `type`: CalDAV entschlüsselt das Passwort und ruft `fetchCaldavEvents`.

**Oberfläche** (Einstellungen → Kalender, AK7): Typ-Wahl ICS (Standard) / CalDAV (Select oder Radio, Option „CalDAV").
Bei CalDAV zusätzlich Felder „Benutzername" und „Passwort" (`KolInputPassword`, maskiert). ICS-Aufruf bleibt
`createCalendarSource({ url, name? })`; CalDAV: `{ type: 'caldav', url, username, password, name? }`. Passwort-State wird nach
dem Anlegen geleert, nirgends im DOM sichtbar. Liste zeigt bei CalDAV-Quellen den Hinweis „CalDAV".

## Nicht Teil der Spec-Tests

AK7 E2E bei 375 px braucht `CALDAV_ENCRYPTION_KEY` in `frontend/playwright.config.ts` (Konfiguration → Implementierung); siehe PR „Offene Fragen".

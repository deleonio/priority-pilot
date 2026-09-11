# Spec: Token-Verwaltung mit Pflicht-Ablaufdatum (max. 12 Monate) (#1357)

Status: rot (Spec-Phase) — Tests in `server/src/express/api-tokens.test.ts`,
`server/src/express/api-token-auth.test.ts`, `frontend/src/components/ApiTokensSection.test.tsx`,
`frontend/e2e/issue-1357-token-expiry.spec.ts`.

Aufbauend auf #1352 (Token-Verwaltung, Bearer-Auth) und #1356 (Rechtestufe) — beide gemergt. Neu ist
ausschließlich ein Pflicht-Ablaufdatum je Token. Quelle der Akzeptanzkriterien: KI-ANALYSE-Block im
Harness-Marker-Kommentar von #1357.

## Datenmodell (Vertrag)

- `ApiToken` (`server/src/models/apiToken.ts`) erhält ein nullable Feld `expiresAt` (Bestandsschutz:
  bereits existierende Tokens ohne Ablaufdatum bleiben gültig, AK3).
- Feste Laufzeiten beim Anlegen: 30 / 90 / 180 / 365 Tage — 365 Tage ist die Höchstlaufzeit (12
  Monate); ohne Auswahl kein Token (AK1, AK2).

## API-Vertrag (Router `server/src/express/routes/apiTokens.ts`)

| Route              | Verhalten                                                                                                                                                                                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api-tokens` | Body braucht Pflichtfeld `expiresInDays` aus der Whitelist `30 \| 90 \| 180 \| 365`. Fehlt es oder liegt außerhalb der Whitelist → 400, kein Token wird angelegt (AK1). Bei gültigem Wert wird `expiresAt` aus `expiresInDays` berechnet und in der Antwort mitgeliefert (AK2). |
| `GET /api-tokens`  | Liefert `expiresAt` (ISO-8601) je Token; `null` ausschließlich für Bestandstokens ohne Migration (AK3).                                                                                                                                                                         |

## Auth-Vertrag (`server/src/express/apiTokenAuth.ts`)

- Ein Bearer-Request, dessen Token-`expiresAt` in der Vergangenheit liegt, wird auf einer
  geschützten Route mit 401 abgewiesen — exakt wie bei gesetztem `revokedAt` (Soft-Fail: Session
  verwerfen, `next()`, `requireAuth` weist ab). `lastUsedAt` wird dabei NICHT aktualisiert (AK4).
- Derselbe Token vor seinem Ablaufdatum liefert auf derselben Route unverändert 200 (AK5).
- Öffentliche Routen (`/health`, `/auth/*`) bleiben mit einem abgelaufenen Bearer-Header erreichbar
  (bestehendes Verhalten, unverändert — kein Kurzschluss auf 401 in der Middleware selbst).

## Frontend-Vertrag (`frontend/src/components/ApiTokensSection.tsx`)

- Neben dem Namensfeld steht eine Pflichtauswahl der Laufzeit (30/90/180/365 Tage) ohne Vorauswahl.
  „Token erzeugen" ist wirkungslos (kein `api.createApiToken`-Aufruf), solange keine Laufzeit gewählt
  ist; nach Auswahl legt der Klick den Token mit der gewählten Laufzeit an (AK6).
- Jede Token-Zeile zeigt das Ablaufdatum im Format TT.MM.JJJJ; liegt es in der Vergangenheit, steht
  zusätzlich der Text „abgelaufen" in der Zeile — Farbe allein reicht nicht (AK7).
- Bei 375px Viewportbreite bleiben Laufzeit-Auswahl, „Token erzeugen" und die Ablaufdatum-Angabe ohne
  horizontales Scrollen bedien-/lesbar (AK8).
- `openapi.yml` beschreibt `expiresAt` im Schema `ApiToken` und `expiresInDays` in `ApiTokenInput`
  (treibt den generierten Client) — kein eigener Test, ein Schema-Textabgleich wäre ohne Zähne
  (ADR 0001, Präzedenz #1356 AK10). Die Spec-Tests referenzieren die neuen Felder daher über lokal
  definierte Response-Typen statt über den generierten `ApiToken`-Typ.

## Akzeptanzkriterien → Tests

- AK1, AK2, AK3 (Server-Anteil) → `server/src/express/api-tokens.test.ts`: POST ohne/mit
  ungültigem `expiresInDays` → 400, keine Zeile angelegt; POST mit 365 → 201 und `expiresAt` ~365
  Tage in der Zukunft (Tagesgenauigkeit); POST mit 400 Tagen → 400; GET liefert `expiresAt`.
- AK4, AK5 → `server/src/express/api-token-auth.test.ts`: Bearer-Token mit `expiresAt` in der
  Vergangenheit → 401 auf geschützter Route, `lastUsedAt` bleibt `null`; Token mit `expiresAt` in der
  Zukunft → 200.
- AK6, AK7 → `frontend/src/components/ApiTokensSection.test.tsx` (neu): Klick auf „Token erzeugen"
  ohne Laufzeitwahl ruft `api.createApiToken` nicht auf; nach Auswahl schon; Liste rendert das
  formatierte Ablaufdatum und die Kennzeichnung „abgelaufen" für ein Datum in der Vergangenheit.
- AK8 → `frontend/e2e/issue-1357-token-expiry.spec.ts` (neu, Stil `issue-1352-api-tokens.spec.ts`):
  Session per `POST /auth/test-login`, Token mit Laufzeit anlegen, Ablaufdatum in der Liste sichtbar,
  Bounding-Box-Prüfung bei 375px.
- Regression (#1352, #1356) → bestehende Tests in `api-tokens.test.ts`/`api-token-auth.test.ts`/
  `ApiTokensSection.test.tsx`/`issue-1352-api-tokens.spec.ts`/`issue-1356-token-scope.spec.ts`
  bleiben unverändert grün (Aufrufe ohne `expiresInDays` dort werden auf einen gültigen Wert
  ergänzt — Test-Pflege, s. PR-Body).

## Scope-Grenzen

- Kein Verlängern/Erneuern eines bestehenden Tokens (Laufzeit steht bei Anlage fest) — nicht
  gefordert.
- Kein Hintergrund-Job, der abgelaufene Zeilen löscht — Ablauf wird ausschließlich beim Zugriff
  geprüft (AK4/AK5), analog zu `revokedAt`.

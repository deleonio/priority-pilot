# Spec: Persönliche API-Tokens für externe Clients (#1352)

Status: rot (Spec-Phase) — Tests in `server/src/express/api-tokens.test.ts`,
`server/src/express/api-token-auth.test.ts`, `frontend/src/components/SettingsPage.test.tsx`,
`frontend/e2e/issue-1352-api-tokens.spec.ts`.

## Ziel

Angemeldete Nutzer erzeugen in den Einstellungen einen Bearer-Token für externe Clients (z. B.
Skripte, Automatisierungen). Der Klartext ist genau einmal nach dem Erzeugen sichtbar; die
Datenbank speichert nur einen Hash. Ein gültiger Bearer-Token verhält sich für jeden geschützten
Endpunkt exakt wie die Session des Token-Besitzers (Datenisolation, Rollenprüfung eingeschlossen);
ein zurückgezogener oder fehlender Token liefert 401.

## Datenmodell (Vertrag)

- `ApiToken` (`server/src/models/apiToken.ts`, neu): `id`, `userId` (Pflicht, FK auf `users`),
  `name` (nicht-leerer String, ≤ 60 Zeichen), `tokenHash` (SHA-256-Hex des Klartexts, nie der
  Klartext selbst), `lastUsedAt` (nullable, Timestamp), `revokedAt` (nullable Timestamp — Soft-Delete
  statt Zeilen-Löschung, damit ein Token nach Rückzug nachvollziehbar bleibt). Muster:
  `server/src/models/pushSubscription.ts` (schlankes Pro-User-Modell).
- Der Klartext-Token selbst wird **nie** persistiert — nur beim Erzeugen einmalig zurückgegeben.
  Format: `pp_<32 Hex-Zeichen>` (Präfix erlaubt spätere Unterscheidung von anderen Secret-Arten).

## API-Vertrag (Router `server/src/express/routes/apiTokens.ts`, neu)

Hinter `requireAuth` (Session ODER Bearer-Token, s. Auth-Vertrag unten):

| Route                     | Verhalten                                                                                                                                                                                     |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api-tokens`        | Body `{name}`. 201 mit `{id, name, token, createdAt, lastUsedAt: null}` — `token` ist der Klartext, nur in dieser einen Antwort enthalten. Leerer/zu langer Name → 400 mit deutscher Meldung. |
| `GET /api-tokens`         | Liste eigener, nicht zurückgezogener Tokens: je `{id, name, createdAt, lastUsedAt}` — **nie** `token` oder `tokenHash`.                                                                       |
| `DELETE /api-tokens/{id}` | Setzt `revokedAt`; 204. Fremder Token → 404. Danach 401 bei jedem Request mit diesem Token.                                                                                                   |

## Auth-Vertrag (Bearer neben Session)

- Neue Middleware (`server/src/express/apiTokenAuth.ts`, neu), registriert **vor**
  `app.use(requireAuth)` (`server/src/express/index.ts:217`) und **vor** der CSRF-Prüfung
  (`server/src/express/index.ts:140`): liegt ein `Authorization: Bearer <token>`-Header vor, wird
  der Hash gegen `ApiToken` (nicht zurückgezogen) geprüft; bei Treffer synthetisiert die Middleware
  `req.session.user` für die Dauer des Requests (gleicher Shape wie beim Login) und aktualisiert
  `lastUsedAt`. Ungültiger/zurückgezogener Token → 401 sofort (kein Fallthrough zu Session-Auth).
  Ohne Bearer-Header bleibt die bestehende Session-Prüfung unverändert.
- `getUserId()`/`ownerScope()` (`server/src/express/requireAuth.ts:24-37`) bleiben unverändert —
  sie lesen weiterhin nur `req.session.user`, das die Bearer-Middleware befüllt. Datenisolation und
  `requireRole('admin')` (`server/src/express/routes/admin.ts`) gelten dadurch identisch für
  Bearer- und Session-Requests.
- Bearer-authentifizierte Requests sind von der CSRF-Prüfung ausgenommen (kein Cookie, kein
  Double-Submit möglich); Requests mit **beidem** (Cookie + gültigem Bearer) zählen als
  Bearer-Request und überspringen CSRF ebenfalls — sie dürfen dabei aber keine fremde Cookie-Session
  „erben": die Middleware überschreibt `req.session.user` mit dem Token-Besitzer.

## Frontend-Vertrag

- Neuer Settings-Tab „Zugriff" — als **letzter** Tab angehängt, HINTER dem bedingten Tab
  „Nutzerverwaltung" (nicht in `BASE_SETTINGS_TABS`, sondern in der `settingsTabs`-Zusammensetzung,
  `frontend/src/components/SettingsPage.tsx:103-105`), damit der bestehende Fixup-#1300-Vertrag
  „Nutzerverwaltung ist Tab-Index 6, wenn `isAdmin`" unverändert bleibt (`SettingsPage.test.tsx:648-679`).
  „Zugriff" liegt dadurch je nach `isAdmin` auf Panel `slot="tab-6"` (kein Admin-Tab) oder
  `slot="tab-7"` (mit Admin-Tab). Slug `zugriff` in `SETTINGS_PATH_SEGMENTS` (`frontend/src/App.tsx:69`).
  Panel-Container `data-testid="api-tokens-panel"`.
- „Token erzeugen" (Button, `_variant="primary"`) → Klartext erscheint inline
  (`data-testid="api-token-plaintext"`) mit Kopieren-Button; nach Reload/erneutem Laden der Liste ist
  der Klartext nicht mehr enthalten (nur Metadaten).
- Token-Liste (`data-testid="api-token-row"` je Zeile) zeigt Name + `createdAt`; „Zurückziehen“ entfernt
  die Zeile aus der Liste (sequenzielle Bestätigung, UX-Block).
- Bei 375px Viewportbreite: Panel ohne horizontalen Overflow, Klartext-Token bricht um
  (`overflow-wrap: anywhere`) statt zu scrollen (Muster: Bounding-Box-Assertion, nicht `scrollWidth`,
  MEMORY 2026-08-24).

## Akzeptanzkriterien → Tests

- AK1, AK2, AK4 → `server/src/express/api-tokens.test.ts`: Anlegen liefert Klartext einmalig, Liste/DB
  ohne Klartext bzw. Hash-only, Zurückziehen sperrt den Token (401 danach).
- AK3, AK5, AK6, AK7 → `server/src/express/api-token-auth.test.ts`: Bearer- vs. Session-Antwort
  identisch, Fremd-Daten-Isolation, Admin-Endpunkt 403 für Member-Token, 401 ohne Auth.
- AK8 → `frontend/src/components/SettingsPage.test.tsx`: Erzeugen zeigt Klartext einmalig,
  Zurückziehen entfernt die Zeile (API gemockt).
- AK8, AK9 → `frontend/e2e/issue-1352-api-tokens.spec.ts`: Klartext-Sichtbarkeit gegen echtes
  Backend, 375px-Layout ohne horizontalen Overflow.

## Scope-Grenzen

- Keine Token-Scopes/Berechtigungsstufen (nur volle Nutzer-Berechtigung wie Session) — nicht
  gefordert von den AKs.
- Kein Ablaufdatum für Tokens — nicht in den AKs verlangt, `revokedAt` deckt den Rückzug ab.

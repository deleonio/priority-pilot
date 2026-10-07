# Spec #2379 — Anmeldung, Magic Link, Logout und Push in der Android-App mit eingebauter Web-App

Server-Vertrag: #2377 (App-Token, Kanal `play`). Build-Vertrag: #2378 (`getPublicOrigin()` = `VITE_SITE_URL`).
Gilt nur, wenn ein App-Token vorliegt bzw. im Android-Build; die Website bleibt unverändert.

## Token-Ablage (`frontend/src/lib/appToken.ts`)

- `getAppToken(): string | null`, `setAppToken(token)`, `clearAppToken()` — synchron, dauerhaft (localStorage des WebView).
- Erwartet: nach Neustart (Modul neu geladen) liefert `getAppToken()` denselben Wert (AK6).

## Login (`nativeAuth.ts`, `api.ts`)

- Ziel: `startNativeGoogleLogin` öffnet `<getPublicOrigin()>/auth/google?client=app&state=…` (AK1).
- Schritte: `handleAppLink` akzeptiert nur Links mit Ursprung `getPublicOrigin()`; Pfad `/app/auth/native` (unabhängig von `BASE_URL`) mit `code` löst Code + gemerkten `state` ein.
- Erwartet: `api.exchangeNativeLoginCode` speichert `{ token }` aus der Antwort; Erfolg → `location.replace(BASE_URL)`, Fehlschlag → `login?error=native_login_failed` (AK2). Fremder Ursprung (auch `window.location.origin`, wenn er von `SITE_URL` abweicht) → verworfen (AK3).

## Magic Link

- Ein Link `<SITE_URL>/app/<rest>` wird nicht per `location.assign` auf der Domain geöffnet, sondern per `location.replace(BASE_URL + <rest>)` in der App (Query bleibt, `?magic=…`); `Root.tsx` löst ihn über `api.verifyMagicLink` ein, das `token` des `AppTokenDto` wird gespeichert (AK4).

## API-Client

- Mit App-Token trägt jede Anfrage `Authorization: Bearer <token>` (`client.use`, Logout-fetch, `/auth/me`); ohne Token fehlt der Header (AK5).

## Logout

- `api.logout` schickt das Token mit (Widerruf), löscht es danach lokal; Folgeanfragen ohne Header (AK7).

## Push-Tipp

- `listenForNativePushTaps` navigiert in der App (`history.pushState` auf `BASE_URL + Pfad` + `popstate`), ohne `location.assign`/Reload (AK8).

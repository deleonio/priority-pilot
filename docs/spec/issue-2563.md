# #2563 — Magic Link meldet dort an, wo er angefordert wurde

## Ziel

Ein Magic Link meldet den Nutzer dort an, wo er ihn angefordert hat: im Browser → Cookie-Session, in der Android-App → App-Token. Landet ein aus der App angeforderter Link im Browser, bietet die Web-App einen sichtbaren Rücksprung in die App, ohne den Einmal-Token still zu verbrauchen.

## Verträge (von den Tests gepinnt)

- **App-Marker:** Ein mit `X-Client-Channel: play` angeforderter Link trägt in der Mail `&client=app` nach dem Token (`…/app/?magic=<token>&client=app`); Browser-Anforderungen bleiben ohne Marker.
- **Rücksprung-Schema:** Die Landing-Primäraktion ist ein Link (Rolle `link`, Name „In der App öffnen“) mit `href="balamentum.app://auth/native?magic=<token>"` — der Token wird also nicht im Browser per POST eingereicht.
- **App-Zweig:** `handleAppLink` lädt Schema-URLs mit `magic`-Parameter im WebView (`BASE_URL?magic=<token>`) statt sie zu verwerfen; der Verify läuft dort über den bestehenden Kanal-Interceptor (`X-Client-Channel: play` → App-Token, #2377) — abgesichert durch den bestehenden Server-Test „AK2 … play … { token }“.
- **Ursprung-Normalisierung:** Abweichende Ursprünge der eigenen Domain (http statt https, www statt ohne www) werden in der App in den Magic-Flow geführt (WebView-Load mit `?magic=`), nicht still verworfen. Wahrhaft fremde Origins bleiben verworfen (bestehender Test „ignoriert Links auf fremde Domains“).

## Ablauf

1. Android-App fordert den Link an (`POST /auth/magic-link`, Header `X-Client-Channel: play`) → Mail-Link mit `client=app`.
2. Browser öffnet den Marker-Link: `consumeMagicLink` erkennt den Marker, ruft **kein** `POST /auth/magic-link/verify` (kein Cookie, `GET /auth/me` bleibt 401), entfernt die Parameter und zeigt die Landing mit dem Rücksprung-Link. Der stille Google-Login bleibt auf der Landing aus.
3. App fängt die Schema-URL → WebView lädt `BASE_URL?magic=<token>` → Root löst den Token per POST mit Kanal `play` ein → App-Token.
4. Ungültige Links (abgelaufen/genutzt): bestehende Meldung „Link ungültig oder abgelaufen“ in beiden Wegen (Verify 400 bzw. `error=magic_link_invalid`).

## Erwartetes Ergebnis je AK

| AK  | Test                                                                                                                                                                                    | Ort                                                                               |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| AK1 | TF1: App-Antrag → Mail-Link mit Marker; Browser-Antrag → Marker-frei (Spiegel)                                                                                                          | `server/src/express/magic-link.test.ts`                                           |
| AK2 | TF2 (Unit): Marker-Link ruft Verify nicht auf, Landing-Link mit Schema-href · TF3 (e2e): `GET /auth/me` 401, kein Verify-POST, Link sichtbar                                            | `frontend/src/Root.test.tsx`, `frontend/e2e/issue-2563-magic-app-landing.spec.ts` |
| AK3 | TF4: Schema-URL mit `magic` → WebView-Load mit `?magic=`                                                                                                                                | `frontend/src/lib/nativeAuth.test.ts`                                             |
| AK4 | TF5: http-/www-Variante der eigenen Domain → WebView-Load, nicht verworfen                                                                                                              | `frontend/src/lib/nativeAuth.test.ts`                                             |
| AK5 | dedup: Server-Seite „ein Token gilt genau einmal“ + „abgelaufener … → 400“, Browser-Meldung `LoginPage.test.tsx` (`magic_link_invalid`) — App-Weg läuft über denselben Root-Mechanismus | bestehende Tests                                                                  |
| AK6 | TF6 (Spiegel, grün): Allowlist wird auch beim Einlösen erneut geprüft                                                                                                                   | `server/src/express/magic-link.test.ts`                                           |
| AK7 | TF7 (e2e, 375 px + 320 px): Rücksprung-Link per Bounding-Box im Viewport, Touch-Target ≥ 44 px                                                                                          | `frontend/e2e/issue-2563-magic-app-landing.spec.ts`                               |

## UX-Anforderungen aus dem KI-UX-Block (verbindlich für die Umsetzung, ohne eigenen Test)

- Landing als Ein-Aufgabe-Screen im LoginPage-Look (`.login-page__*`): eigene `h1` (Name ohne „Balamentum“), kurze Kontextzeile, genau eine Primäraktion (voll breit, Touch-Target ≥ 44 px, `.login-page__btn--primary`).
- Nach dem Tap: Schaltfläche deaktivieren und Statuszeile `role="status"` („App geöffnet — Anmeldung dort abschließen“) zeigen; auf Desktop ohne App gilt die Empfehlung „Funktioniert in der Balamentum-App …“.
- Fehler (AK5) als `role="alert"` mit der bestehenden Meldung, niemals nur Toast; Farben nur über Rollen-Tokens (`--pp-brand`, `--pp-danger`), Abstände/Typo aus den `--pp-*`-Skalen.
- „Kein horizontaler Overflow“ ist per `scrollWidth` nicht messbar (App-Shell clippt) — Assertions über Bounding-Box.

## Testumfang / Dedup

- AK5 ist dedup-abgedeckt (Server-Einmaligkeit/Ablauf + Browser-Meldung); kein neuer Test.
- TF6 (AK6) ist bewusst ein grüner Spiegel: die Verify-Route prüft die Allowlist bereits erneut — der Test sichert diese Prüfung gegen die anstehende Umsetzung (#1982).
- Kein Test für die reine Optik der Statuszeile nach dem Tap (UX-Abschnitt oben trägt die Anforderung in die Umsetzung).

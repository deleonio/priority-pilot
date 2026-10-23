# Spec #2549 — Einheitlicher Fehlervertrag: Fehlerhandler und Log-Spur

## Ziel

Jeder unbehandelte Fehler einer Express-Route endet als JSON `{ message }` mit Status 500 (statt der
Express-5-HTML-Standardseite, F-22) und erzeugt genau einen Log-Eintrag (Methode, Pfad, Fehler, F-8).
Die bislang stummen 500/502-Catches loggen vor dem Senden. Alle Fehlerantworten nutzen `{ message }` —
kein `{ error }`-Body mehr im Server (F-25).

## Rahmen

- PO-Entscheidung (2026-10-14): Der globale Handler wird als **letzte Middleware in `createApp`**
  (`server/src/express/index.ts`) gemountet; er nutzt `sendError` (damit `translateMessages` greift),
  trägt nur den generischen Text im Body, Details nur ins Log. Kein Stacktrace im Body.
- Die 400-Antworten aus #2548 (`parseId`-Guards) bleiben unverändert — der globale Handler ersetzt
  sie nicht.
- Fixziel-Export: `errorHandler` in `server/src/express/http-error.ts` (zentrale Heimat des
  Fehlervertrags neben `sendError`/`handleWriteError`), Mount in `createApp` nach allen Routen.
- Abgleich mit main: #2548 (PR #2595) ist gemergt — Zeilen der Analyse neu verifiziert:
  `csrf.ts:35`; `auth.ts:267` (400) und `:276` (503); stumme Catches `index.ts:478/488/525/535`
  (`/forest`, `/graph`, `/next`, `/suggestions`), `groups.ts:150`, `publicCancellation.ts:228`;
  cancel-Handler `billingSubscriptions.ts`: `Subscription.findOne` :288 vor dem try :326.
- `discardPendingCheckout` (billingSubscriptions.ts:202) fängt Fehler intern ab und propagiert nie —
  AK5 zielt deshalb auf den DB-Await (`Subscription.findOne`, :288) vor dem try-Block des
  cancel-Handlers.

## Verhalten (nach Umsetzung)

1. **AK1:** Wirft eine Route/Middleware unbehandelt (auch `next(err)` aus `csrfErrorHandler`),
   antwortet der globale Handler mit 500, Content-Type application/json und Body
   `{ message: 'Interner Serverfehler.' }` ohne Stacktrace und ohne Fehlerdetails — und `console.error`
   wird genau einmal mit Methode, Pfad und Fehlermeldung aufgerufen.
2. **AK2:** Die CSRF-Ablehnung (`csrf.ts:35`) antwortet `{ message: 'Ungültiger CSRF-Token.' }` —
   Text unverändert, nur Key `error` → `message` (der Übersetzungseintrag `messagesEn.ts:141` bleibt
   gültig).
3. **AK3:** `GET /auth/error` → 400 `{ message: 'Login fehlgeschlagen. Bitte prüfe deine
Zugangsberechtigung.' }`; `GET /auth/google` ohne Google-Env → 503
   `{ message: 'Google-OAuth ist nicht konfiguriert.' }`. Danach gibt es in `server/src` keine
   `json({ error … })`-Antwort mehr (manuelle Prüfung `grep -rn "json({ error" server/src` → leer;
   bewusst kein Test darauf — ein Quelltext-Grep wäre ein zahnloser Change-Detector).
4. **AK4:** Die stummen Catches loggen via `console.error` (Methode/Pfad + Fehler), bevor sie
   500/502 senden: `index.ts` `/forest` :478, `/graph` :488, `/next` :525, `/suggestions` :535;
   `groups.ts:150`; `publicCancellation.ts:228`. Tests samplen `/forest` (index.ts-Familie) und den
   publicCancellation-502-Fall; die übrigen Stellen folgen im selben Commit demselben Muster
   (Spiegel: Review).
5. **AK5:** Ein Fehler im `await` vor dem try-Block des cancel-Handlers (`Subscription.findOne`,
   billingSubscriptions.ts:288) endet als 500 mit JSON `{ message }` + Log-Eintrag statt der
   Express-HTML-500.

## Testfälle

| TF  | AK  | Datei                                                                      | Art                                                                                                                                                                                                                                |
| --- | --- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TF1 | AK1 | neu `server/src/express/error-handler.test.ts`                             | Express-Mini-App mit werfender Route + gemountetem `errorHandler`: 500 + JSON-Body (generisch, ohne Stack/Details) + genau ein console.error mit Methode/Pfad/Fehler. Rot: fehlender Export `errorHandler` = legitimer erster Rot. |
| TF2 | AK2 | Erweiterung `csrf.test.ts` (bestehender 403-Test)                          | Body-Assert `{ message }` mit gepinntem Text, kein `error`. Rot heute: `message` undefined. Abweichung zur Analyse: `error-contract.test.ts` fährt ohne SESSION_SECRET → CSRF inaktiv; deshalb hier.                               |
| TF3 | AK3 | `auth.test.ts` (Bestandstest umgestellt) + neu in `error-contract.test.ts` | /auth/error 400 `{ message }` (Text gepinnt, ersetzt die `{ error }`-Assertion); /auth/google ohne Google-Env 503 `{ message }`.                                                                                                   |
| TF4 | AK4 | Erweiterung `error-contract.test.ts` + `public-cancellation.test.ts`       | /forest-500 mit console.error-Spy → genau ein Log mit GET//forest/Fehler; publicCancellation-Confirm mit PayPal-Reject → 502 + Log-Eintrag.                                                                                        |
| TF5 | AK5 | Erweiterung `billing-subscriptions-cancel.test.ts`                         | `Subscription.findOne` wirft → cancel-Route 500 + application/json + `{ message }` + Log mit Pfad. Rot heute: Content-Type text/html (Express-Standardseite).                                                                      |

## Test-Pflege-Bedarf

- `auth.test.ts` („GET /auth/error bleibt als API-Fallback erhalten"): bestehender Test pinnt
  `{ error }` — widerspricht AK3, wird auf `{ message }` umgestellt.
- `csrf.test.ts` („lehnt schreibenden Request ohne Token mit 403 ab"): prüft bislang nur den Status —
  Body-Vertrag wird ergänzt (keine Kontra-Assertion vorhanden).
- `invalid-path-ids.test.ts:24` (PO-Nit aus dem #2595-Review): PATCH /categories/abc sendet Body `{}` →
  die 400 kommt aus `validateUpdateBody` statt vom Id-Guard; Body wird auf `{ name: 'X' }` geändert,
  damit der Fall den `parseId`-Guard trifft.

## Dedup

- `error-contract.test.ts` („/forest bzw. /next → 500 mit message") deckt den 500-Body-Vertrag ab —
  die neuen Tests prüfen das Logging, nicht den Body → kein Duplikat.
- `http-error.test.ts` (Dubletten-Wächter) bleibt unberührt.
- Grep alte Welt: `json({ error` → genau 3 Treffer (`csrf.ts:35`, `auth.ts:267/276` — alles Fixziele
  dieses Tickets); `auth/error` und der CSRF-Text in `frontend/src`/`frontend/e2e` → 0 Treffer; keine
  fremden Specs pinnen das alte Verhalten.

## Offene Fragen

- keine.

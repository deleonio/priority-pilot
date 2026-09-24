# Plan: Native App-Wrapper mit Capacitor (Android zuerst, iOS vorbereitet) inkl. Store-Billing

## Context

Balamentum ist eine PWA unter `/app/` (React/Vite, vite-plugin-pwa). Sie soll in die App-Stores, zuerst Google Play, später der Apple App Store. Werden digitale Abos in einer Store-App verkauft, schreibt der Store sein eigenes Billing vor: Google Play Billing bzw. Apple In-App-Purchase (StoreKit). ADR 0013 hat Store-Billing bis zu einem nativen Wrapper vertagt, jetzt steht diese Entscheidung an.

**Entscheidungen des PO (2026-09-23/24):**

- **Wrapper: Capacitor im Remote-Modus.** `server.url` zeigt auf die gehostete `/app/`, es werden keine Assets gebündelt. Die Web-App aktualisiert sich damit wie bisher ohne Store-Release.
- **Package-ID `de.balamentum.app`**, gilt für Android und später iOS.
- **Genau ein Zahlungsweg pro Kanal.** Web/PWA: PayPal. Android-App: Google Play Billing. iOS-App: Apple In-App-Purchase. In den Store-Apps ist PayPal ausgeblendet und nicht erreichbar.
- **Freigeschaltet wird serverseitig, egal wo gekauft wurde.** Nach dem Login entscheidet überall der Abo-Status (Entitlement-Map in `/auth/me`) über die Funktionen.
- **CI baut und lädt hoch** (Internal-Testing-Track).
- **Reihenfolge:** Store-Release zuerst ohne In-App-Kauf (Stufe 1), danach Play Billing (Stufe 2). iOS liegt in weiter Ferne.

Ausgangslage im Code:

- Auth läuft same-origin: Session-Cookie `SameSite=lax`, CSRF `__Host-csrf`, Google OAuth per Server-Redirect (`server/src/express/routes/auth.ts`).
  - Im Remote-Modus teilt der WebView den Origin, Cookies und CSRF funktionieren also.
  - **Google OAuth wird im WebView aber geblockt**, deshalb läuft der Login über den System-Browser (Stufe 1).
- Web Push (`frontend/src/lib/push.ts`, `server/src/logics/push.ts`) funktioniert im Android-WebView nicht, dafür kommt FCM.
- Die Web Speech API (`frontend/src/lib/useVoiceInput.ts`) fehlt im Android-WebView, dafür kommt ein Plugin.
- Geolocation und Mikrofon brauchen Android-Permissions. Der WebChromeClient von Capacitor reicht die Anfragen durch.
- Billing ist schon providerfähig: `server/src/models/subscription.ts` (`provider`, `externalSubscriptionId`), `server/src/express/routes/billing.ts` und `billingSubscriptions.ts`, Preise und Pakete in `server/src/logics/plans.ts`, Muster für Tests in `plans-paypal.test.ts` und `paypal.test.ts`.

## Kanal-Regel: ein Zahlungsweg pro Kanal

| Kanal      | Erkennung                               | Zahlungsweg                    | PayPal          |
| ---------- | --------------------------------------- | ------------------------------ | --------------- |
| `web`      | Browser/PWA                             | PayPal-Abo (ADR 0013)          | sichtbar        |
| `play`     | `Capacitor.getPlatform() === 'android'` | Google Play Billing            | nicht vorhanden |
| `appstore` | `Capacitor.getPlatform() === 'ios'`     | Apple In-App-Purchase (später) | nicht vorhanden |

So wird die Regel durchgesetzt:

1. **Frontend:** `frontend/src/lib/billingChannel.ts` liefert pro Kanal **genau eine** Kauf-Implementierung, als exhaustiver `switch` über den Kanal. Die Paketansicht fragt nur diese Schnittstelle ab und kennt keinen Anbieter direkt. PayPal-Komponenten werden ausschließlich in der `web`-Implementierung importiert. Ein Test prüft pro Kanal, dass genau ein Zahlungsweg erscheint und im Store-Kanal kein PayPal-Element im DOM ist.
2. **Server:** Die App schickt den Header `X-Client-Channel: play`. Die PayPal-Checkout-Route lehnt diesen Kanal mit 409 ab, die Store-Routen lehnen `web` ab. Das ist kein Sicherheitsmechanismus, sondern ein zweites Netz gegen falsch verdrahtete UI.
3. **Ein aktives Abo pro Nutzer, anbieterübergreifend.** Wer anderswo ein aktives Abo hat, sieht im jeweiligen Kanal „Abo aktiv, verwaltet über <Anbieter>“ statt eines Kauf-Buttons. Der Server lehnt einen zweiten Abschluss ab. Das verhindert Doppelabbuchungen.
4. **Kein Anti-Steering-Verstoß:** In den Store-Apps gibt es keinen Hinweis und keinen Link auf den Web-Kauf. Laut Apple Guideline 3.1.3(b) müssen die Pakete in der iOS-App auch per In-App-Purchase kaufbar sein.
5. **Store-Produkte werden in `plans.ts` gemappt** (Paket × Zeitraum → Play-Produkt-ID/Base-Plan). Ein Test gleicht das Mapping ab, nach dem Muster von `plans-paypal.test.ts`.

## Zielstruktur

```
native/                       pnpm-Paket "native" (Capacitor-Projekt, eins für beide Plattformen)
  capacitor.config.ts         appId de.balamentum.app, server.url = ${SITE_URL}/app/
  android/                    von `cap add android` erzeugt, eingecheckt
  ios/                        später: `cap add ios`
  scripts/                    Host aus SITE_URL einsetzen, versionCode ableiten
frontend/src/lib/platform.ts        Kanal 'web' | 'play' | 'appstore'
frontend/src/lib/billingChannel.ts  genau ein Kaufweg pro Kanal
frontend/src/lib/nativeAuth.ts      Login über System-Browser (nur native Kanäle)
server/src/logics/billing/…         Provider hinter einer Schnittstelle (paypal, google_play, später app_store)
```

## Stufe 1: Android-App ohne In-App-Kauf

1. **ADR 0016 „Nativer Wrapper: Capacitor im Remote-Modus“** in `docs/adr/`, Vorlage ADR 0015. Inhalt:
   - Begründung: iOS-fähig, ein Plugin-Ökosystem für Billing, Login, Push und Sprache. Geprüfte Alternative war TWA, siehe unten.
   - Kanal-Regel mit einem Zahlungsweg pro Kanal.
   - Zusätzlich: ADR 0013 bekommt einen Verweis auf ADR 0017.
2. **Paket `native/`**
   - Capacitor (aktuelle Major-Version), `@capacitor/android`, `@capacitor/app`, `@capacitor/browser`. Paket in `pnpm-workspace.yaml` eintragen, `knip.jsonc` anlegen.
   - `capacitor.config.ts`:
     - `server.url` wird aus `SITE_URL` gesetzt, `allowNavigation` nur auf die eigene Domain.
     - Android-Permissions für Standort und Mikrofon im Manifest.
     - Theme-Farben und Icons aus dem Web-Manifest (`frontend/vite.config.ts`, `frontend/public/icons/`), der Splash-Screen läuft über `@capacitor/splash-screen`.
   - `versionCode = major*10000 + minor*100 + patch` aus der Root-`package.json`. Wegen des täglichen Minor-Bumps muss der Wert monoton steigen, dafür gibt es einen Test.
   - Offline oder Server nicht erreichbar: eine lokale Fehlerseite (`errorPath`) mit Neu-laden-Button.
3. **Nativer Login** (Google OAuth ist im WebView geblockt)
   - Die App öffnet `/auth/google?client=app` über `@capacitor/browser` in einem Custom Tab.
   - Nach erfolgreichem Login leitet der Server nicht auf `/app/` weiter. Er erzeugt einen **Einmal-Code** (≤ 60 s gültig, single-use, an den Nutzer gebunden, im Session- bzw. Redis-Store) und leitet per verifiziertem App Link auf `https://<domain>/app/auth/native?code=…` weiter.
   - Die App fängt den Link über `appUrlOpen` ab, schließt den Browser, und der WebView ruft `POST /auth/native/exchange` auf. Dieser Aufruf setzt die normale Session im WebView.
   - Der Magic-Link aus der E-Mail läuft über denselben App Link (`/app/auth/native` bzw. den Magic-Link-Pfad) und landet so direkt in der App.
   - Server-Tests: Code abgelaufen, Code doppelt eingelöst, fremder Code.
4. **Asset Links** (Pflicht für verifizierte App Links)
   - `website/scripts/build.ts` erzeugt `dist/.well-known/assetlinks.json` aus den Env-Werten `ANDROID_PACKAGE_ID` und `ANDROID_CERT_SHA256` (Play-App-Signing-Key und Upload-Key). Ohne diese Env-Werte entsteht keine Datei.
   - Nicht nach `website/public/` legen: Die flache Kopierschleife dort bricht an Unterverzeichnissen mit EISDIR ab.
   - Caddy (`docs/server-setup.md` §7): `/.well-known/*` mit `Content-Type: application/json` und ohne Redirect.
   - `deploy.yml` reicht die Vars durch.
5. **Push über FCM**
   - `@capacitor/push-notifications` in der App.
   - Server: FCM-Token neben den Web-Push-Subscriptions speichern und per FCM HTTP v1 versenden (`firebase-admin` oder `fetch` mit Service-Account).
   - `server/src/logics/push.ts` bekommt einen zweiten Sender hinter derselben Versandfunktion. Dedupe über `notification_logs` bleibt wie bisher.
   - `frontend/src/lib/push.ts` verzweigt nach `platform.ts`. Eine Benachrichtigung aus FCM öffnet den Ziel-Link wie `notificationclick` in `push-sw.js`.
6. **Sprache:** `useVoiceInput.ts` nutzt im `play`-Kanal `@capacitor-community/speech-recognition`, im Web bleibt die Web Speech API.
7. **Kanal im Frontend**
   - `platform.ts` legt den Kanal fest.
   - In den nativen Kanälen ausgeblendet: `InstallPrompt` und der Service-Worker-`UpdatePrompt`. Im Remote-Modus lädt der WebView beim App-Start ohnehin frisch.
   - Die Paketansicht zeigt Status und Pakete. Kauf-Buttons kommen im `play`-Kanal erst mit Stufe 2, bis dahin nur der Hinweis „Kauf in der App folgt“, ohne Web-Link.
   - `openapi-fetch` setzt den Header `X-Client-Channel`.
8. **CI `.github/workflows/android.yml`** (workflow_dispatch, optional nach erfolgreichem Deploy)
   - JDK und Android SDK, `pnpm --filter native sync`, dann `./gradlew bundleRelease`.
   - Signieren mit Secrets (`ANDROID_UPLOAD_KEYSTORE_B64`, `…_PASSWORD`, `…_ALIAS`).
   - Upload in den Internal-Track per `r0adkll/upload-google-play` (SHA-gepinnt) und `PLAY_SERVICE_ACCOUNT_JSON`, das AAB zusätzlich als Artefakt.
   - `google-services.json` für FCM kommt aus einem Secret.
   - `pnpm lint:actions` muss grün bleiben.
9. **Doku:** `docs/native-apps.md` (Setup, Keystore, Firebase, Play Console, App-Link-Prüfung, Release), Abschnitt `## Native Apps` in `AGENTS.md`, `.ai-knowledge/project.md`, `docs/arc42.md` (Bausteine, Verteilung).
10. **Manuelle Schritte für dich**
    - Play-Developer-Konto anlegen, App `de.balamentum.app` registrieren, Play App Signing einrichten und den SHA-256 in die Vars eintragen.
    - Firebase-Projekt anlegen, Service-Account für den Upload anlegen, Store-Eintrag und Data-Safety-Formular ausfüllen, Datenschutzerklärung um FCM ergänzen.
    - Das allererste AAB muss manuell hochgeladen werden.
    - Bei privatem Konto: Closed Test mit 12 Testern über 14 Tage.

## Stufe 2: Google Play Billing

1. **ADR 0017 „Store-Billing“**
   - **Plugin:** `cordova-plugin-purchase` (CdvPurchase, läuft unter Capacitor, deckt später auch StoreKit ab) mit eigener Server-Verifikation. Begründung: kein weiterer US-Auftragsverarbeiter (Linie aus ADR 0013), keine Umsatzbeteiligung.
   - **Alternative RevenueCat:** spart 2–3 Tage Server-Arbeit, kostet aber etwa 1 % ab einer Umsatzschwelle und braucht einen AVV.
   - **Store-Gebühr:** 15 %. Ob die Store-Preise gleich hoch oder höher als die Web-Preise sind, entscheidet der PO.
   - **Rechnungen:** Google ist Merchant of Record, deshalb gibt es für Store-Käufe keine eigene Rechnung.
   - **EWR-Alternative-Billing:** vorerst nicht, nur als Option vermerkt.
2. **Play Console:** Abo-Produkte `pro`, `max` und `ultimate`, jeweils mit den Base Plans `monthly`, `quarterly` und `yearly`. Das Mapping steht in `plans.ts`.
3. **Server, Provider `google_play`**
   - **Schnittstelle zuerst:** Prüfen, ob PayPal hinter einer Schnittstelle liegt (`routes/billing.ts`, `billingSubscriptions.ts`). Falls nicht, zuerst eine schmale `BillingProvider`-Schnittstelle herausziehen, als eigenen PR mit reinem Refactoring.
   - **`POST /billing/google/purchase`** (Session und CSRF):
     - Beleg prüfen über die Play Developer API `purchases.subscriptionsv2.get`.
     - Kauf dem Nutzer zuordnen: `obfuscatedAccountId` beim Kauf setzen und den Token binden. Ein fremder Token wird abgelehnt.
     - Kauf bestätigen (`acknowledge`), dann `Subscription` schreiben.
   - **`POST /billing/google/rtdn`** (Pub/Sub-Push, OIDC-JWT-Prüfung):
     - Muster wie beim PayPal-Webhook: annehmen, persistieren, verifizieren, erst danach den Plan setzen.
     - Gemountet vor CSRF und `requireAuth`.
   - **Lifecycle:** renewed, in_grace_period, on_hold, canceled, expired und revoked laufen auf den vorhandenen Kulanz- und Downgrade-Pfad (`firstFailureAt`, T7).
   - **Paketwechsel:** Upgrade sofort, Downgrade zum Periodenende über die Replacement-Modes des Plugins.
   - **API-Vertrag:** `openapi.yml` erweitern und die Client-Typen generieren.
4. **Frontend:** Die `play`-Implementierung in `billingChannel.ts` lädt Produkte und Preise aus dem Store, schließt den Kauf ab, schickt den Token an den Server und lädt danach die Entitlement-Map neu. „Käufe wiederherstellen“ ist Pflicht-UI.

## Stufe 3: iOS (nur Ausblick)

- Mit `cap add ios` im selben Paket `native/`. Der Login-Flow aus Stufe 1 funktioniert unverändert, auf iOS mit `ASWebAuthenticationSession` über `@capacitor/browser`.
- FCM stellt Push auch auf iOS zu, dazu muss nur der APNs-Key in Firebase hinterlegt werden.
- Kauf mit demselben Plugin über StoreKit, Kanal `appstore`. Server-Provider `app_store` mit der App Store Server API und den Server Notifications V2.
- Sign in with Apple ist Pflicht, weil die App Google-Login anbietet (Guideline 4.8).
- Guideline 4.2 (Minimum Functionality) ist für reine Web-Wrapper ein Risiko. Native Mehrwerte wie Push, Sprache und Standort helfen dagegen.

## Aufwandsschätzung nur Android (grob, Entwicklertage)

| Baustein                                      | Tage      |
| --------------------------------------------- | --------- |
| Capacitor-Projekt, Asset Links, Kanal, CI     | 2–3       |
| Nativer Login (System-Browser + Einmal-Code)  | 2–4       |
| Push über FCM (Client und Server)             | 2–3       |
| Sprach-Plugin, Permissions, Offline-Seite     | 1         |
| Play Billing Client (Plugin)                  | 1–2       |
| Play Billing Server (Verify, RTDN, Lifecycle) | 3–5       |
| **Summe**                                     | **11–18** |

Dazu kommt Zeit, die nicht in die Entwicklung fällt:

- Play Console, Store-Eintrag und Firebase: 1–2 Tage.
- Konto-Verifizierung: mehrere Tage.
- Bei privatem Konto: Closed Test über 14 Tage mit 12 Testern.
- App-Review: wenige Tage.

## Erkenntnisse aus der Planung (2026-09-23/24)

- **Google Pay und Apple Pay sind nicht gemeint.** Beide sind Zahlungsarten und für digitale Abos in Store-Apps unzulässig. Vorgeschrieben sind **Google Play Billing** und **Apple In-App-Purchase (StoreKit)**. Das gehört in jedes Ticket und jeden ADR.
- **Die Auth-Architektur entscheidet mit.** Eine TWA hätte den Same-Origin-Login ohne Änderung übernommen. Im WebView blockiert Google OAuth, deshalb braucht Capacitor den Login über den System-Browser mit Einmal-Code. Im Remote-Modus bleiben Cookies und CSRF unverändert, CORS muss nicht umgebaut werden.
- **Warum Capacitor statt TWA:** Kurzfristig wäre TWA 2–5 Tage billiger gewesen. Bei TWA muss die Kaufschnittstelle aber im Web-Code selbst gebaut werden (Digital Goods API, wenig Praxis, Paketwechsel unklar). Capacitor bringt ausgereifte Plugins mit und lässt sich ohne zweite Wrapper-Technologie auf iOS erweitern.
- **Im WebView fehlen Browser-Funktionen:** Web Push und die Web Speech API gibt es im Android-WebView nicht. Das fällt erst bei der Feature-Inventur auf, deshalb braucht es vor jedem Wrapper-Wechsel eine Inventur der Browser-APIs.
- **Ein Zahlungsweg pro Kanal, freigeschaltet serverseitig:** doppelt abgesichert über die Frontend-Schnittstelle und den Server-Header. Die Entitlements gelten unabhängig davon, wo gekauft wurde.
- **Das Fundament steht:** `subscriptions.provider` und die Entitlement-Map nehmen die Store-Provider auf, ohne dass sich das Datenmodell ändert.
- **Stolperfallen im Repo:**
  - Flacher Copy in `website/scripts/build.ts` (EISDIR bei `.well-known/`).
  - Die Domain steht nur in `SITE_URL`.
  - Monotone `versionCode` trotz täglichem Minor-Bump.
  - Das erste AAB muss manuell hochgeladen werden.

## Issue-Baum

Umgesetzt wird über das Epic [#1664](https://github.com/deleonio/priority-pilot/issues/1664): 33 Issues mit höchstens mittlerer Komplexität, verknüpft über Blocked-by-Relationen, Reihenfolge in Wellen. Gegenüber dem ersten Schnitt kamen zwei Play-Pflichten hinzu: Konto löschen (in der App und als Webseite) und eine Datenschutzerklärung.

## Verifikation

- **Unit (vitest):**
  - `platform.ts` und `billingChannel.ts`: pro Kanal genau ein Zahlungsweg, im `play`-Kanal kein PayPal im DOM.
  - `push.ts` verzweigt nach Kanal.
  - `versionCode`-Formel.
  - Asset-Links-Generator mit und ohne Env-Werte.
  - Abgleich von `plans.ts` mit den Play-Produkt-IDs.
- **Server** (Google-API gemockt wie in `paypal.test.ts`):
  - Einmal-Code: abgelaufen, doppelt eingelöst, fremd.
  - Kanal-Sperre per 409.
  - Kauf-Route: Token-Bindung, fremder Token, `acknowledge`.
  - RTDN: JWT-Prüfung und Lifecycle-Mapping.
  - Kein zweites aktives Abo.
- **E2E (Playwright):** Die Kanal-Regeln bei 375×812, dafür wird der `play`-Kanal per Test-Override simuliert.
- **Gate:** `pnpm format`, `pnpm lint`, `pnpm lint:actions`, `pnpm knip`, `pnpm test`, `pnpm -r build`.
- **Auf dem Gerät:**
  - Installieren mit `pnpm --filter native sync && npx cap run android` oder per `adb install`.
  - Prüfen:
    - App Links mit `adb shell pm get-app-links de.balamentum.app`
    - Google-Login und Magic-Link, jeweils mit Rücksprung in die App
    - FCM-Push inklusive Klick auf die Benachrichtigung
    - Standort, Spracheingabe, Offline-Seite
    - kein PayPal sichtbar
  - Stufe 2: Testkauf mit einem Lizenztester im Internal-Track, danach RTDN-Eingang, Planwechsel in `/auth/me`, Wiederherstellen und Up- bzw. Downgrade prüfen.

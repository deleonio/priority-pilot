# ADR 0016 — Nativer Wrapper: Capacitor im Remote-Modus

- **Status:** Accepted (2026-09-24)
- **Datum:** 2026-09-24
- **Kontext:** [Plan native Apps](../plan-native-apps.md) (PO-Entscheidungen vom 23./24.09.2026), [ADR 0013](0013-zahlungsweg-paypal-abos.md) (Store-Billing bis zu einem nativen Wrapper vertagt), [ADR 0015](0015-oeffentliche-website-und-app-unter-app.md) (App unter `/app/`), [Epic #1664](https://github.com/deleonio/priority-pilot/issues/1664)

## Kontext

Balamentum ist eine PWA unter `/app/`. Sie soll in den Google Play Store, später in den Apple App Store. Eine PWA allein kommt dort nicht hinein, es braucht einen nativen Wrapper. Die Wahl des Wrappers legt fest, wie Login, Push, Spracheingabe und später der Kauf von Abos in der App funktionieren.

Drei Eigenheiten des heutigen Codes bestimmen die Entscheidung mit:

- Die Anmeldung läuft same-origin über ein Session-Cookie (`SameSite=lax`) und CSRF-Token (`__Host-csrf`). Google OAuth leitet über den Server um (`server/src/express/routes/auth.ts`). Im Android-WebView blockiert Google diesen Login.
- Web Push (`frontend/src/lib/push.ts`) und die Web Speech API (`frontend/src/lib/useVoiceInput.ts`) gibt es im Android-WebView nicht.
- Wer in einer Store-App digitale Abos verkauft, muss das Billing des Stores nutzen: Google Play Billing, bei Apple In-App-Purchase. Google Pay und Apple Pay sind Zahlungsarten und dafür nicht zulässig.

## Entscheidung

**1. Capacitor im Remote-Modus.** Ein pnpm-Paket `native/` enthält das Capacitor-Projekt für beide Plattformen. `server.url` zeigt auf die gehostete `/app/` (aus `SITE_URL`), Assets werden nicht gebündelt. Die App lädt damit immer den aktuellen Web-Stand, Änderungen am Frontend brauchen kein Store-Release. `allowNavigation` erlaubt nur die eigene Domain. Ist der Server nicht erreichbar, zeigt die App eine lokale Fehlerseite.

**2. Package-ID `de.balamentum.app`** für Android und später iOS.

**3. Kanal statt Plattform-Weichen im Code.** Das Frontend ermittelt einen Kanal und verzweigt nur über ihn. Jede API-Anfrage trägt ihn im Header `X-Client-Channel`.

| Kanal      | Erkennung                               | Zahlungsweg                    | PayPal          |
| ---------- | --------------------------------------- | ------------------------------ | --------------- |
| `web`      | Browser/PWA                             | PayPal-Abo (ADR 0013)          | sichtbar        |
| `play`     | `Capacitor.getPlatform() === 'android'` | Google Play Billing            | nicht vorhanden |
| `appstore` | `Capacitor.getPlatform() === 'ios'`     | Apple In-App-Purchase (später) | nicht vorhanden |

**4. Ein Zahlungsweg pro Kanal, freigeschaltet wird serverseitig.** Pro Kanal gibt es genau eine Kauf-Implementierung. In den Store-Apps ist PayPal nicht erreichbar, es gibt dort auch keinen Hinweis oder Link auf den Kauf im Web. Der Server lehnt den PayPal-Checkout für die Store-Kanäle mit 409 ab; das ist ein zweites Netz gegen falsch verdrahtete Oberflächen, kein Sicherheitsmechanismus. Welche Funktionen jemand nutzen darf, entscheidet wie bisher der Abo-Status in `/auth/me`, egal wo gekauft wurde. Ein Nutzer hat höchstens ein aktives Abo über alle Anbieter. Die Einzelheiten zu Play Billing hält eine eigene ADR fest.

**5. Login über den System-Browser mit Einmal-Code.** Die App öffnet `/auth/google?client=app` in einem Custom Tab. Nach dem Login erzeugt der Server einen Einmal-Code (höchstens 60 Sekunden gültig, nur einmal einlösbar, an den Nutzer gebunden) und leitet auf den verifizierten App Link `https://<domain>/app/auth/native?code=…` weiter. Die App fängt den Link ab, schließt den Custom Tab, und der WebView tauscht den Code über `POST /auth/native/exchange` gegen die normale Session. Magic-Links aus der E-Mail öffnen über denselben App-Link-Mechanismus direkt die App. Für die Verifikation liefert die Website `/.well-known/assetlinks.json` aus.

**6. Browser-Funktionen, die im WebView fehlen, kommen über Plugins.** Push läuft in der App über Firebase Cloud Messaging als zweiter Sender hinter der vorhandenen Versandfunktion, die Spracheingabe über ein Speech-Recognition-Plugin. Installationshinweis und Update-Banner des Service Workers sind in den nativen Kanälen ausgeblendet.

**7. Reihenfolge.** Die App geht zuerst ohne In-App-Kauf in den Store (Stufe 1), Play Billing folgt danach (Stufe 2). iOS folgt deutlich später. Die CI baut das signierte App-Bundle und lädt es in den Internal-Testing-Track.

## Verworfene Alternativen

**Trusted Web Activity (TWA).** Eine TWA zeigt die PWA im Chrome-Tab ohne Browser-Leiste. Sie hätte den Same-Origin-Login ohne Änderung übernommen, und Web Push wäre geblieben; kurzfristig wäre sie 2 bis 5 Tage billiger gewesen. Dagegen sprach der Kauf: In einer TWA muss Play Billing im Web-Code über die Digital Goods API gebaut werden, dazu gibt es wenig Praxis, und der Paketwechsel ist dort unklar. Für iOS gibt es keine TWA, es bräuchte eine zweite Wrapper-Technologie. Capacitor bringt ausgereifte Plugins für Billing, Login, Push und Sprache mit und deckt beide Plattformen mit einem Projekt ab.

**Capacitor mit gebündelten Assets.** Die App bringt dann ihr Frontend selbst mit. Dafür bräuchte die API CORS und einen anderen Session-Transport als das Same-Origin-Cookie, und jede Frontend-Änderung müsste durch den Store. Der Remote-Modus vermeidet beides.

## Konsequenzen

- Cookies, CSRF und CORS bleiben unverändert, weil der WebView die App vom eigenen Origin lädt. Neu sind nur der Einmal-Code-Tausch und die Asset Links.
- Ohne Netz startet die App nur bis zur lokalen Fehlerseite. Das entspricht dem heutigen Verhalten der PWA ohne Server.
- `@capacitor/*`-Pakete stehen im Frontend (JavaScript-Seite) und in `native/` (native Seite). Ihre Versionen müssen gleich bleiben.
- Der `versionCode` wird aus der Root-Version abgeleitet (`major*10000 + minor*100 + patch`) und muss trotz täglichem Minor-Bump streng steigen.
- Google Play verlangt eine Datenschutzerklärung und eine Konto-Löschung in der App samt Webseite dazu. Beides fehlt bisher und ist Teil von Stufe 1.
- Für Apple ist Guideline 4.2 (Minimum Functionality) bei reinen Web-Wrappern ein Risiko. Push, Spracheingabe und Standort als native Funktionen helfen dagegen. Weil die App Google-Login anbietet, ist auf iOS zusätzlich Sign in with Apple Pflicht.
- Außerhalb des Repos braucht es ein Play-Developer-Konto, Play App Signing, ein Firebase-Projekt und Service-Accounts. Das erste App-Bundle muss von Hand hochgeladen werden.

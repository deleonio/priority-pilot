# Native Apps (Android)

Die Android-App ist ein Capacitor-Wrapper mit gebündelter Web-App ([ADR 0021](adr/0021-android-app-spa-ohne-service-worker.md),
Wrapper: [ADR 0016](adr/0016-nativer-wrapper-capacitor-remote-modus.md)): Das App-Bundle enthält den Android-Build des
Frontends (`pnpm --filter frontend build:android`, Ausgabe `frontend/dist-android`) derselben Version und startet
auch ohne Netz. Das Website-Deployment (`frontend/dist` nach `/app/`) bleibt davon unberührt. Umsetzung und Reihenfolge: [Plan native Apps](plan-native-apps.md), Epic #1664.

## Aufbau

| Pfad                               | Inhalt                                                                                                      |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `native/capacitor.config.ts`       | App-ID `balamentum.app`, `webDir` = `frontend/dist-android`, nur eigene Domain (`SITE_URL`) navigierbar     |
| `native/android/`                  | von `cap add android` erzeugtes Projekt, eingecheckt; Manifest mit Standort-/Mikrofon-Rechten und App Links |
| `native/android/app/src/main/res/` | Icons aus `frontend/public/logo/logo.png`, Splash aus der Wortmarke (siehe unten)                           |

`capacitor.config.json` und die kopierten Web-Dateien unter `android/app/src/main/assets/` entstehen
bei jedem `sync` und sind nicht eingecheckt.

## Lokal bauen

Voraussetzungen: JDK 21 und ein Android SDK mit `platforms;android-36`, `build-tools;36.0.0` und
`platform-tools` (`ANDROID_HOME` zeigt darauf).

```bash
export SITE_URL=https://example.org
pnpm --filter frontend build:android                     # Web-App für die Android-App → frontend/dist-android
pnpm --filter native sync                                # Web-App, Konfiguration und Plugins ins Android-Projekt
cd native/android && ./gradlew assembleDebug             # → app/build/outputs/apk/debug/app-debug.apk
```

Push über FCM braucht die `google-services.json` aus der Firebase-Konsole in `native/android/app/`
(gitignored, nicht einchecken; Einrichtung: [Firebase einrichten](#firebase-einrichten)). Ohne sie erzeugt der Gradle-Build eine Platzhalter-Konfiguration:
Firebase initialisiert, das Token-Holen scheitert asynchron — der Push-Schalter meldet dann einen
Fehler, statt dass die App abstürzt.
Ohne `SITE_URL` bricht der Build bzw. `sync` mit einer Meldung ab; `sync` braucht außerdem `frontend/dist-android`. Für den Emulator: `npx cap run android` im Ordner
`native/` oder das APK per `adb install` einspielen.

## Signiertes App-Bundle (CI)

Der Workflow `Android App-Bundle` (`.github/workflows/android.yml`) baut
`app-release.aab`, signiert mit dem Upload-Schlüssel, und legt es als Artefakt `balamentum-aab` ab.
Nach jedem täglichen Minor-Release startet `Daily Version` ihn auf dem neuen Tag `vX.Y.0`; dann lädt er
das AAB zusätzlich mit dem Release-Namen `vX.Y.0` in den internen Test-Track der Play Console und
rollt es dort an die internen Tester aus. Geschlossener Test und Produktion bleiben Handarbeit: das
Release in der Console hochstufen oder das Bundle über „Aus Bibliothek hinzufügen“ wählen. Manuell gestartet von
`main` lädt der Workflow nichts hoch, auf einem Tag schon.
Zusätzlich legt er die mit demselben Upload-Schlüssel signierte APK als Artefakt `balamentum-apk` ab
(`adb install app-release.apk`). Da der Fingerabdruck des Upload-Schlüssels in `ANDROID_CERT_SHA256`
steht, bleibt die App-Link-Verifikation erhalten — Übergang bis zum internen Test-Track nach dem
Store-Start (#1688).
Den `versionCode` leitet Gradle aus der Root-Version ab (`major*10000000 + minor*10000 + patch`,
`native/src/version-code.ts`).

Upload-Schlüssel einmalig erzeugen und sicher aufbewahren (für PKCS12 gilt ein Passwort für
Keystore und Schlüssel):

```bash
keytool -genkeypair -keystore upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 upload.jks   # Inhalt → Secret ANDROID_UPLOAD_KEYSTORE_B64
```

| Name                               | Art      | Inhalt                                                             |
| ---------------------------------- | -------- | ------------------------------------------------------------------ |
| `ANDROID_UPLOAD_KEYSTORE_B64`      | Secret   | Keystore als Base64                                                |
| `ANDROID_UPLOAD_KEYSTORE_PASSWORD` | Secret   | Passwort von Keystore und Schlüssel                                |
| `ANDROID_UPLOAD_KEY_ALIAS`         | Secret   | Alias des Schlüssels, z. B. `upload`                               |
| `ANDROID_GOOGLE_SERVICES_JSON`     | Secret   | Inhalt der `google-services.json` aus Firebase; fehlt er: ohne FCM |
| `PLAY_SERVICE_ACCOUNT_JSON`        | Secret   | JSON-Schlüssel des Service-Accounts für den Play-Upload            |
| `SITE_URL`                         | Variable | Domain der gehosteten App, wie beim Deploy                         |

Mit Play App Signing signiert Google die ausgelieferte App mit dem eigenen App-Signaturschlüssel.
Dessen SHA-256 aus der Play Console gehört in `ANDROID_CERT_SHA256` (Asset Links), dazu der
Fingerabdruck des Upload-Schlüssels für selbst installierte Builds, durch Komma getrennt.

Für den Play-Upload einmalig: in Google Cloud einen Service-Account mit JSON-Schlüssel anlegen
(Inhalt → `PLAY_SERVICE_ACCOUNT_JSON`), ihn in der Play Console unter „Nutzer und Berechtigungen“
für `balamentum.app` mit den Rechten „Apps in Test-Tracks veröffentlichen“ und „App-Entwürfe
bearbeiten und löschen“ einladen. Solange die App ein App-Entwurf ist (noch nie ein Release
ausgerollt), nimmt die API nur Entwürfe an („Only releases with status draft may be created on draft
app“): das erste interne Release einmal von Hand ausrollen.

## Firebase einrichten

Push an die App läuft über Firebase Cloud Messaging (`server/src/logics/fcm.ts`). Android stellt die
Nachrichten auch zu, wenn die App im Hintergrund liegt oder weggewischt ist. Im Code ist alles
vorhanden; es fehlen nur zwei Dateien aus Firebase. Einmalig:

1. **Projekt:** in der [Firebase-Konsole](https://console.firebase.google.com) „Projekt hinzufügen“,
   dabei das vorhandene Google-Cloud-Projekt wählen oder ein neues anlegen. Google Analytics wird
   nicht gebraucht.
2. **Android-App registrieren:** auf der Projektübersicht das Android-Symbol, Paketname genau
   `balamentum.app` (SHA-1 nicht nötig). `google-services.json` herunterladen; die Schritte „Firebase
   SDK hinzufügen“ überspringen, Gradle bindet es schon ein.
3. **FCM-API prüfen:** unter Projekteinstellungen → Cloud Messaging muss „Firebase Cloud Messaging
   API (V1)“ aktiviert sein (bei neuen Projekten Standard).
4. **Server-Schlüssel:** Projekteinstellungen → Dienstkonten → „Neuen privaten Schlüssel generieren“.
   Die JSON-Datei auf dem Server ablegen, z. B.
   `/var/www/gh-deploy/priority-pilot/secrets/fcm-service-account.json` (Modus `600`, nicht im Repo).
5. **Env-Variable:** in der Env-Datei `FCM_SERVICE_ACCOUNT_FILE=<Pfad>` einkommentieren (für
   Erinnerungen zusätzlich `PUSH_REMINDERS_ENABLED=true`), dann
   `pm2 reload priority-pilot --update-env`.
6. **App-Build:** den Inhalt der `google-services.json` als Secret `ANDROID_GOOGLE_SERVICES_JSON`
   hinterlegen (CI) bzw. die Datei nach `native/android/app/` legen (lokal). Danach die App neu bauen
   und installieren.
7. **Prüfen:** in der App unter Einstellungen Push einschalten (ab Android 13 fragt das System nach
   der Erlaubnis), dann „Push testen“ — einmal mit offener App, einmal mit weggewischter App.

Fehlerbilder:

- **Der Push-Schalter meldet einen Fehler:** Der Build lief ohne `google-services.json` (Platzhalter,
  siehe [Lokal bauen](#lokal-bauen)). Secret bzw. Datei prüfen und neu bauen. Passt der Paketname in
  der Datei nicht, bricht schon der Gradle-Build ab.
- **„Push testen“ meldet „Kein Gerät erreicht“ oder einen Fehler:** `FCM_SERVICE_ACCOUNT_FILE`
  fehlt, zeigt auf eine unlesbare Datei, oder der Server wurde ohne `--update-env` neu geladen. Der
  Schlüssel muss aus demselben Firebase-Projekt stammen wie die `google-services.json`.

## Käufe serverseitig prüfen (Play-Dienstkonto)

Der Server prüft Play-Käufe bei Google (`server/src/logics/googlePlay.ts`, ADR 0017). Ohne
Einrichtung endet jeder Kauf mit `not_configured`, ebenso bei 401/403 von Google. Einmalig:

1. **Dienstkonto:** das Konto aus dem Play-Upload (`PLAY_SERVICE_ACCOUNT_JSON`) mitnutzen oder in
   Google Cloud ein neues anlegen; die Android Publisher API muss im Cloud-Projekt aktiviert sein.
2. **Rechte:** in der Play Console unter „Nutzer und Berechtigungen“ das Dienstkonto einladen, mit
   „Finanzdaten ansehen“ und „Bestellungen und Abos verwalten“ (App `balamentum.app`). Die Rechte
   greifen erst nach einigen Stunden.
3. **Schlüsseldatei:** den JSON-Schlüssel auf dem Server ablegen, z. B.
   `/var/www/gh-deploy/priority-pilot/secrets/play-service-account.json` (Modus `600`, nicht im Repo).
4. **Env-Variable:** in der Env-Datei `GOOGLE_PLAY_SERVICE_ACCOUNT_FILE=<Pfad>` einkommentieren, dann
   `pm2 reload priority-pilot --update-env`.
5. **Prüfen:** Testkauf über den internen Track; im Log darf weder `not_configured` noch 401/403
   stehen, das Paket ist danach im Konto aktiv.

Für die Benachrichtigungen bei Verlängerung und Kündigung zusätzlich `GOOGLE_RTDN_AUDIENCE` setzen
(Push-Endpunkt der Pub/Sub-Subscription, Beispiel in `docs/deployment.md`).

## Anmeldung in der App

Google blockiert OAuth im WebView. „Mit Google anmelden“ öffnet deshalb `/auth/google?client=app&state=…`
im System-Browser (`frontend/src/lib/nativeAuth.ts`). Nach dem Login leitet der Server auf
`/app/auth/native?code=…` um. Android gibt diesen App Link an die App, der WebView löst den Code mit dem
gemerkten `state` über `POST /auth/native/exchange` ein. Magic-Links auf `/app/` öffnen auf demselben
Weg die App. Mit `X-Client-Channel: play` antworten Code-Tausch und Magic-Link-Einlösung mit einem
App-Token statt eines Session-Cookies; die App schickt es als `Authorization: Bearer`, `POST /auth/logout`
zieht es zurück (#2377). Der Intent-Filter im Manifest nimmt die Domain aus `server.allowNavigation` (Gradle liest sie aus der
von `sync` erzeugten `capacitor.config.json`), verifiziert wird sie über `/.well-known/assetlinks.json`
der Website. Prüfen auf dem Gerät: `adb shell pm get-app-links balamentum.app` muss die Domain als
`verified` zeigen.

Die Sitzung bleibt über App-Neustarts erhalten: `MainActivity.onPause()` ruft `CookieManager.flush()` auf,
damit der WebView das Session-Cookie vor dem Beenden der App oder des Geräts auf die Platte schreibt.

## Icons und Splash neu erzeugen

Icons entstehen aus dem Web-Logo, der Splash aus der Wortmarke (Marke oben, „balamentum" darunter).
Der Wortmarken-Generator legt die Splash-Quellen in `native/assets/` ab und schreibt das
Branding-Bild `drawable(-night)-xxxhdpi/splash_branding.png`, das Android 12+ unter dem App-Icon
zeigt (dort gibt es keinen vollflächigen Splash mehr, `values-v31/styles.xml`). `native/assets/`
existiert nur während des Laufs:

```bash
node frontend/public/logo/generate-wordmarks.mjs   # Chromium-Version weicht ab: CHROMIUM_PATH=… davor
cd native && cp ../frontend/public/logo/logo.png assets/logo.png
npx @capacitor/assets@3.0.5 generate --android --iconBackgroundColor '#ffffff' --iconBackgroundColorDark '#1a1a1a' --splashBackgroundColor '#ffffff' --splashBackgroundColorDark '#1a1a1a'
rm -rf assets
```

# Native Apps (Android)

Die Android-App ist ein Capacitor-Wrapper im Remote-Modus ([ADR 0016](adr/0016-nativer-wrapper-capacitor-remote-modus.md)):
Sie lädt die gehostete App unter `SITE_URL/app/`, gebündelt ist nur eine Fehlerseite für den Fall
ohne Server. Umsetzung und Reihenfolge: [Plan native Apps](plan-native-apps.md), Epic #1664.

## Aufbau

| Pfad                               | Inhalt                                                                                                      |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `native/capacitor.config.ts`       | App-ID `de.balamentum.app`, `server.url` aus `SITE_URL`, nur eigene Domain                                  |
| `native/www/error.html`            | Fehlerseite ohne Verbindung, „Neu laden" springt zurück auf `server.url`                                    |
| `native/android/`                  | von `cap add android` erzeugtes Projekt, eingecheckt; Manifest mit Standort-/Mikrofon-Rechten und App Links |
| `native/android/app/src/main/res/` | Icons und Splash aus `frontend/public/logo/logo.png` (siehe unten)                                          |

`capacitor.config.json` und die kopierten Web-Dateien unter `android/app/src/main/assets/` entstehen
bei jedem `sync` und sind nicht eingecheckt.

## Lokal bauen

Voraussetzungen: JDK 21 und ein Android SDK mit `platforms;android-36`, `build-tools;36.0.0` und
`platform-tools` (`ANDROID_HOME` zeigt darauf).

```bash
SITE_URL=https://example.org pnpm --filter native sync   # Konfiguration und Plugins ins Android-Projekt
cd native/android && ./gradlew assembleDebug             # → app/build/outputs/apk/debug/app-debug.apk
```

Ohne `SITE_URL` bricht `sync` mit einer Meldung ab. Für den Emulator: `npx cap run android` im Ordner
`native/` oder das APK per `adb install` einspielen.

## Signiertes App-Bundle (CI)

Der Workflow `Android App-Bundle` (`.github/workflows/android.yml`, nur manuell) baut
`app-release.aab`, signiert mit dem Upload-Schlüssel, und legt es als Artefakt `balamentum-aab` ab.
Den `versionCode` leitet Gradle aus der Root-Version ab (`major*10000 + minor*100 + patch`,
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
| `SITE_URL`                         | Variable | Domain der gehosteten App, wie beim Deploy                         |

Mit Play App Signing signiert Google die ausgelieferte App mit dem eigenen App-Signaturschlüssel.
Dessen SHA-256 aus der Play Console gehört in `ANDROID_CERT_SHA256` (Asset Links), nicht der
Fingerabdruck des Upload-Schlüssels.

## Anmeldung in der App

Google blockiert OAuth im WebView. „Mit Google anmelden“ öffnet deshalb `/auth/google?client=app&state=…`
im System-Browser (`frontend/src/lib/nativeAuth.ts`). Nach dem Login leitet der Server auf
`/app/auth/native?code=…` um. Android gibt diesen App Link an die App, der WebView löst den Code mit dem
gemerkten `state` über `POST /auth/native/exchange` ein. Magic-Links auf `/app/` öffnen auf demselben
Weg die App. Der Intent-Filter im Manifest nimmt die Domain aus `server.url` (Gradle liest sie aus der
von `sync` erzeugten `capacitor.config.json`), verifiziert wird sie über `/.well-known/assetlinks.json`
der Website. Prüfen auf dem Gerät: `adb shell pm get-app-links de.balamentum.app` muss die Domain als
`verified` zeigen.

## Icons und Splash neu erzeugen

Quelle ist das Web-Logo; die Kopie liegt nur während des Laufs in `native/assets/`:

```bash
cd native && mkdir -p assets && cp ../frontend/public/logo/logo.png assets/logo.png
npx @capacitor/assets@3.0.5 generate --android --iconBackgroundColor '#ffffff' --iconBackgroundColorDark '#1a1a1a' --splashBackgroundColor '#ffffff' --splashBackgroundColorDark '#1a1a1a'
rm -rf assets
```

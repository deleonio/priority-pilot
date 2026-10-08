# ADR 0023 — Android-App meldet sich nativ über den Credential Manager an

- **Status:** Accepted (2026-10-08)
- **Datum:** 2026-10-08
- **Kontext:** ersetzt Entscheidung 5 von [ADR 0016](0016-nativer-wrapper-capacitor-remote-modus.md), baut auf [ADR 0021](0021-android-app-spa-ohne-service-worker.md) (App-Token) auf

## Kontext

Nach ADR 0016 öffnet die App den Google-Login im Custom Tab, der Server leitet danach auf den App Link `/app/auth/native?code=…`. Android gibt diesen Link nur an die App, wenn `/.well-known/assetlinks.json` den Fingerabdruck des Signaturschlüssels nennt. Aus dem Play Store kommt die App mit Googles App-Signaturschlüssel, die Datei nannte nur den Upload-Schlüssel. Folge im internen Test: Der Rücksprung blieb im Custom Tab, die gehostete Web-App meldete den Nutzer dort an. Er sah Balamentum mit Browserleiste, die App selbst hatte kein Token und zeigte nach jedem Neustart die Login-Seite. Lokal gebaute Builds mit passendem Schlüssel liefen dagegen im Vollbild.

## Entscheidung

**1. Die App meldet sich nativ über den Android Credential Manager an.** Android zeigt die Google-Konten als eigenes Sheet, ein Browser öffnet sich nicht. Das ID-Token (Zielgruppe: der Web-Client `GOOGLE_CLIENT_ID`) löst die App über `POST /auth/native/google` gegen ein App-Token ein. Der Server prüft Signatur, Zielgruppe, Ablauf, bestätigte E-Mail und Freigabe.

**2. Beim Start ohne Sitzung versucht die App die Anmeldung selbst.** Ein schon genutztes Konto wird ohne Rückfrage gewählt, sonst erscheint das Konto-Sheet. Nach dem Abmelden unterbleibt der Versuch, auch über Neustarts hinweg.

**3. Der Custom Tab bleibt als Rückfallweg** (Android-OAuth-Client noch nicht eingerichtet, Gerät ohne Google-Dienste). Der Server leitet dann über das Custom Scheme `balamentum.app://auth/native?code=…` zurück. Dafür braucht es keine App-Link-Verifikation. Ältere App-Stände bekommen weiter den App Link.

## Verworfene Alternativen

- **Nur den Fingerabdruck in `assetlinks.json` nachtragen:** behebt den Rücksprung, der Login läuft aber weiter über einen Browser-Tab und hängt an einer Liste, die außerhalb der App von Hand gepflegt wird.
- **Fremdes Login-Plugin (`@capgo/capacitor-social-login`):** bringt weitere Anbieter und Abhängigkeiten mit, gebraucht wird nur Google. Das eigene Plugin hat rund 100 Zeilen.

## Konsequenzen

- In Google Cloud braucht es einen OAuth-Client vom Typ Android (Paket `balamentum.app`, SHA-1 des Play-App-Signaturschlüssels), dazu je einen für Upload- und Debug-Schlüssel ([Native Apps](../native-apps.md#anmeldung-in-der-app)).
- Magic-Links öffnen die App weiter über den App Link; `ANDROID_CERT_SHA256` muss deshalb auch den Play-App-Signaturschlüssel nennen.
- Der Server muss vor der App ausgeliefert sein; fehlt der Endpunkt, fällt die App auf den Custom Tab zurück.

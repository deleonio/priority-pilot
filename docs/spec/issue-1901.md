# Zustimmung zu Nutzungsbedingungen und Datenschutzerklärung

**Stand:** 2026-09-30

Nach dem Login sieht ein Konto ohne Zustimmung zur aktuellen Fassung einen Schritt mit zwei Haken, bevor die App erscheint. Neue Konten und Bestandskonten laufen über denselben Schritt; die Konto-Anlage selbst bleibt unverändert.

## Server

- Konstante `TERMS_VERSION` (`server/src/logics/legal.ts`) ist die einzige Quelle der aktuellen Fassung.
- `User` trägt `termsAcceptedAt` (Zeitpunkt) und `termsVersion` (Fassung), beide anfangs leer.
- `GET /auth/me` liefert `termsAccepted: boolean`: `true` nur, wenn `termsVersion === TERMS_VERSION`. Ohne Zustimmung oder mit älterer Fassung `false`. Im Pass-Through-Modus (kein Auth konfiguriert) immer `true`.
- `POST /auth/terms` mit Body `{ acceptTerms: true, acceptPrivacy: true }` speichert Zeitpunkt und aktuelle Fassung am eigenen Konto und antwortet `204`. Ohne Session `401`, ohne beide Bestätigungen `400` (nichts wird gespeichert).

## Frontend

1. Nach dem Login lädt `Root` den Nutzer. Ist `termsAccepted === false`, rendert `Root` statt der App die Komponente `ConsentStep` (fehlt das Feld, gilt der Nutzer als zugestimmt).
2. `ConsentStep` zeigt eine Überschrift (Ebene 1), zwei Haken („Ich akzeptiere die Nutzungsbedingungen", „Ich habe die Datenschutzerklärung zur Kenntnis genommen"), je Haken einen Aufklapp-Bereich „Nutzungsbedingungen lesen" bzw. „Datenschutzerklärung lesen" (siehe „Rechtstexte im Schritt lesen (#2227)") und den Knopf „Weiter".
3. „Weiter" ist bis zu beiden Haken deaktiviert. Danach ruft ein Klick `POST /auth/terms` auf; bei Erfolg folgt das Dashboard, bei Fehler bleibt der Schritt mit Fehlermeldung und gesetzten Haken.
4. Nach Neuladen kommt der Schritt nicht wieder (Server meldet `termsAccepted: true`).
5. Bei 375 px sind beide Haken und „Weiter" ohne Scrollen sichtbar; Bedienung per Tab und Leertaste/Enter.

## Rechtstexte im Schritt lesen (#2227)

Ersetzt die Links in neuem Tab. Je Rechtstext ein `KolDetails` (nicht im `<label>` des Hakens) mit Label „Nutzungsbedingungen lesen" / „Datenschutzerklärung lesen".

1. Erstes Aufklappen lädt same-origin `fetch('/nutzungsbedingungen/')` bzw. `fetch('/datenschutz/')`; Ergebnis wird gehalten, erneutes Aufklappen lädt nicht neu. Vorher kein Abruf. Beide Texte dürfen gleichzeitig offen sein.
2. Übernommen wird nur der Inhalt von `main#main` (Website-Kopf/-Fuß nicht); Überschriften werden um zwei Ebenen verschoben (h1 wird h3), damit der Schritt genau eine `<h1>` behält. Keine Kopie der Texte im Frontend.
3. Im Normalweg gibt es keinen Link mit `target="_blank"`. Ladefehler (Netzfehler oder Status ungleich 2xx): Hinweis mit `role="alert"` und Ausweichlink auf die Website-Seite in neuem Tab; der Schritt bleibt bedienbar.
4. Aufklappen/Zuklappen ändert weder Haken noch den Zustand von „Weiter"; Klick auf das Aufklapp-Label togglet keinen Haken. Speichern (`POST /auth/terms`) und Abmelden unverändert.
5. Bei 375 px: kein horizontaler Überlauf (lange Wörter umbrechen, Tabellen scrollen nur im eigenen Wrapper); Haken und „Weiter" bleiben erreichbar.

## Erwartetes Ergebnis

Neues Konto oder Bestandskonto ohne Zustimmung: Schritt genau einmal, danach Dashboard. Erhöhte `TERMS_VERSION`: Schritt erscheint erneut.

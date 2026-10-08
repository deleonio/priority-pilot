# ADR 0022 — Ende-zu-Ende-Verschlüsselung als Opt-in: Freitexte mit Passkey-Schlüssel

- **Status:** Proposed (2026-10-07)
- **Datum:** 2026-10-07
- **Kontext:** Issue #1923 (Teil von #2016), Lösungsplan [E2E-Verschlüsselung — Konzept](../e2e-verschluesselung-konzept.md), Anmeldung [docs/auth-setup.md](../auth-setup.md), Android [ADR 0021](0021-android-app-spa-ohne-service-worker.md)

## Kontext

Alle Nutzerdaten liegen im Klartext auf dem Server. Verschlüsselt ist nur das CalDAV-App-Passwort (`server/src/logics/secret-crypto.ts`, AES-256-GCM mit Server-Schlüssel). Nutzende sollen per Opt-in eine Ende-zu-Ende-Verschlüsselung einschalten können. Gesetzt sind vier Bedingungen: Opt-in mit Klartext als Standard, mehrere Geräte ohne Master-Passwort (Google-Login oder Magic Link reichen), Säulenvorschlag per KI und MCP arbeiten weiter mit den Aufgabeninhalten, Balance und Fürsorge-Pushes laufen wie bisher.

Die Bedingungen widersprechen sich teilweise. Echte E2E heißt: Der Server kennt den Schlüssel nie. KI-Vorschlag und MCP brauchen aber Klartext auf dem Server, und Google-Login oder Magic Link liefern kein Schlüsselmaterial, sondern nur eine Sitzung. Die Auflösung steckt in zwei Beobachtungen:

1. **Balance, Fürsorge und Priorisierung rechnen nicht mit Text.** `heartBalance.ts`, `careDeficit.ts`, `carePush.ts`, `pillarShares.ts` und `find.ts` brauchen Status, Aufwand, Fristen, Säulen-Beiträge und Zeitstempel. Titel, Beschreibungen, Notizen und Adressen lesen sie nicht.
2. **Passkeys mit WebAuthn-PRF-Erweiterung** liefern auf dem Gerät ein stabiles Geheimnis, ohne dass jemand ein Passwort tippt. Synchronisierte Passkeys (Google-Passwortmanager, iCloud-Schlüsselbund) bringen dieses Geheimnis auf weitere Geräte.

## Entscheidung

**1. Verschlüsselt werden die Freitexte, nicht die Struktur.** Titel, Beschreibung, KI-Entwurf und Checkliste der Aufgaben, Serienvorlagen, Journal- und Wissenseinträge, gespeicherte Adressen und Ortsnamen. Strukturdaten bleiben Klartext: Status, Aufwand, Prioritäten, Fristen, Säulen-Zuordnung und -Gewichte, Kategorie- und Säulennamen, Koordinaten, Zeitstempel. Die Funktionstabelle im Lösungsplan ordnet jede Funktion zu.

**2. Der Schlüssel entsteht und bleibt auf dem Gerät.** Beim Einschalten erzeugt das Gerät einen zufälligen Konto-Datenschlüssel (AES-256-GCM, WebCrypto). Der Server speichert ihn nur eingepackt (wrapped), je Freigabeweg ein Eintrag:

- **Passkey (Hauptweg):** Schlüssel zum Einpacken = HKDF aus dem PRF-Ergebnis eines Passkeys. Die Anmeldung bleibt Google oder Magic Link; der Passkey entsperrt nur die Inhalte und ist meist ein Fingerabdruck oder die Bildschirmsperre.
- **Gerätekopplung (Zweitweg):** Ein entsperrtes Gerät übergibt den Schlüssel per QR-Code und ECDH an ein neues Gerät, wenn dort kein synchronisierter Passkey vorhanden ist.
- **Wiederherstellungsschlüssel (Notweg):** Ein einmal angezeigter, zufällig erzeugter Code für den Verlust aller Geräte. Er wird nicht im Alltag eingegeben und ist kein Master-Passwort.

**3. Auswertung mit Text läuft mit Klartext vom Gerät.** Säulenvorschlag und KI-Entwurf bekommen den Text pro Anfrage vom entsperrten Gerät; der Server speichert ihn nicht, das Gerät verschlüsselt das Ergebnis. MCP bekommt eine ausdrückliche Schlüsselfreigabe je Token: Beim Anlegen des Tokens packt das Gerät den Datenschlüssel zusätzlich mit einem Geheimnis ein, das nur im Token steckt. Der Server entschlüsselt dann pro MCP-Anfrage kurzlebig im Speicher. Das ist für diesen Weg keine E2E-Verschlüsselung mehr und wird in der Oberfläche so benannt.

**4. Ein- und Ausschalten laufen auf dem Gerät.** Das entsperrte Gerät verschlüsselt beim Einschalten alle Freitexte in Stapeln, fortsetzbar; beim Ausschalten entschlüsselt es sie und schreibt Klartext zurück. Danach löscht der Server die eingepackten Schlüssel.

**5. Gruppen bleiben in der ersten Ausbaustufe Klartext.** Gemeinsame Inhalte bräuchten einen Gruppenschlüssel je Gruppe, den jedes Mitglied mit eigenem Schlüsselpaar empfängt. Das ist ein eigenes Vorhaben und wird erst bei Bedarf geplant.

## Verworfene Alternativen

- **Serverseitige Verschlüsselung mit getrennter Schlüsselhaltung** (Datenschlüssel je Konto, eingepackt von einem Server- oder KMS-Schlüssel, Muster `secret-crypto.ts`): Alle Funktionen laufen unverändert, Datenbank-Dumps und Backups wären geschützt. Kein E2E: Wer den laufenden Server kontrolliert, liest alles. Taugt als Grundschutz für alle Konten, erfüllt aber nicht das Ziel dieses Tickets.
- **Gerätekopplung als einziger Weg** (Muster verknüpfte Geräte bei Messengern): echtes E2E, aber ohne zweites Gerät gibt es keinen Einstieg, und nach Verlust aller Geräte sind die Daten weg. Bleibt als Zweitweg erhalten.
- **Alle Daten verschlüsseln, Berechnung nur auf dem Gerät:** echtes E2E für alles. Balance-Verlauf, Fürsorge-Pushes, Frist-Erinnerungen und Serien-Erzeugung laufen heute als Server-Jobs ohne geöffnetes Gerät; sie würden wegfallen. Widerspricht der Bedingung „Fürsorge und Balance wie bisher".
- **Master-Passwort mit Schlüsselableitung** (Muster Passwortmanager): bewährt und echtes E2E, aber von der Bedingung „kein zusätzliches Master-Passwort" ausgeschlossen.
- **Schlüssel aus Google-Login ableiten:** OAuth liefert kein geheimes, stabiles Schlüsselmaterial an das Gerät; was der Server von Google bekommt, kennt auch der Server. Kein E2E.

## Konsequenzen

- Echte E2E gilt für die Ablage der Freitexte. Für KI-Vorschlag und KI-Entwurf sieht der Server den Text während der Anfrage, für MCP nach ausdrücklicher Freigabe. Die Einstellungsseite sagt das offen.
- Wer alle Geräte, den synchronisierten Passkey und den Wiederherstellungsschlüssel verliert, verliert die Freitexte endgültig. Strukturdaten, Punkte und Balance bleiben erhalten.
- Push-Texte, Kalender-Feed und CSV-Export können verschlüsselte Titel nicht mehr auf dem Server einsetzen und werden umgebaut oder neutral formuliert.
- Feldlängen-Grenzen gelten für den Klartext auf dem Gerät; die Datenbankspalten müssen das längere Chiffrat aufnehmen.
- Die Android-App (ADR 0021) braucht Passkeys mit PRF über den Android Credential Manager; die Unterstützung im WebView ist vor der Umsetzung zu prüfen.
- Diese ADR ändert keinen Code. Die Umsetzung folgt dem Issue-Schnitt im Lösungsplan unter einem eigenen Epic.

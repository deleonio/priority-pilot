# E2E-Verschlüsselung als Opt-in — Konzept und Lösungsplan

Grundlage für [ADR 0022](adr/0022-e2e-verschluesselung-opt-in.md), Issue #1923. Die Entscheidung steht im ADR; hier stehen Vergleich, Funktionszuordnung, Wiederherstellung, Migration und der Issue-Schnitt.

## Ausgangslage

- Alle Nutzerdaten liegen im Klartext in der Datenbank. Einzige Ausnahme ist das CalDAV-App-Passwort (`server/src/logics/secret-crypto.ts`, AES-256-GCM, Schlüssel aus `CALDAV_ENCRYPTION_KEY`).
- Anmeldung per Google (`googleOidc.ts`) oder Magic Link (`magicLink.ts`); beides erzeugt eine Sitzung, kein Schlüsselmaterial. WebAuthn oder Passkeys gibt es im Code noch nicht.
- Server-Jobs ohne geöffnetes Gerät: Fürsorge-Push (`carePush.ts`), Frist-Erinnerungen (`dueTaskReminders.ts`, setzt Aufgabentitel in den Push), Serien-Erzeugung (`seriesAutoCreate.ts`), Orts-Push (`geo-background-job.ts`), Balance-Verlauf (`balanceHistory.ts`).

### Datenklassen

| Klasse              | Felder                                                                                                                                     | Wer liest sie auf dem Server                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| Freitext (Inhalt)   | Aufgabe: `title`, `description`, `aiDraft`, Checkliste, `address`; Serienvorlagen; Journal; Wissenseinträge; Ortsfavoriten (Name, Adresse) | KI-Vorschlag, KI-Entwurf, MCP, Push-Texte, Kalender-Feed, Export |
| Struktur (Rechnung) | Status, Aufwand, Priorität, Fristen, Säulen-Beiträge und -Gewichte, Abhängigkeiten, Zeitstempel, Punkte                                    | Balance, Fürsorge, Priorisierung (`find.ts`), Serien, Statistik  |
| Benennung (Ordnung) | Säulen- und Kategorienamen, Gruppenname und -beschreibung                                                                                  | Fürsorge-Push, Gruppen, Admin                                    |
| Ort (Rechnung)      | `latitude`, `longitude`                                                                                                                    | Orts-Push, „In der Nähe"                                         |

Die Freitexte sind das Schützenswerte und werden von keiner Rechnung gebraucht. Darauf baut die Entscheidung „Freitexte verschlüsseln, Struktur nicht".

## Lösungswege im Vergleich

| Weg                                                                                    | Echtes E2E                      | Vorteile                                                                                                    | Nachteile                                                                                                                      |
| -------------------------------------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **A. Serverseitig, getrennte Schlüsselhaltung** (Datenschlüssel je Konto, KMS-Hülle)   | nein                            | Alle Funktionen unverändert; schützt Dumps und Backups; Muster `secret-crypto.ts` vorhanden                 | Laufender Server liest alles; schützt nicht vor Betreiber oder Angreifer mit Serverzugriff                                     |
| **B. Clientseitiger Schlüssel, Passkey mit WebAuthn-PRF** (gewählt, mit C und Notcode) | ja, für die Ablage              | Kein Passwort; synchronisierte Passkeys bringen den Schlüssel auf neue Geräte; Entsperren per Fingerabdruck | PRF-Unterstützung je Browser und Passkey-Anbieter unterschiedlich; Android-WebView braucht Credential Manager; neuer Code-Pfad |
| **C. Gerätekopplung per QR und ECDH** (Zweitweg in B)                                  | ja                              | Funktioniert ohne Passkey-Sync; kein Passwort                                                               | Braucht ein entsperrtes Zweitgerät; allein keine Wiederherstellung nach Totalverlust                                           |
| **D. Alles verschlüsseln, Berechnung auf dem Gerät**                                   | ja, vollständig                 | Server sieht nichts außer Chiffrat                                                                          | Server-Jobs (Fürsorge, Fristen, Serien, Balance-Verlauf) fallen weg; widerspricht den Bedingungen                              |
| **E. Master-Passwort mit Schlüsselableitung**                                          | ja                              | Bewährt, geräteunabhängig                                                                                   | Durch die Bedingung „kein Master-Passwort" ausgeschlossen; vergessenes Passwort = Datenverlust                                 |
| **F. Kurzlebige Entschlüsselung mit Zustimmung** (Baustein in B für MCP)               | nein, für den freigegebenen Weg | MCP und andere Server-Zugriffe bleiben möglich, nur nach Freigabe                                           | Der Server hält während der Anfrage Klartext; Vertrauen in den Betreiber für diesen Weg                                        |

Weg A bleibt als späterer Grundschutz für alle Konten denkbar und schließt B nicht aus.

## Funktionen mit eingeschalteter Verschlüsselung

| Funktion                                                              | Stufe         | Begründung                                                                                                                                                                                                        |
| --------------------------------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Säulenvorschlag (`suggestPillars.ts`, `suggestInitialTasks.ts`)       | umgebaut      | Bekommt `title`/`description` schon heute im Request-Body. Das Gerät schickt den entschlüsselten Text; Anfragen, die gespeicherte Texte nachladen (Neuzuordnung `reassignTaskPillars.ts`), laufen über das Gerät. |
| KI-Entwurf (`taskAiDraft.ts`)                                         | umgebaut      | Der Server schreibt `aiDraft` heute selbst. Künftig liefert er das Ergebnis zurück, das Gerät verschlüsselt und speichert es.                                                                                     |
| MCP (`mcpInstructions.ts`, ADR 0012)                                  | umgebaut      | Je Token optionale Schlüsselfreigabe (Weg F). Ohne Freigabe liefert MCP Struktur und den Hinweis „Inhalt verschlüsselt". Mit Freigabe kein E2E für diesen Weg, die Oberfläche sagt das.                           |
| Balance (`heartBalance.ts`, `balanceHistory.ts`, `pillarShares.ts`)   | unverändert   | Rechnet nur mit Aufwand, Status und Säulen-Beiträgen.                                                                                                                                                             |
| Fürsorge-Push (`carePush.ts`, `careDeficit.ts`, `careSuggestions.ts`) | unverändert   | Bewertet Säulen-Defizite; Texte kommen aus festen Vorlagen und Säulennamen, die Klartext bleiben.                                                                                                                 |
| Frist-Erinnerung (`dueTaskReminders.ts`)                              | eingeschränkt | Der Push enthält heute Aufgabentitel. Mit Verschlüsselung neutraler Text („2 Aufgaben werden heute fällig"); der Titel erscheint nach dem Öffnen.                                                                 |
| Gruppen (`groups.ts`)                                                 | eingeschränkt | Gruppeninhalte bleiben Klartext (ADR 0022, Entscheidung 5). Die Oberfläche weist beim Teilen darauf hin.                                                                                                          |
| Suche und Priorisierung (`find.ts`, Aufgabenliste)                    | umgebaut      | Priorisierung rechnet mit Struktur und bleibt serverseitig. Textsuche läuft auf dem Gerät über die entschlüsselte Liste.                                                                                          |
| Geokodierung (`geocodeSearch.ts`, `reverseGeocode.ts`)                | eingeschränkt | Die Suchanfrage geht weiter über den Server an Photon/Nominatim, wird aber nicht gespeichert. Gespeichert wird die Adresse verschlüsselt; Koordinaten bleiben Klartext, damit „In der Nähe" und Orts-Push laufen. |
| Admin-Ansicht (`admin.ts`)                                            | unverändert   | Admins sehen Konto- und Abo-Daten wie bisher; Freitexte erscheinen als „verschlüsselt". Ein Datenschutzgewinn, kein Verlust.                                                                                      |
| Export (CSV `csv.ts`, Kalender-Feed `calendar-ics.ts`)                | umgebaut      | CSV-Export entsteht auf dem Gerät. Der abonnierbare Kalender-Feed läuft ohne Gerät und zeigt neutrale Titel („Aufgabe") mit Frist.                                                                                |

## Schlüssel und Geräte

- **Konto-Datenschlüssel:** 256 Bit zufällig, nur auf dem Gerät erzeugt. Als nicht exportierbarer `CryptoKey` in IndexedDB gehalten, solange das Gerät entsperrt ist.
- **Chiffrat-Format je Feld:** `e2e1.<keyId>.<iv>.<chiffrat>` (Base64). Das Präfix trennt Chiffrat sicher von Klartext und trägt die Version für spätere Schlüsselwechsel.
- **Eingepackte Schlüssel auf dem Server:** neue Tabelle mit Konto, Art (`passkey`, `device`, `recovery`, `mcp`), Kennung (z. B. Credential-ID), eingepacktem Schlüssel, Anlagedatum. Der Server kann keinen davon öffnen; Ausnahme ist die MCP-Freigabe, deren Geheimnis im Token steckt.
- **Neues Gerät:** Anmeldung wie heute. Ist ein synchronisierter Passkey vorhanden, entsperrt er die Inhalte direkt. Sonst Gerätekopplung oder Wiederherstellungsschlüssel. Bis dahin zeigt die App Struktur und den Hinweis „Inhalte gesperrt".

## Wiederherstellung nach Verlust aller Geräte

1. **Synchronisierter Passkey:** Wer den Passkey im Google-Passwortmanager oder iCloud-Schlüsselbund hält, meldet sich auf dem neuen Gerät beim Passkey-Anbieter an und entsperrt mit demselben Passkey. Das ist der Normalfall, ohne eigenes Zutun.
2. **Wiederherstellungsschlüssel:** Beim Einschalten zeigt die App einmal einen zufälligen Code (etwa 26 Zeichen, Gruppen zu vier) zum Ausdrucken oder Ablegen im Passwortmanager. Die Eingabe auf dem neuen Gerät entsperrt die Inhalte und legt dort einen neuen Passkey an.
3. **Beides verloren:** Die Freitexte sind nicht wiederherstellbar, auch nicht durch den Betreiber. Konto, Abo, Strukturdaten, Punkte und Balance bleiben. Die App bietet „Verschlüsselung zurücksetzen": Freitext-Felder werden durch einen Platzhalter ersetzt, ein neuer Schlüssel entsteht.

**Grenzen und Restrisiko:** Der Schutz hängt am Konto des Passkey-Anbieters; wer das Google- oder Apple-Konto übernimmt, kann den Passkey nutzen. Der Wiederherstellungsschlüssel ist ein Geheimnis zum Aufbewahren, kein Passwort für den Alltag, aber wer ihn findet, kann entsperren. Die Web-App wird vom Server ausgeliefert; ein kompromittierter Server könnte manipulierten Code ausliefern, der Schlüssel abgreift. Die gebündelte Android-App (ADR 0021) mildert das, weil ihr Code nur über ein Store-Release kommt.

## Einschalten und Ausschalten

**Einschalten (Migration bestehender Konten):**

1. Einstellungen → „Inhalte Ende-zu-Ende verschlüsseln". Ein Dialog erklärt die Stufen der Funktionstabelle und die Grenzen bei KI und MCP (Muster [sequenzielle Bestätigung](ux-pattern-sequential-confirmation.md)).
2. Das Gerät erzeugt den Datenschlüssel, legt einen Passkey mit PRF an und zeigt den Wiederherstellungsschlüssel. Erst nach Bestätigung, dass der Code gesichert ist, geht es weiter.
3. Das Konto wechselt in den Zustand `migrating`. Das Gerät lädt alle Datensätze mit Freitext, verschlüsselt sie und schreibt sie in Stapeln über einen Massen-Endpunkt zurück. Der Server nimmt in diesem Zustand für Freitext-Felder nur noch Chiffrat an.
4. Bricht der Vorgang ab (App geschlossen, Netz weg), setzt das Gerät beim nächsten Entsperren dort fort: Felder ohne `e2e1.`-Präfix sind noch offen. Am Ende wechselt das Konto auf `encrypted`.
5. Klartext-Altbestände in Backups bleiben bis zum Ablauf der Backup-Aufbewahrung bestehen. Die Einstellungsseite nennt die Frist.

**Ausschalten (Rückweg):**

1. Nur auf einem entsperrten Gerät. Bestätigung im selben Dialog-Muster.
2. Zustand `decrypting`, das Gerät entschlüsselt alle Felder und schreibt Klartext in Stapeln zurück, fortsetzbar wie beim Einschalten.
3. Danach löscht der Server alle eingepackten Schlüssel, MCP-Freigaben inklusive; das Konto steht wieder auf `plain`. Der Passkey bleibt beim Anbieter liegen und kann dort gelöscht werden.

## Lösungsplan — Issue-Schnitt

Alle Issues höchstens „Mittel". Sie entstehen nach Annahme des ADR mit dem Skill [Ticket-Baum](../.claude/skills/ticket-tree/SKILL.md) unter einem neuen Epic „E2E-Verschlüsselung als Opt-in" (Teil von #2016), mit nativen `blocked-by`-Beziehungen gemäß Spalte „Hängt ab von".

| Nr  | Issue                                                                                                       | Größe  | Hängt ab von | Welle |
| --- | ----------------------------------------------------------------------------------------------------------- | ------ | ------------ | ----- |
| 1   | Krypto-Kern im Frontend: Datenschlüssel, Feld-Chiffrat `e2e1.`, Ver- und Entschlüsseln mit WebCrypto        | Mittel | –            | 1     |
| 2   | Server: Tabelle der eingepackten Schlüssel, Konto-Zustand `plain`/`migrating`/`encrypted`/`decrypting`, API | Mittel | –            | 1     |
| 3   | Server: Chiffrat in Freitext-Feldern annehmen (Spaltenbreiten, Längenprüfung nur für Klartext)              | Klein  | 2            | 2     |
| 4   | Passkey mit PRF anlegen und Inhalte entsperren (Web)                                                        | Mittel | 1, 2         | 2     |
| 5   | Wiederherstellungsschlüssel erzeugen, anzeigen, eingeben                                                    | Klein  | 1, 2         | 2     |
| 6   | Lese- und Schreibpfade der Freitexte (Aufgaben, Serien, Journal, Wissen, Orte) transparent verschlüsseln    | Mittel | 1, 3, 4      | 3     |
| 7   | Einschalten: Dialog, Stapel-Migration, Fortsetzen nach Abbruch                                              | Mittel | 5, 6         | 4     |
| 8   | Ausschalten und „Verschlüsselung zurücksetzen"                                                              | Klein  | 7            | 5     |
| 9   | Gerätekopplung per QR-Code und ECDH                                                                         | Mittel | 4            | 3     |
| 10  | KI-Vorschlag, Neuzuordnung und KI-Entwurf mit Klartext vom Gerät                                            | Klein  | 6            | 4     |
| 11  | MCP-Schlüsselfreigabe je Token, Hinweis „Inhalt verschlüsselt" ohne Freigabe                                | Mittel | 2, 6         | 4     |
| 12  | Push-Texte und Kalender-Feed neutral bei verschlüsselten Konten                                             | Klein  | 2            | 3     |
| 13  | CSV-Export und Textsuche auf dem Gerät                                                                      | Klein  | 6            | 4     |
| 14  | Android: Passkey mit PRF über Credential Manager in der Capacitor-App                                       | Mittel | 4            | 3     |
| 15  | Benutzerhandbuch und Datenschutzhinweis zur Verschlüsselung                                                 | Klein  | 7, 11        | 5     |

Kritischer Pfad: 1/2 → 3 → 4 → 6 → 7 → 8. Vor Issue 4 und 14 ist zu prüfen, welche Browser und Passkey-Anbieter PRF zum Umsetzungszeitpunkt unterstützen; ohne PRF-Unterstützung bleiben Gerätekopplung und Wiederherstellungsschlüssel als Wege.

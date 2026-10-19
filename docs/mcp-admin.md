# Admin-MCP einrichten

Der Admin-Endpunkt `/mcp/admin/v1` beantwortet Verwaltungsfragen über einen MCP-Client, etwa „Wer ist Mitglied?“ oder „Welche Abos laufen?“. Er ist nur lesend und nur für Konten mit der Systemrolle `admin` erreichbar. Der Member-Endpunkt `/mcp/v1` bleibt davon getrennt, die öffentliche MCP-Anleitung der Website nennt den Admin-Endpunkt bewusst nicht. Hintergrund: [Spec #1338](spec/issue-1338.md), Schnittstelle IF-14 in [arc42](arc42.md).

## Voraussetzungen

- Konto mit der Rolle `admin` (siehe [Anmeldung & Zugang → Rollen](auth-setup.md#rollen)).
- Ein persönlicher API-Token. Ein Nur-Lese-Token reicht, das Paket spielt keine Rolle.

## Einrichten

1. In der App unter **Einstellungen → Nutzerverwaltung** die Admin-Adresse kopieren. Sie hat die Form `https://<domain>/api/v1/mcp/admin/v1`.
2. Unter **Einstellungen → API-Tokens** einen Token anlegen. Der Klartext erscheint nur einmal, also gleich sicher ablegen.
3. Den MCP-Client mit Adresse und Header `Authorization: Bearer <token>` verbinden. Beispiel Claude Code:

   ```sh
   claude mcp add --transport http balamentum-admin https://<domain>/api/v1/mcp/admin/v1 \
     --header "Authorization: Bearer <token>"
   ```

   Andere Clients brauchen dieselben zwei Angaben. Der Endpunkt spricht JSON-RPC 2.0 und nimmt nur `POST` an.

4. Prüfen, etwa mit „Welche Abos laufen gerade?“.

Ohne Client lässt sich der Zugang direkt testen. Die Antwort muss eine Liste mit `admin_…`-Werkzeugen enthalten:

```sh
curl -X POST https://<domain>/api/v1/mcp/admin/v1 \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Im Browser aufgerufen meldet die Adresse nur „Nicht eingeloggt.“: Der Browser schickt `GET` ohne Token.

## Werkzeuge

| Werkzeug                      | Liefert                                                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `admin_users_list`            | alle Konten: E-Mail, Anzeigename, Rolle, Paket, Anlagedatum, KI-Anfragen im Monat, Status des jüngsten Abos                          |
| `admin_user_subscriptions`    | Abo-Verlauf eines Nutzers (`userId` aus der Kontenliste): Anbieter, Paket, Status, Laufzeitende, `running`                           |
| `admin_subscriptions_summary` | Zählungen je Paket und Status, laufende Abos je Paket und Laufzeit, Zahlungsrückstände, gekündigt mit Restlaufzeit, Ende in 30 Tagen |
| `admin_allowed_emails_list`   | zugelassene Adressen mit Herkunft                                                                                                    |
| `admin_waitlist_list`         | Warteliste in Freischalt-Reihenfolge                                                                                                 |
| `admin_kpis`                  | Markteinführungs-Kennzahlen, `zeitraum` = `woche` oder `monat`                                                                       |
| `admin_care_wirkung`          | Wirkung der Fürsorge-Vorschläge, nur Summen                                                                                          |

Ein Abo läuft, wenn es `active`, `past_due` oder `suspended` ist oder gekündigt mit Laufzeitende in der Zukunft. `approval_pending` zählt nicht.

Nicht ausgeliefert werden Rechnungsadresse, Rechnungen, Geodaten, Kündigungsgrund und -E-Mail, externe Abo-IDs und Tokens. Ändern lässt sich über MCP nichts: Rollen, Abos und Warteliste bleiben der Nutzerverwaltung vorbehalten.

## Protokoll

Jeder Werkzeugaufruf schreibt eine Zeile `MCP-Admin { userId, tool, ok }` ins Serverlog (PM2), ohne Argumente und ohne Nutzdaten.

## Fehlerbilder

| Antwort                      | Ursache                                                       | Abhilfe                                                      |
| ---------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------ |
| 401 „Nicht eingeloggt.“      | Token fehlt, ist falsch, abgelaufen oder widerrufen           | neuen Token anlegen, Header `Authorization: Bearer …` prüfen |
| 403                          | Konto ist nicht (mehr) `admin`; die Rolle gilt je Anfrage neu | in der Nutzerverwaltung zum Admin ernennen lassen            |
| 403 „Ungültiger CSRF-Token.“ | `POST` ohne Token-Header                                      | Header `Authorization: Bearer …` mitsenden                   |
| 405                          | `GET` mit gültigem Token statt `POST`                         | Client auf Streamable HTTP (POST) stellen                    |
| „Nutzer nicht gefunden“      | `userId` existiert nicht                                      | Id aus `admin_users_list` nehmen                             |

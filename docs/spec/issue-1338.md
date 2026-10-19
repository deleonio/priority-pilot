# Spec #1338 - Separater MCP-Endpunkt für Administratoren (nur lesend)

## Ziel

Administratoren beantworten Fragen zu Mitgliedern, Abos und Warteliste über einen MCP-Client, ohne dass der Member-Endpunkt `/mcp/v1` Admin-Werkzeuge bekommt.

## Vorbedingung

Konto mit Systemrolle `admin` und persönlichem API-Token (Nur-Lese oder Lese-Schreib, jedes Paket).

## Schritte

1. Client verbindet sich mit `POST /mcp/admin/v1` (`initialize`, `tools/list`).
2. Client ruft ein Admin-Werkzeug auf (`tools/call`).

## Erwartetes Ergebnis

- `tools/list` liefert genau `admin_users_list`, `admin_user_subscriptions`, `admin_subscriptions_summary`, `admin_allowed_emails_list`, `admin_waitlist_list`, `admin_kpis`, `admin_care_wirkung`; `/mcp/v1` bleibt unverändert. (AK1)
- Member/Tester: 403 auf jede Methode; ohne oder mit ungültigem Token 401; eine Rückstufung wirkt ab dem nächsten Request. (AK2, AK3)
- Paket-Gate `mcp_read` gilt nicht: lesende `/admin/*`-Loopbacks sind davon ausgenommen. (AK4)
- Jedes Werkzeug spiegelt per GET-Loopback eine `/admin/*`-Route; kein Werkzeug ist schreibend. (AK5, AK8, AK9)
- `GET /admin/users/{id}/subscriptions` liefert je Abo `running`, unbekannte Nutzer-Id 404. (AK6)
- Neue Route `GET /admin/subscriptions/summary`: Zählung je Paket × Status, laufend je Paket × Laufzeit, überfällig, gekündigt mit Restlaufzeit, Ende in ≤ 30 Tagen. Laufend = `active`/`past_due`/`suspended` oder `cancelled` mit `currentPeriodEnd` in der Zukunft (`isSubscriptionRunning`, `server/src/models/subscription.ts`). (AK7)
- Keine Antwort enthält Rechnungsadresse, Rechnungen, Geodaten, Kündigungsgrund/-E-Mail oder externe Abo-IDs. (AK10)
- Jeder `tools/call` schreibt die Logzeile `MCP-Admin { userId, tool, ok }`. (AK11)
- Die Adresse steht nur in Einstellungen → Nutzerverwaltung. (AK13)

## Tests

`server/src/express/mcp-admin.test.ts`, `server/src/logics/aboUebersicht.test.ts`, `server/src/express/mcp-handshake.test.ts` (Block „Admin-Endpunkt“).

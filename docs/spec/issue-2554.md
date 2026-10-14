# Härtung der Typ-Assertions: Plan-Parser, Zeitzonen-Helfer, JSON-RPC-Validierung (#2554)

**Stand:** 2026-10-14

Quelle: #1561 F-44 und Issue #2554. Sechs Stellen degradieren unbekannte Werte still statt sie zu
melden: `as JsonRpcRequest` (`mcp/server.ts:55`), `as Plan` (`invoices.ts:181` und `:307` — ein
unbekannter Plan erzeugt heute eine 0-EUR-Rechnung) und drei kopierte Zeitzonen-Ternäre mit
`zeitzone as string` (`carePush.ts:225`, `monthlyRecapPush.ts:45`, `streakReminder.ts:53`). Ziel:
unbekannte Werte sind ein Fehler, die Kopien werden ein Helfer, die JSON-RPC-Validierung bleibt
ohne Assertion bestehen. AK1 (kein `as` mehr) bleibt Review-Grep, kein Test (ADR 0001 — String-Suche
als Change-Detector hat keine Zähne).

## Vertrag `parsePlan` (`logics/plans.ts`, AK2/AK3)

- `parsePlan(value: string): Plan | null` — bekannte Werte (`free`/`plus`/`pro`) bleiben erhalten,
  alles andere (Legacy `max`/`ultimate`, `''`, Unbekanntes) liefert `null`. Striktes Gegenstück zum
  stillen `effectivePlan` (→ `free`) für alle Kontexte, in denen ein unbekannter Plan ein Fehler ist.
  Kein Legacy-Fallback (AGENTS.md: kein Bestandskunden-Ballast).

## Vertrag `issueInvoiceForPeriod` (`logics/invoices.ts`, AK2)

- Gespeicherter Plan außerhalb von `PLAN_VALUES` → `throw` (Fehlermeldung nennt „Plan“ und den
  Wert). Es entsteht KEINE Rechnung — insbesondere kein `amountCents`-0-Beleg; Nummernreservierung
  und PDF-Bau rollen mit der Transaktion zurück.
- Mechanismus-Entscheidung (statt log-and-skip): `throw`, weil der Rückgabetyp `Promise<Invoice>`
  ein stilles Skip ohne Signaturbruch nicht erlaubt und die Aufrufer (`applyPaymentEvent` im
  PayPal-Webhook-Handler) Fehler bereits behandeln und loggen.

## Vertrag `confirmationFor` (`logics/invoices.ts`, AK3)

- Wird exportiert (der Vertragstest importiert sie) und nutzt denselben `parsePlan`: unbekannter
  Plan → `throw` statt Bestätigungszeilen mit Preis 0. Aufrufer sind abgesichert:
  `deliverInvoiceUnsafe` fängt ab (`console.error`), der Erzeugungspfad in `issueInvoiceForPeriod`
  rollt zurück.

## Vertrag `nutzerZeitzone` (`logics/streak.ts`, AK4)

- `nutzerZeitzone(value: string | null | undefined): string` — gültige IANA-Zone bleibt erhalten,
  `null`/`undefined`/`''`/ungültig liefern `'UTC'`. Ersetzt die drei kopierten Ternäre
  (`istGueltigeZeitzone(user.zeitzone ?? undefined) ? (user.zeitzone as string) : 'UTC'`). Das
  Verhalten der drei Push-Logiken bleibt unverändert — Regression ist die vorhandene Abdeckung in
  `carePush.test.ts`, `monthlyRecapPush.test.ts`, `streakReminder.test.ts` (bleibt grün).

## Vertrag MCP-Endpunkt (`mcp/server.ts`, AK5)

- Ungültige Nachricht (`jsonrpc !== '2.0'` oder `method` kein string) → JSON-RPC-Fehlerantwort
  `error.code = -32600` mit bestmöglicher `id` (string/number aus dem Body, sonst `null`) —
  Validierung ohne `as JsonRpcRequest`.
- Unverändert bleiben: `initialize`/`tools/list`/`tools/call` liefern `result` (HTTP 200),
  Notifications ohne `id` erhalten die stille 202-Quittung.
- Bestandsabsicherung: Das Fehlerverhalten existiert bereits; die Tests pinnen es, bevor die
  Type-Assertion entfernt wird — sie sind deshalb von Anfang an grün (kein Rot).

## Testfälle

| AK      | Datei                                             | Erwarteter Rot-Zustand                                                            |
| ------- | ------------------------------------------------- | --------------------------------------------------------------------------------- |
| AK2     | `server/src/logics/invoices-issue.test.ts`        | Assertion — heutiger Code legt die 0-EUR-Rechnung an (Missing expected rejection) |
| AK3     | `server/src/logics/invoices-consent-2329.test.ts` | fehlender Export `confirmationFor` (Modul-Load)                                   |
| AK4     | `server/src/logics/streak.test.ts`                | fehlender Export `nutzerZeitzone` (Modul-Load)                                    |
| AK2/AK3 | `server/src/logics/plans.test.ts`                 | fehlender Export `parsePlan` (Modul-Load)                                         |
| AK5     | `server/src/express/mcp-handshake.test.ts`        | Bestand — sofort grün (Pin vor der Assertion-Entfernung)                          |

AK1: grep-Beleg über die sechs Stellen in der PR-Beschreibung (Review-Check der Impl-Phase).

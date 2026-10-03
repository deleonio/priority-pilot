# Spec #1958 — Als Admin Rechnungen aller Nutzer einsehen und herunterladen

## Ziel

Der Admin sieht in der Nutzerverwaltung zu jedem Nutzer dessen Rechnungen (Nummer, Zeitraum,
Betrag, Status „Ausgestellt“) und lädt einzelne Rechnungen als PDF-Datei herunter. Die
Eigentümer-Routen `GET /billing/invoices*` bleiben exakt, wie sie sind (#1505/#1955); der
Admin-Zugriff läuft ausschließlich über neue `/admin`-Routen mit `requireRole('admin')` — Nutzer
ohne Admin-Rolle bekommen 403, nicht 404 (Admin-Endpunkte dürfen ihre Existenz zeigen).

## Voraussetzungen

- Invoice-Modell mit `pdfBytes` (#1955) und Rechnungslauf `issueInvoiceForPeriod` (#1495) —
  Test-Rechnungen entstehen über Abo + Rechnungslauf; PDF-Bytes liefert der Lauf selbst.
- Rollensystem admin/member/tester (#1566); `requireRole('admin')` als Route-Middleware
  (Muster `GET /admin/users` — bewusst KEIN pfadloses `router.use`).
- UI-Muster: Rechnungsliste im `KolDetails` + Anker-Download (`SubscriptionSection.tsx`),
  Zeilenmuster der Nutzerverwaltung (`AdminUsersSection.tsx`).

## Vertrag (Seams für die Umsetzung)

### Server — `createAdminRouter` (`server/src/express/routes/admin.ts`)

- `GET /admin/users/{id}/invoices` (nur Admin, sonst 403): Rechnungen des Nutzers `{id}` mit
  denselben Feldern wie `GET /billing/invoices` (`id`, `number`, `periodStart`, `periodEnd`,
  `amountCents`, `taxNote` — `InvoiceDto` aus `billingSubscriptions.ts`), Sortierung
  `periodStart DESC` (neueste zuerst). Nutzer ohne Rechnungen → 200 mit `[]`.
- `GET /admin/users/{id}/invoices/{invoiceId}/pdf` (nur Admin, sonst 403): das gespeicherte PDF —
  `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="<Nummer>.pdf"`,
  Body byte-identisch zu `pdfBytes` und damit zum Eigentümer-Download. 404, wenn die Rechnung
  unbekannt ist, keine `pdfBytes` trägt (Altrechnung) oder nicht zum Nutzer `{id}` auf der Route
  gehört (nichts über fremde Rechnungen verraten).
- OpenAPI-Vertrag + Client-Typen mitpflegen (`pnpm build:api`; Pfad-Assertions nach Muster
  `openapi-billing-subscriptions.test.ts` in der Impl-Phase ergänzen).

### Frontend

- `api.getAdminUserInvoices({ id })` (`frontend/src/api.ts`) — GET `/admin/users/{id}/invoices`
  (Muster `getAdminUsers`).
- `AdminUsersSection.tsx`: je Nutzer-Zeile ein `KolDetails` mit eindeutigem Label
  `Rechnungen von <DisplayName>` (viele gleichlautende Details müssen im Accessibility-Baum
  unterscheidbar bleiben). Lazy-Load beim ersten Aufklappen über `_on.onClick` (Eager-Fetch wäre
  N Requests): genau ein Fetch je Nutzer, gecacht. Vier gestaltete Zustände (KI-UX, Mobile-Regel 7):
  Laden (`KolSpin` mit `_label`), leer („Noch keine Rechnungen vorhanden.“ — Wortlaut wie
  `SubscriptionSection`), Fehler (`KolAlert` `_type="error"`), Erfolg (Liste in einer Spalte,
  mobile-first, Beträge tabellarisch ausgerichtet).
- Je Rechnung: Nummer, Zeitraum (`periodStart`–`periodEnd` lokal formatiert), Betrag
  (`formatEuro`), Status als Text-Label „Ausgestellt“ (festes Label — das Invoice-Modell hat kein
  Zahlungs-Status-Feld; damit ist die offene Frage der Triage entschieden) und Download-Aktion
  `data-testid="admin-invoice-download"` mit zugänglichem Namen `PDF <Nummer> herunterladen`
  (Anker-Muster `downloadInvoicePdf`, `href` auf die Admin-PDF-Route — Session-Cookie läuft mit,
  der Server liefert Content-Disposition).

## Szenarien (AK → Schritte → erwartetes Ergebnis)

- **AK1** Admin-Session ruft `GET /admin/users/{id}/invoices` eines Nutzers mit zwei Rechnungen:
  200, exakt die Felder/Ordnung der Eigentümer-Route (deep-equal), neueste zuerst. Member-Session: 403.
- **AK2** Admin ruft die PDF-Route derselben Rechnung wie der Eigentümer: 200, `application/pdf`,
  Content-Disposition mit Rechnungsnummer, Bytes identisch zum Eigentümer-Download. Altrechnung
  ohne `pdfBytes` → 404; Rechnungs-Id, die nicht zum Nutzer auf der Route gehört → 404; Member → 403.
- **AK3** Nutzerverwaltung: Ansicht klappt pro Nutzer auf (Lazy-Load, gecacht), zeigt Einträge mit
  Nummer, Betrag, „Ausgestellt“ und Download je Rechnung; Fehler- und Leerzustand wie oben.
- **AK4** Member-Session auf beiden Admin-Routen → 403; die Bestandstests zum Eigentümer-Scope in
  `billing-subscriptions.test.ts` (#1505 AK5, #1955 AK4) bleiben unverändert grün.
- **AK5** E2E bei 375px: Ansicht klappt auf, Einträge und Download-Anker sichtbar, alle
  Nutzerzeilen bleiben im Viewport (Bounding-Box-Prüfung, nie `scrollWidth` — die App-Shell
  clippt mit `overflow-x: hidden`).

## Testfälle

| TF  | AK  | Datei                                                                                 | Art              |
| --- | --- | ------------------------------------------------------------------------------------- | ---------------- |
| TF1 | AK1 | `server/src/express/admin-invoices.test.ts`                                           | API (node:test)  |
| TF2 | AK2 | `server/src/express/admin-invoices.test.ts`                                           | API (node:test)  |
| TF3 | AK4 | `server/src/express/admin-invoices.test.ts` + Bestand `billing-subscriptions.test.ts` | API              |
| TF4 | AK3 | `frontend/src/components/AdminUsersSection.test.tsx`                                  | Unit (Vitest)    |
| TF5 | AK5 | `frontend/e2e/admin-invoices.spec.ts`                                                 | E2E (Playwright) |

## Bewusste Dedup-Entscheidungen

- Eigentümer-Scope von `/billing/invoices*` (AK4) ist bereits durch `billing-subscriptions.test.ts`
  („nur eigene Rechnungen“, „fremde … 404“, #1955-PDF-Tests) abgesichert — keine Duplikate; die
  Bestandstests müssen unverändert grün bleiben.
- „Nicht-Admin ohne Rechnungsansicht“ (TF4) bekommt keinen eigenen Frontend-Test: Der Tab ist für
  Member unsichtbar und per Deep-Link unerreichbar (`issue-1300-admin-users.spec.ts`), der Server
  antwortet 403 (TF3) — bereits zweifach abgesichert.
- Ladezustand (`KolSpin`) bekommt keinen eigenen Test — Zwischenzustand ohne Eigeninteraktion;
  Fehler- und Leerzustand sind die bewertbaren Verträge.

## Offene Fragen

- Status-Spalte: „Ausgestellt“ als festes Text-Label (das Invoice-Modell hat kein
  Zahlungs-Status-Feld) — Triage und KI-UX beraten übereinstimmend so; ein echter Zahlungsstatus
  wäre ein eigenes Ticket (Modell + Anzeige).

# T6a: Abo-Datenmodell, Preise in Cent und Quartalsstaffel — Issue 1494

**Stand:** 2026-09-15
**Ziel:** Preise in `plans.ts` auf Ganzzahl-Cent mit Quartalsstaffel umstellen, PayPal-Plan-IDs netzlos gegen die Preise absichern, ein Abo-Datenmodell einführen und den Abo-Status in `/auth/me` ausliefern — ohne die Frontend-Darstellung zu brechen.

Diese Spezifikation beschreibt den Vertrag für T6a laut `docs/gesamtkonzept-monetarisierung.md:75-81` und der Autoren-Entscheidung in #1461 (siehe Harness-Kommentar von #1494).

---

## Journey: Preiskatalog liefert Cent-Beträge inkl. Quartalsstaffel

### Ziel

`GET /plans` liefert für jedes Paket alle drei Abrechnungszeiträume (`monthly`, `quarterly`, `yearly`) als Ganzzahl in Cent, exakt nach der Konzepttabelle.

### Vorbedingung

- `server/src/logics/plans.ts` exportiert `PlanPrice`/`PLAN_PRICES` bisher nur mit `monthly`/`yearly` in Euro (Ganzzahl).

### Vertrag

- `PlanPrice` führt `monthly`, `quarterly` und `yearly`, alle als Ganzzahl in Cent (AK1).
- Beträge (Cent): free 0/0/0, pro 799/2157/7670, max 1499/4047/14390, ultimate 2499/6747/23990 (AK2).
- `quarterly` = `round(monthly × 3 × 0.9)`, `yearly` = `round(monthly × 12 × 0.8)`, kaufmännisch gerundet (AK3).
- `GET /plans` reicht die Matrix unverändert über `getPlansCatalog()` durch (AK5); `openapi.yml:2812` und die generierten Client-Typen bekommen `quarterly` als Pflichtfeld — das ist **nicht** Teil dieser Spec-PR, sondern folgt in der Impl-Phase (Spec-PR-Scope: nur Tests + dieses Dokument).

### Testfälle

- `server/src/logics/plans.test.ts` — AK1-AK3 über `getPlansCatalog()`.
- `server/src/express/plans-pricing.api.test.ts` (neu) — AK5 über `GET /plans`.

---

## Journey: PayPal-Plan-IDs je Paket × Zeitraum

### Ziel

Jede kostenpflichtige Kombination aus Paket und Zeitraum (alle außer `free`) hat eine hinterlegte PayPal-Plan-ID; ein Test ohne Netzwerk und ohne echtes Secret prüft Vollständigkeit und Betragsübereinstimmung mit `PLAN_PRICES`.

### Vertrag

- Neuer Export `PAYPAL_PLAN_IDS: Record<Exclude<Plan, 'free'>, Record<'monthly' | 'quarterly' | 'yearly', { envVar: string; amountCents: number }>>`.
- `envVar` benennt den Namen der Umgebungsvariable, die zur Laufzeit die echte PayPal-Plan-ID trägt (z. B. `PAYPAL_PLAN_ID_PRO_MONTHLY`) — kein echtes Secret im Code, testbar ohne Netz (AK4).
- `amountCents` je Eintrag muss exakt dem zugehörigen `PLAN_PRICES[plan][period]` entsprechen — so schlägt ein Test an, sobald Anzeige und hinterlegte Plan-ID auseinanderdriften.
- `free` hat keinen Eintrag (kein Abo-Produkt für ein kostenloses Paket).

### Testfälle

- `server/src/logics/plans-paypal.test.ts` (neu, eigene Datei wegen Import-Absturz bei fehlendem Export) — AK4.

---

## Journey: Abo-Datenmodell

### Ziel

Ein Sequelize-Modell `Subscription` hält Anbieter, externe Abo-ID, Paket, Zeitraum, Status, aktuelle Periode und Rechnungsreferenz je Nutzer — ohne Beträge oder Zahlungsdaten zu speichern.

### Vertrag

- Neues Modell `server/src/models/subscription.ts` (Muster `apiToken.ts`: `userId`-Spalte ohne Sequelize-Assoziation, Filterung direkt über die Spalte).
- Felder: `userId` (Pflicht), `provider` (String, z. B. `'paypal'`), `externalSubscriptionId` (String), `plan` (String), `period` (`'monthly' | 'quarterly' | 'yearly'`), `status` (String, z. B. `'active'`), `currentPeriodEnd` (Date), `invoiceReference` (String, nullable).
- **Kein** Betrags- (`amount`, `amountCents`, `price`, `priceCents`) und **kein** Zahlungsdatenfeld (`cardNumber`, `paymentMethod`, `iban`) — der Preis lebt ausschließlich in `plans.ts`.
- Registrierung in `server/src/models/index.ts` (Muster: Import + Export, wie bei `ApiToken`).

### Testfälle

- `server/src/models/subscription.test.ts` (neu) — AK6: Anlegen/Lesen, Feld-Abwesenheitsprüfung für Beträge/Zahlungsdaten.

---

## Journey: Abo-Status in `/auth/me`

### Ziel

`GET /auth/me` liefert zusätzlich zu `plan` und `entitlements` den Abo-Status — in beiden Antwortpfaden (Pass-Through/anonym und angemeldet).

### Vertrag

- Neues Feld `subscription` im `/auth/me`-Antwortkörper.
- Kein Abo (kein passender `Subscription`-Datensatz, oder Pass-Through-Modus) → `subscription: null` (definierter Leerwert, AK7).
- Existiert ein Abo, enthält `subscription` mindestens `plan`, `period`, `status` und `currentPeriodEnd`.
- Beide Pfade in `server/src/express/routes/auth.ts` (`:299` anonym, `:341` angemeldet) müssen das Feld tragen.

### Testfälle

- `server/src/express/auth.test.ts` — AK7, angemeldeter Pfad (ohne/mit Abo, Abo-Zeile per rohem SQL-Insert wie beim `ai_usage`-Präzedenzfall, da `Subscription`-Modul noch nicht existiert).
- `server/src/express/auth-passthrough.test.ts` — AK7, Pass-Through-Pfad (`subscription: null`).

---

## Journey: Wahrheitsgemäßer Quellkommentar

### Ziel

Der Kommentar über `PLAN_PRICES` (`plans.ts:56`) beschreibt nach der Umstellung die tatsächliche Darstellung (Cent statt Euro) und referenziert die Konzepttabelle.

### Vertrag

- AK8 ist reine Dokumentation/Quellkommentar — kein Testfall, Sichtprüfung im Review.

---

## Journey: Frontend zeigt weiterhin korrekte Euro-Beträge

### Ziel

`PlansSection` zeigt nach der Cent-Umstellung des Servers weiterhin lesbare Euro-Beträge (z. B. „7,99 €“ für Pro monatlich) statt der rohen Cent-Zahl.

### Vertrag

- `frontend/src/components/PlansSection.tsx:69` formatiert `catalog.prices[key].monthly` (Cent) zu einem Euro-String mit zwei Nachkommastellen und Komma als Dezimaltrennzeichen (`799` → `"7,99 €"`, `0` → `"0,00 €"`).
- Zusätzliche Spalten für Quartal und Jahr sind in diesem Ticket **nicht** gefordert (AK9 grenzt das ausdrücklich ab) — nur die bestehende Monatszeile ändert ihr Zahlenformat.
- Randnotiz (kein AK, außerhalb des Scopes dieses Tickets): `frontend/src/components/PlanOfferDialog.tsx:68` zeigt ebenfalls einen rohen `${monthly} €`-Wert aus demselben Katalog und bekäme nach der Cent-Umstellung dieselbe Fehldarstellung — dafür existiert in #1494 keine AK, daher kein Test hier; siehe „Offene Fragen“ im PR-Body.

### Testfälle

- `frontend/src/components/PlansSection.test.tsx` (neu) — AK9: gemockter `/plans`-Katalog mit Cent-Beträgen, erwartete Ausgabe „7,99 €“ / „0,00 €“ / „24,99 €“.

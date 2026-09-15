# Spec — Issue #1496: T6c Buchungs- und Verwaltungsflow in den Einstellungen

Quelle: harness-Kommentar Issue #1496 (KI-ANALYSE + KI-UX). Server-Grundlage vollständig vorhanden
(T6d #1505, T6e #1506) — dieses Ticket ist reines Frontend.

## Ziel

`PlansSection` (Einstellungen) wird vom reinen Preis-Lesekatalog zum vollständigen
Buchungs-/Verwaltungsbereich: Buchen, Wechseln, Kündigen, Rechnungsliste, Abo-Status.

## AK1 — Buchen

Ein `KolButton` je (Paket × Zeitraum) ruft `POST /billing/subscriptions` mit `{plan, period}` und
navigiert bei Erfolg zur gelieferten `approvalUrl` (`window.location.href = approvalUrl`).

Test: `frontend/e2e/billing.spec.ts` — Klick auf den Buchen-Button für `pro`/`monthly`, Request-Body
geprüft, Navigation zur gemockten `approvalUrl` abgefangen (kein echter PayPal-Aufruf).

## AK2 — Drei Zeiträume, keine festen Beträge

Die Matrix zeigt monatlich/quartalsweise/jährlich nebeneinander, jeder Betrag kommt aus
`GET /plans` (`catalog.prices[plan][period]`, Cent, `formatEuro`-Konvertierung). Kein Preis ist im
Quelltext verdrahtet.

Test: `frontend/src/components/PlansSection.test.tsx` — gemockter Katalog mit drei
unterschiedlichen Beträgen je Zeitraum, alle drei erscheinen formatiert; ein aus dem Katalog
entfernter Betrag verschwindet ebenfalls (kein Fallback-Hardcode).

## AK3 — Wechsel/Kündigung mit Bestätigungsdialog

Bei laufendem Abo (`subscription !== null`) erscheinen zwei Aktionen, je hinter einem
Bestätigungsdialog (`Modal.tsx`-Muster):

- Wechsel → `POST /billing/subscriptions/change`; der Dialogtext nennt die Anrechnung des
  Restbetrags als Rabatt (Freitext). Liefert die Antwort eine `approvalUrl`, wird dorthin
  navigiert; sonst bleibt die Oberfläche im Wartezustand (AK4-Zustand).
- Kündigung → `POST /billing/subscriptions/cancel`, `_variant="danger"`-Bestätigungsbutton.

Der angezeigte Plan ändert sich in keinem Fall sofort — erst wenn `/auth/me` ihn liefert.

Test: `frontend/e2e/billing.spec.ts` — Dialog öffnet vor jedem Request, Dialogtext enthält den
Anrechnungs-Hinweis, Request-Pfad/-Body für beide Aktionen, Plananzeige bleibt bis zum nächsten
`/auth/me`-Mock unverändert.

## AK4 — Rückkehr-Wartezustand

Neuer Hook `useBillingReturnPoll(refresh, expectedPlan, currentPlan)` in `frontend/src/lib/usePlan.ts`:

- löst bei Mount **genau einen** sofortigen `refresh()`-Aufruf aus,
- schreibt **keinen** eigenen Plan-Wert (nur `refresh()` selbst schreibt über `usePlanState`),
- meldet `status: 'waiting'`, solange `currentPlan !== expectedPlan`,
- lädt danach in festen Abständen nach (Intervall via Parameter, Default 3000 ms), bis
  `currentPlan === expectedPlan` → `status: 'confirmed'`,
- bricht nach einer Obergrenze (Default 10 Versuche) mit `status: 'timeout'` ab, ohne weiter zu
  pollen.

Test: `frontend/src/lib/usePlan.test.ts` — Fake-Timer, `refresh`-Spy: genau 1 sofortiger Aufruf,
kein direktes `setState`/`storePlanMirror` durch den Hook selbst, Statuswechsel `waiting` →
`confirmed` sobald `currentPlan` (simuliert über Re-Render mit neuem Prop) übereinstimmt, `timeout`
nach der Obergrenze ohne weiteren Poll-Aufruf danach.
Zusätzlich ein E2E-Schritt in `billing.spec.ts` für den sichtbaren Wartezustand ("Zahlung wird
bestätigt", `KolAlert`).

## AK5 — Rechnungsliste

`GET /billing/invoices` als Liste (Nummer, Zeitraum, Betrag); leere Liste zeigt einen Leerzustand
(`data-testid="invoices-empty"`).

Test: `frontend/e2e/billing.spec.ts` — gefüllte und leere Liste je ein Szenario.

## AK6 — Abo-Status

Aktives Paket, Zeitraum, Periodenende, `pendingPlan`/`pendingPlanEffectiveAt`, `graceUntil` —
jedes Feld nur gerendert, wenn gesetzt; Werte unverändert aus `/auth/me` übernommen (kein
Ableiten/Nachrechnen im Frontend).

Test: `frontend/e2e/billing.spec.ts` — ein Szenario mit allen Feldern gesetzt, eines ohne
`pendingPlan`/`graceUntil` (Felder fehlen im DOM).

## AK7 — 375px ohne horizontalen Überlauf

Test: `frontend/e2e/billing.spec.ts` — Bounding-Box-Prüfung (`x + width <= 375`) statt
`scrollWidth` (App-Shell clippt `overflow-x`, Präzedenz `issue-1484-plan-badges.spec.ts`).

## Offene Fragen

- keine (laut harness-Kommentar bereits geklärt).

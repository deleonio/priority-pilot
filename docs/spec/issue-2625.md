# Issue #2625 — Dashboard: kein Layout-Sprung, wenn Karten nachladen

## Ziel

Selbstladende Dashboard-Karten (eigener API-Abruf im Mount-Effekt, Muster `StreakCard`) reservieren
ab dem **ersten Render** eine feste Höhe (Platzhalter in geladener Kartengröße, mobile-first 375 px).
Der Übergang Laden → Geladen wird hoehenneutral; alles unterhalb — insbesondere die gekoppelte
letzte Reihe `.dashboard-last-row` (Deadlines + Verpasst) — rutscht nicht mehr nach.

## Voraussetzungen

- Echte App gegen echtes Backend (Playwright-Webserver-Paar, Wegwerf-In-Memory-DB), Viewport 375×812.
- Eine verpasste Aufgabe (Deadline in der Vergangenheit) ist geseedet, damit die
  MissedTasksCard geladen Inhalt statt Leerzustand zeigt.
- Die fünf Selbstlader-Endpunkte (`/scores/streak`, `/scores/balance/history`, `/scores/milestones`,
  `/scores/missed`, `/scores/care-suggestions`, dazu `/scores/monthly-recap` und
  `/scores/yearly-recap` für die Fensterkarten) werden per `page.route` **zurückgehalten**, bis der
  Lade-Snapshot steht. Begründung: Der Ladezustand eigener App-Endpunkte ist im echten Ablauf nicht
  deterministisch messbar (Antworten in wenigen ms) — `page.route` dient hier ausschließlich der
  Timing-Kontrolle, die Antworten bleiben echt (Muster-Idee aus der Triage-Analyse).

## Schritte (E2E `dashboard-layout-shift.spec.ts`)

1. Selbstlader-Endpunkte per `page.route` zurückhalten (Antwort erst nach Freigabe).
2. Verpasste Aufgabe seeden, App öffnen, zum Dashboard-Tab wechseln.
3. **Lade-Snapshot** (ein atomarer `page.evaluate`-Aufruf, Muster #2578 aus
   `issue-1964-missed-area.spec.ts`): Bounding-Box (top/height/left/right) jedes Karten-Testid-Hosts
   plus Oberkante von `.dashboard-last-row` — gemessen, während alle Selbstlader-Antworten noch
   zurückgehalten werden (belegt durch den sichtbaren Streak-Lade-Hint).
4. Antworten freigeben, auf geladenen Inhalt je Karte warten (Testid-Marker bzw. verschwundener
   „wird geladen“-Text bei den Fensterkarten).
5. **Geladen-Snapshot** mit denselben Messgrößen in einem zweiten atomaren `page.evaluate`.

## Erwartetes Ergebnis

- **AK1** — Je selbstladender Karte (StreakCard, BalanceHistoryCard, MilestoneBadges,
  MissedTasksCard, CareHint sowie Weekly-/Monthly-/YearlyRecapCard innerhalb ihres Datumsfensters)
  gilt: die Karte ist bereits im Lade-Snapshot messbar (reservierte Höhe ab dem ersten Render —
  CareHint rendert heute `null` und erscheint erst nachträglich) und ihre Kartenhöhe unterscheidet
  sich zwischen Lade- und Geladen-Snapshot um **≤ 8 px**.
  - Fensterkarten (Woche/Monat/Jahr): Ist ihr Testid-Host in beiden Snapshots abwesend, ist das
    Fenster geschlossen — kein Messfall (AK3-Fall, Tagesunabhängigkeit des Tests).
- **AK2** — Die Oberkante (`.getBoundingClientRect().top`) von `.dashboard-last-row` unterscheidet
  sich zwischen Lade- und Geladen-Snapshot um **≤ 8 px** (Messung je Zeitpunkt in EINEM
  page.evaluate-Snapshot).
- **AK3** — Karten ohne Inhalt (WeeklyBalanceCard außer sonntags, MonthlyBalanceCard außer Tag 1–7,
  YearlyRecapCard außer im Januar, NearbyCard bei ausgeschalteter Standorterfassung, DayDoneHint
  ohne geschafften Tag, FreeTimeCard ohne freien Slot) rendern vom ersten Render an nichts und
  erscheinen nicht nachträglich. **Kein neuer Test** — Abdeckung dedupliziert über die bestehenden
  Dashboard-Specs (`dashboard-cards.spec.ts`, `dashboard-meter.spec.ts`,
  `issue-1964-missed-area.spec.ts` inkl. der #2578-Messung), die unverändert grün bleiben müssen.
- **AK4** — Keine gerenderte Karte (beide Phasen) ragt bei 375 px aus dem Viewport: Bounding-Box
  vollständig innerhalb [0, 375] px Breite (Bounding-Box-Prüfung statt `scrollWidth`, App-Shell
  clippt mit `overflow-x: hidden`).

## Messkontrakte für die Umsetzung

- Der Platzhalter füllt die **gesamte Kartenbreite** und ist innenliegend (keine festen
  Inhaltsbreiten) — dann trägt AK4.
- Der CareHint-Anker (`[data-testid="care-hint"]`) existiert ab dem ersten Render (Platzhalter
  trägt den Anker), damit die Messung am vorhandenen Vertragselement hängt.
- Bestehende Lade-Hints (Text-Hint bzw. `KolSpin` mit `_label`) bleiben in der reservierten Box
  sichtbar (mobile-ui-rules Regel 7) — der Test assertet den Streak-Lade-Hint als Ladezustands-Beleg.

## Offene Fragen

- (keine)

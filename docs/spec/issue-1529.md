# Pakete/Abo als eigene Settings-Reiter, Matrix als KolTableStateful

**Stand:** 2026-09-16

## Ziel

Die Sektion „Pakete“ verlässt den überfüllten „Allgemein“-Tab und bekommt zwei eigene,
direkt per URL ansteuerbare Settings-Reiter: „Pakete“ (Matrix, Preise, Buchen/Wechseln) und
„Abo“ (Status, Kulanzfrist, Kündigung, Rechnungen). Die Preis-Matrix wird von einer handgebauten
`<table>` auf `KolTableStateful` umgestellt (ADR 0014, Entscheidung 6): sie bleibt eine Tabelle,
scrollt bei schmalen Viewports seitlich in sich selbst, die Funktionsspalte bleibt dabei stehen.

## Voraussetzungen

- Angemeldeter Nutzer (Auth-Gate durchlässig).
- `GET /plans` liefert den Katalog, `GET /auth/me` Paket + Abo-Status (unverändert, kein DTO-Wechsel).

## Betroffene Bausteine

- `frontend/src/App.tsx:71` `BASE_SETTINGS_PATH_SEGMENTS` — wächst um `'pakete'` und `'abo'`,
  eingefügt HINTER `'kategorien'` und VOR den rollenabhängigen Segmenten (`'nutzer'` nur Admin,
  `'zugriff'` immer zuletzt), damit die bestehenden Indizes 0–5 stabil bleiben. Neue Segmentfolge:
  Member `general, pillars, llm, standort, gruppen, kategorien, pakete, abo, zugriff` (Indizes
  0–8); Admin zusätzlich `nutzer` zwischen `abo` und `zugriff` (Indizes 0–9), also unverändert
  unmittelbar vor `zugriff`.
- `frontend/src/components/SettingsPage.tsx:59-66` `BASE_SETTINGS_TABS` — zwei neue Einträge
  `{ _label: 'Pakete' }`, `{ _label: 'Abo' }` an derselben Position wie die Segmente oben (Index-
  Parität zu `App.tsx` ist Pflicht, siehe Fallstricke).
- `frontend/src/components/SettingsPage.tsx:372-375` — die KolCard „Pakete“ im Allgemein-Tab
  entfällt ersatzlos.
- `frontend/src/components/PlansSection.tsx` — bleibt der Name/Ort für den **Pakete**-Reiter
  (Matrix, Preise, Buchen/Wechseln); behält `data-testid="plans-section"`. Verliert die Abschnitte
  Abo-Status und Rechnungen.
- **Neu:** `frontend/src/components/SubscriptionSection.tsx` — **Abo**-Reiter: Abo-Status
  (`data-testid="subscription-status"`, `subscription-pending-plan`, `subscription-grace-until`),
  `cancel-subscription`, Rechnungsliste (`billing-invoices`, `invoices-empty`). Ohne laufendes Abo
  (`subscription === null`) zeigt sie statt Status/Kündigen einen Hinweis mit einer Bedienmöglich-
  keit, die zum Pakete-Reiter führt (barrierefrei erreichbarer Button mit sichtbarem Text
  „Pakete ansehen“, kein reiner Icon-Link).
- `frontend/src/app.css:3863-3873` `.plans-matrix` entfällt (KolTableStateful bringt eigenes
  Styling); keine neuen Hex-/Spacing-Werte, Preis-Spalten `font-variant-numeric: tabular-nums`.

## Vertrag der Matrix (`KolTableStateful`, Vorbild `CompletedTasksTable.tsx:117-202`)

- `_data`: **ein** flaches Array, eine Zeile je Periode×Preis (3), je Periode×Buchen (3) und je
  Feature (`catalog.features.length`) — **keine** Zeile liegt mehr im `<thead>`. Jede Zeile trägt
  den Spaltenschlüssel `label` (Zeilenbezeichnung, z. B. „Preis monatlich“, „Buchen jährlich“ oder
  `featureOffer(entry.feature).title`) sowie einen Wert je Paket-Spaltenschlüssel (`free`, `pro`,
  `max`, `ultimate` — dynamisch aus `Object.keys(catalog.prices)`). Zusätzlich ein privates,
  nicht als Spalte gerendertes Feld `_kind: 'price' | 'action' | 'feature'` (Muster `_task` in
  `CompletedTasksTable`-Zeilen) — unterscheidet die drei Zeilenarten im gemeinsamen Tabellenkörper.
- `_headers.horizontal[0]`: ein Eintrag `{ key: 'label', label: 'Funktion', width: <Zahl> }`
  gefolgt von einem Eintrag je Paket-Spalte, **jeder mit gesetzter `width` (Zahl, px)** — keine
  Spalte bleibt ohne feste Breite (AK3).
- `_fixedCols={[1, 1]}` **unabhängig vom Viewport** gesetzt (Abweichung vom `CompletedTasksTable`-
  Vorbild, das `_fixedCols` nur auf Desktop aktiviert — AK5 verlangt die stehende Funktionsspalte
  ausdrücklich auch bei 375px).
- `_label` ist gesetzt (Pflicht-Prop, zugänglicher Name der Scroll-Region, KolTableStateful macht
  sie selbst fokussierbar/pfeiltastenscrollbar, WCAG 2.1.1 — kein zusätzliches `tabindex`/`role`).
- DOM: `<KolTableStateful>` rendert als `<kol-table-stateful>`-Host mit eigenem Shadow-DOM (Vorbild
  `CompletedTasksTable.tsx`/`completed-tasks.spec.ts`) — der Host ist **direktes** Kind des
  `data-testid="plans-section"`-Wrappers (Locator-Muster `[data-testid="plans-section"]
kol-table-stateful`, analog `.completed-tasks kol-table-stateful`). e2e-Tests lesen ausschließlich
  über Playwright-Rollen-Locators (piercen offene Shadow-Roots nativ) oder eine schließungsfreie,
  rekursive `evaluate`-Durchquerung (`measureHorizontalScroll`/`scrollMatrixAndMeasureFirstCell`/
  `headerCellMetrics`, `frontend/e2e/helpers.ts`) — rohe CSS-Selektoren wie `table`/`th`/`td` finden
  im Shadow-DOM nichts, und `no-restricted-syntax` (`eslint.config.mjs:41-57`, Issue 824) verbietet
  `.shadowRoot`-Zugriff außerhalb von `helpers.ts` ohnehin.

## Akzeptanzkriterien

### AK1 — Eigene Routen mit URL-Rückschreibung

`/settings/pakete` rendert die Paket-Matrix (`data-testid="plans-section"`), `/settings/abo` den
Abo-Stand samt Rechnungsliste (`data-testid="billing-invoices"`); beide Segmente wählen den
zugehörigen Reiter, ein Reiterwechsel schreibt das Segment in die URL zurück.

### AK2 — Allgemein-Tab bereinigt, übrige Segmente unverändert

Die Karte „Pakete“ existiert unter `/settings/general` nicht mehr. `general`, `pillars`, `llm`,
`standort`, `gruppen`, `kategorien`, `nutzer` (Admin), `zugriff` wählen weiterhin denselben Reiter
wie vor der Änderung (Index-Parität).

### AK3 — Matrix als KolTableStateful mit gesetzten Spaltenbreiten

Siehe Vertrag oben: Preis-/Buchen-Zeilen im Tabellenkörper (`_data`), nicht im Kopf; jede Spalte in
`_headers.horizontal` trägt eine gesetzte `width`.

### AK4 — Seitliches Scrollen bleibt auf den Container begrenzt (375px)

Am Tabellen-Container ist `scrollWidth` größer als `clientWidth` (seitlich scrollbar), während an
`document.scrollingElement` `scrollWidth` höchstens `clientWidth + 1` ist (die Seite selbst scrollt
nicht mit).

### AK5 — Funktionsspalte bleibt beim Scrollen stehen (375px)

Nach seitlichem Scrollen des Containers (`scrollLeft = scrollWidth`) bleibt die linke Kante der
ersten Zelle der ersten Spalte innerhalb des sichtbaren Container-Bereichs.

### AK6 — Kopfzeilen brechen höchstens zweizeilig um

Keine `th`-Zelle der Tabelle ist höher als 2× `line-height` zzgl. vertikalem Padding — geprüft bei
375px und 1280px.

### AK7 — Abo-Reiter ohne laufendes Abo

Ohne laufendes Abo zeigt `/settings/abo` einen Hinweistext plus eine Bedienmöglichkeit („Pakete
ansehen“), die zum Pakete-Reiter führt; `subscription-status` und `cancel-subscription` sind dann
nicht im DOM.

### AK8 — Bestehendes Buchungsverhalten unverändert

Buchen, Wechseln, Kündigen funktionieren unverändert; alle bisherigen `data-testid` (`plans-section`,
`subscription-status`, `subscription-pending-plan`, `subscription-grace-until`,
`book-{plan}-{period}`, `change-plan-{plan}-{period}`, `cancel-subscription`, `billing-invoices`,
`invoices-empty`) bleiben erhalten und adressieren dieselben Elemente — nur der Ort (Pakete- bzw.
Abo-Reiter statt Allgemein) ändert sich.

## Testfälle

| TF  | AK  | Ebene  | Ort                                                                                                     |
| --- | --- | ------ | ------------------------------------------------------------------------------------------------------- |
| TF1 | AK1 | e2e    | `frontend/e2e/issue-1529-pakete-abo.spec.ts`                                                            |
| TF2 | AK2 | e2e    | `frontend/e2e/issue-1529-pakete-abo.spec.ts`                                                            |
| TF3 | AK3 | Vitest | `frontend/src/components/PlansSection.test.tsx`                                                         |
| TF4 | AK4 | e2e    | `frontend/e2e/issue-1529-pakete-abo.spec.ts`                                                            |
| TF5 | AK5 | e2e    | `frontend/e2e/issue-1529-pakete-abo.spec.ts`                                                            |
| TF6 | AK6 | e2e    | `frontend/e2e/issue-1529-pakete-abo.spec.ts`                                                            |
| TF7 | AK7 | e2e    | `frontend/e2e/issue-1529-pakete-abo.spec.ts`                                                            |
| TF8 | AK8 | e2e    | `frontend/e2e/billing.spec.ts` (umgezogen), `frontend/e2e/issue-1484-plan-badges.spec.ts` (Test-Pflege) |

## Abgrenzung

- `PlanBadge.tsx` bleibt unverändert (feuert weiter das CustomEvent, kein Link) — die Verlinkung der
  Badges nach `/settings/pakete` ist ein eigenes Thema (ADR 0014, Entscheidung 4), nicht Teil dieses
  Tickets.
- Die wachsende Tab-Leiste (bis zu 10 Reiter) bei 375px (Umbruch/horizontales Scrollen der Leiste
  selbst) ist ein von der UX-Beratung benanntes, separates Risiko — nicht Teil der Akzeptanz-
  kriterien dieses Tickets.

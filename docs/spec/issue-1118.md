# Issue 1118 — Dashboard-Sektionen als Kolibri-Cards mit Gleichhöhe

## Ziel

Jede inhaltliche Dashboard-Sektion wird als eigenständige `KolCard` gerendert — mit
Sektionsüberschrift als Card-Label (`_label`) statt separatem `<h3>` — und im
zweispaltigen Desktop-Layout schließen zwei nebeneinanderliegende Karten auf gleicher
Höhe ab. Auf schmalen Viewports bleibt die einspaltige, inhaltsgetriebene Darstellung
unverändert.

## Präkonditionen

- Dashboard-Tab der App geöffnet; Auth-Gate durchlässig (`fixtures.ts` mockt `/auth/me`).
- KoliBri-Web-Components hydriert (`waitForStableView`), damit `kol-card`-Hosts und
  deren Attribut-Reflexion (`_label`, `_level`) messbar sind.
- `KolCard._level` hat laut KoliBri-Spec Default **0** (= keine Überschrift) — die
  dritte Hierarchieebene muss explizit gesetzt werden (`_level={3}`).
- Die globale #930-Regel (`app.css`: `kol-card { background-color: transparent }`)
  macht den Card-Host transparent; die sichtbare Signalfäche von „Nächste Aufgabe"
  lebt daher im Shadow-DOM bzw. im Card-Inhalt — Tests messen den **effektiv
  gemalten Hintergrund** (Light-DOM + Shadow-DOM), nicht die Host-Property.

## Schritte / erwartetes Ergebnis

### AK1 + AK4 — je Sektion genau eine Card

Jede der sechs Sektionen `.dashboard-next-task`, `.dashboard-suggestions`,
`.dashboard-top-tasks`, `.dashboard-pillars`, `.dashboard-balance` und
`.dashboard-deadlines` enthält im DOM **genau ein** `kol-card`-Element. „In der Nähe"
(`NearbyCard`) bringt seine Card selbst mit und bleibt genau eine Card — es entsteht
kein `kol-card` in `kol-card`. Der bisherige Card-in-Card-Fall „Keine Säulen vorhanden"
(Leerzustand von „Meine Themen") entfällt als eigene Card: der Leerzustand steht als
Inhalt **in** der Sektions-Card.

### AK2 — Card-Label statt `<h3>`

Die Sektionsüberschrift steht als `_label` am jeweiligen `KolCard`; die Sektionen
rendern kein separates `<h3>` mehr (keine doppelte Überschrift im Accessibility-Tree).
`_level` ist so gesetzt, dass die Card-Überschriften als **dritte Ebene** unter dem
Dashboard-`<h2>` ausgelesen werden (`_level="3"`). Die Region „Nächste Aufgabe" bleibt
benannt (`aria-label` oder äquivalent, solange der verweisende Name „Nächste Aufgabe"
lautet). Die Kennzahlen-Kacheln (`_level={0}`) und die Begrüßung bleiben unangetastet.

### AK3 — Leerzustände innerhalb der Card

Sektions-Leerzustände („Keine anstehenden Deadlines.", „Aktuell stehen keine weiteren
Vorschläge an.", „Keine offenen Aufgaben vorhanden.", „Noch keine Punkte vergeben …",
Leerzustand „Meine Themen", „Aktuell steht keine Aufgabe an …") werden **innerhalb**
der jeweiligen Sektions-Card gerendert, nicht daneben.

### AK5 — Gleichhöhe im Desktop-Grid (1280 px)

Bei 1280 px Viewport stehen die sechs Sektions-Cards zweispaltig. Karten derselben
Grid-Zeile (identische Oberkante) haben identische rendernde Höhe
(`offsetHeight`-Differenz 0), auch wenn eine Karte z. B. 8 Listeneinträge und die
andere nur 3 enthält.

### AK6 — Mobil 375 px unverändert einspaltig

Bei 375 px stehen alle Sektions-Cards einspaltig untereinander in unveränderter
Reihenfolge (Nächste Aufgabe → Was ist jetzt dran? → Wichtigste Tasks → Meine Themen →
Gesamtguthaben → Anstehende Deadlines). Gemessen wird über Bounding-Boxen
(`el.x >= 0` und `el.x + el.width <= 375`); `document.documentElement.scrollWidth`
taugt in dieser App nicht als Messwert (App-Shell clippt mit `overflow-x: hidden`).

### AK7 — Volle Breite der Hauptaussagen

„Nächste Aufgabe", „Was ist jetzt dran?", die Kennzahlen-Kacheln und die Begrüßung
belegen im Desktop-Layout weiterhin die volle Grid-Breite (Bounding-Box-Breite ≈
Grid-Innenbreite, `grid-column: 1 / -1`).

### AK8 — Signalfäche und Bedienbarkeit erhalten

Die Signalfläche der Sektion „Nächste Aufgabe" bleibt sichtbar: mindestens ein
Element innerhalb der Region (Light-DOM oder Shadow-DOM) malt effektiv den
aufgelösten Wert von `--pp-signal-wash` als Hintergrund. Der Button „Jetzt starten"
bleibt per Tastatur fokussierbar und mit Enter auslösbar (Task-Status wechselt).

### AK9 — Gate

`pnpm lint`, `pnpm test` und Format-Check der Gate-Pipeline bleiben grün; die
bestehenden Dashboard-Specs (`dashboard-cards.spec.ts`, `dashboard-meter.spec.ts`,
`issue-1042-dashboard-start-button.spec.ts`) laufen unverändert grün. Kein eigener
Test — der Gate deckt das ab.

## Testfälle

- TF1/TF2 (Vitest, `Dashboard.test.tsx`): je Sektion genau ein `kol-card` mit
  `_label`/`_level="3"`, kein `<h3>`, Region benannt — AK1/AK2/AK4.
- TF3 (Vitest, `Dashboard.test.tsx`): Leerzustände innerhalb der Cards, kein
  Card-in-Card im „Meine Themen"-Leerzustand — AK3/AK4.
- TF4–TF9 (E2E, `issue-1118-dashboard-section-cards.spec.ts`): Cards je Sektion +
  kein Card-in-Card (AK1/AK4), Labels über Host-Attribut (AK2), Leerzustand in der
  Deadlines-Card (AK3), Gleichhöhe je Grid-Zeile bei 1280 px (AK5), einspaltig +
  Bounding-Box-Enthaltung bei 375 px (AK6), volle Breite (AK7), Signal-Wash +
  Tastaturbedienung (AK8).

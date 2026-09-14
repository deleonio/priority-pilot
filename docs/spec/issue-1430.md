# Spec #1430 — Hinweis-Badge in Aufgabenliste und Serienliste

> **Abgelöst durch #1465:** Das „Hinweis"-Badge sagte nicht, was es aussagt, und hatte mit der
> Lebensbalance nichts zu tun. An seiner Stelle steht in beiden Listen das Icon-Badge „Keine
> Säulen-Gewichtung gesetzt" (`PillarMissingBadge`). Die Beschreibung eines Eintrags erzeugt kein
> Badge mehr; die Tests dieser Spec sind entsprechend ersetzt.

**Issue:** #1430 · **Stand:** 2026-09-13 (Spec-Phase) · **Vertragstyp:** Anzeige-Vertrag (Frontend, kein API-Vertrag)

## Ziel

Ein Task mit nicht-leerem `description` bzw. eine Serie mit nicht-leerem `description` zeigt in der jeweiligen Listenzeile (`TaskTree`, `SeriesTab`) ein zusätzliches Text-Badge „Hinweis", ohne den Eintrag öffnen zu müssen. Kein Backend-Änderungsbedarf — `description` ist bereits Teil beider DTOs und wird über `taskById`/die Serien-Liste aufgelöst.

## Feste Annahmen

1. Leer = kein Badge: `null`, `undefined`, `''` und reiner Whitespace zählen alle als „kein Hinweis" (`(description ?? '').trim() !== ''`).
2. Die Regel „am Serien-Eintrag, nicht je Instanz" gilt nur für die Serienliste; eine generierte Instanz mit eigenem `description` zeigt das Badge in der Aufgabenliste ganz normal (kein Widerspruch).
3. Label lautet „Hinweis" (Text-Badge, WCAG 1.4.1 — nie nur Farbe).
4. Detailansichten (`TaskForm`, Serien-Bearbeiten-Dialog) und alle bestehenden Badges/Aktionen bleiben unverändert.

## Verhalten je Akzeptanzkriterium

### AK1 — Aufgabenliste zeigt Hinweis-Badge

**Voraussetzung:** Task mit `description` nach `trim()` nicht leer.
**Erwartetes Ergebnis:** Badge-Zeile in `TaskTree` zeigt zusätzlich `KolBadge` mit Label „Hinweis".

### AK2 — Kein Badge bei leerem Hinweis

**Voraussetzung:** Task mit `description` = `null`, `''` oder `'   '`.
**Erwartetes Ergebnis:** Kein „Hinweis"-Badge; übrige Badges (z. B. Priorität) bleiben unverändert vorhanden.

### AK3 — Serienliste zeigt Hinweis-Badge

**Voraussetzung:** Serien-Eintrag mit nicht-leerem `description`; zweiter Eintrag ohne.
**Erwartetes Ergebnis:** Nur der erste Eintrag zeigt in `div.series-tree-badges` das Badge „Hinweis".

### AK4 — Regression

**Erwartetes Ergebnis:** Bestehende Testsuiten (`TaskTree.test.tsx`, `SeriesTab.test.tsx`, `App.test.tsx`) bleiben grün, Detailansichten unverändert.

### AK5 — Mobile Umbruch (375px)

**Voraussetzung:** Task und Serie mit Hinweis, Viewport 375×812.
**Erwartetes Ergebnis:** Badge in beiden Listen sichtbar; Bounding-Box der Listenzeile liegt innerhalb der Viewport-Breite (kein `scrollWidth`-Vergleich, App-Shell clippt `overflow-x`).

## Testlandkarte

| AK      | Test              | Datei                                                    |
| ------- | ----------------- | -------------------------------------------------------- |
| AK1/AK2 | Vitest Komponente | `frontend/src/components/TaskTree.test.tsx` (erweitert)  |
| AK3     | Vitest Komponente | `frontend/src/components/SeriesTab.test.tsx` (erweitert) |
| AK4     | Regression        | bestehende Suiten (kein neuer Test)                      |
| AK5     | e2e mobile-first  | `frontend/e2e/issue-1430-hinweis-badge.spec.ts` (neu)    |

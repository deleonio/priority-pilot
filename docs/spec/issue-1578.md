# Spec: Issue #1578 — Aufgabenformular: Felder werden durch Paket-Hinweise verengt/abgeschnitten

Quelle: harness marker comment (KI-ANALYSE, stand=2026-09-20T19:09:50Z).

## Ausgangslage

Die Titel- und Beschreibungs-Zeile im Aufgabenformular sind je ein
`display:flex; flex-wrap:wrap`-Container (`TaskForm.tsx:1001`, Pendant `TaskForm.tsx:1365`). Der
Feld-Wrapper darin trägt `{ flex: 1, minWidth: 0 }` (`TaskForm.tsx:1002`, `TaskForm.tsx:1366`).
`minWidth: 0` erlaubt dem Feld, beliebig weit unter seine Min-Content-Breite zu schrumpfen — die
Wrap-Zeile bricht dadurch nie um. `PlanBadge` (`inModal`, `PlanBadge.tsx:83-88`) und der
Lektorat-Button (`flexShrink: 0`, `TaskForm.tsx:1058`/`1417`) behalten ihre Breite, das Eingabefeld
gibt die gesamte restliche Breite allein ab — auf schmalen Viewports wird es dadurch zu schmal
oder abgeschnitten.

`.plan-badge` selbst ist bereits umbruchfähig (`flex-wrap: wrap; max-width: 100%`,
`app.css:4578-4591`, #1528) — das Umbruchprinzip existiert, es fehlt nur die Umbruchschwelle in
der Formularzeile.

## Erwartetes Verhalten (AK1–AK6)

- **AK1:** Bei 375px Viewport ist im Aufgabenformular (anlegen UND bearbeiten) mit sichtbarem
  Paket-Hinweis die Breite des Titel-Eingabefelds mindestens 90 % der Innenbreite des umgebenden
  Zeilencontainers; dasselbe gilt für das Beschreibungsfeld.
- **AK2:** Bei 375px liegt jede Bounding-Box von Titelfeld, Beschreibungsfeld, Paket-Hinweis und
  Lektorat-Button vollständig im Bereich `x >= 0` und `x + width <= 375`.
- **AK3:** Bei 375px liegt die Oberkante des Paket-Hinweises unterhalb der Unterkante des
  zugehörigen Eingabefelds (Umbruch in eine eigene Zeile) — für Titel und Beschreibung.
- **AK4:** Bei 1280px bleibt die heutige Anordnung erhalten: Paket-Hinweis und Lektorat-Button
  stehen auf derselben Zeile wie das Feld (Oberkante des Hinweises oberhalb der Unterkante des
  Felds).
- **AK5:** Die Säulen-Kopfzeile (`.pillar-editor-head`) läuft bei 375px nicht über
  (`x + width <= 375` für Paket-Hinweis und Button „Säulen vorschlagen").
- **AK6 (Regression #1484/#1527):** Ohne aktive KI (`aiEnabled === false`) rendert die
  Titel-/Beschreibungs-Zeile unverändert nur das Feld — kein Paket-Hinweis, kein Lektorat-Button,
  keine leere Zeile. Dieses Verhalten liefert bereits die bestehende `{aiEnabled && (...)}`-Kapselung
  (`TaskForm.tsx:1042`/`1401`) und wird von keiner der AK1–AK5-Änderungen berührt (die Änderung
  bleibt auf den Feld-Wrapper innerhalb des bereits gegateten Zweigs beschränkt) — kein neuer Test,
  siehe „Testfälle".

## Umsetzung (Implementierungsphase, hier nur als Kontrakt)

`TaskForm.tsx:1002` und `TaskForm.tsx:1366`: Umbruchschwelle statt unbegrenztem Schrumpfen, z. B.
`flex: '1 1 16rem'` mit `minWidth: 'min(100%, 16rem)'` statt `minWidth: 0`. Kein Eingriff in
`PlanBadge` nötig.

## Testfälle

- **AK1/AK2/AK3/AK5:** Acceptance-E2E `frontend/e2e/issue-1578-taskform-plan-badge.spec.ts` —
  Aufgabenformular öffnen (anlegen und bearbeiten), `setViewportSize({ width: 375, height: 812 })`,
  Bounding-Box-Messung an `[data-testid="task-title"]`/`[data-testid="task-description"]`,
  `[data-testid="plan-badge-ai_assist"]` und dem Lektorat-Button (Muster
  `issue-1159-taskform-layout.spec.ts:171-210`, `issue-1484-plan-badges.spec.ts:101-122`).
- **AK4:** dieselbe Datei, `setViewportSize({ width: 1280, height: 900 })`.
- **AK6:** kein dedizierter neuer Test — das Verhalten ist heute bereits erfüllt (bestehende
  `aiEnabled &&`-Kapselung, unverändert durch diesen Fix) und wird durch den Bestandsblock
  `TaskForm.test.tsx:2580` („Paket-Badge bei Lektorat und Säulen-Vorschlag (#1484 AK3)") sowie
  `issue-1527`-Tests indirekt gegen Regressionen abgesichert (kein Eingriff in die Gate-Bedingung
  selbst).

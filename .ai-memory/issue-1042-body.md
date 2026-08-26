IST:

<img width="1342" height="640" alt="Image" src="https://github.com/user-attachments/assets/d9c9fae8-b76e-4d65-8a20-684e3f90d927" />

Wie bei allen anderen Schaltern bitte im Desktop normale Breite und nur im Mobil volle Breite.

<!-- KI-ANALYSE:START stand=2026-08-26T10:54:29Z -->

### Umsetzungskontext

- Konkretisierung des Autors (Kommentar 2026-08-26): Es geht um den Schalter **„Jetzt starten"** auf der **Dashboard-Seite** (Signal-Panel „Nächste Aufgabe").
- Betroffene Dateien: `frontend/src/app.css` (Block `.dashboard-next-task-content`, ab Zeile 517), neuer e2e-Test unter `frontend/e2e/`
- Betroffene Komponenten: `KolButton` „Jetzt starten" in `frontend/src/components/Dashboard.tsx:184-189`, Container `.dashboard-next-task-content`
- Root Cause: `.dashboard-next-task-content` ist `display: flex; flex-direction: column` (`frontend/src/app.css:517-521`). Der KoliBri-Host erbt als Flex-Item den Default `align-self: stretch` und füllt damit auf JEDER Breite die Container-Innenbreite — auf dem Desktop unerwünscht.
- Vorhandenes Muster: `frontend/src/app.css:1441-1452` `.settings-action-btn` — mobil `align-self: stretch`, ab `@media (min-width: 768px)` `align-self: flex-start` (#1017/#932). Zweites Muster: `.update-prompt kol-card kol-button` (`frontend/src/app.css:1583-1600`, #1034).
- Lösungsweg: CSS-only, analog `.settings-action-btn` — Regel auf `.dashboard-next-task-content kol-button` (Selektor-Scoping wie bei `.update-prompt kol-card kol-button`, keine Änderung an `Dashboard.tsx` nötig): Default `align-self: stretch`, ab `min-width: 768px` `align-self: flex-start`. Breakpoint 768px = `48rem`, wie im Rest der Datei.
- Randbedingungen: KoliBri `_inline` NICHT verwenden (entfernt den 44px-Touch-Target, Mobile-UI-Regel 2). Paddings/Höhe des KoliBri-Defaults unangetastet lassen. Signal-Panel-Farben (`--pp-signal*`, P1-1) und die Reihenfolge Titel/Priorität/Button bleiben unverändert. Der Button rendert nur, wenn `onStartTask` gesetzt und eine nächste Aufgabe vorhanden ist.
- Erwartetes Ergebnis: Bei 375px füllt „Jetzt starten" die Panel-Innenbreite; ab 768px ist er inhaltsbreit und linksbündig unter der Priorität-Zeile.

### Akzeptanzkriterien

- AK1: Bei Viewport 375px ist die Breite des Buttons „Jetzt starten" gleich der Innenbreite von `.dashboard-next-task-content` (Toleranz 2px).
- AK2: Bei Viewport 1280px ist der Button deutlich schmaler als die Container-Innenbreite (< 60 %) und linksbündig (linke Kante bündig mit der Kante von `.dashboard-next-task-title`, Toleranz 2px).
- AK3: Die Touch-Target-Höhe des Buttons bleibt bei 375px >= 44px.
- AK4: Keine Regression an den bereits umgesetzten Buttons — `frontend/e2e/settings-action-buttons.spec.ts` bleibt grün.

### Testfälle

- Zu AK1/AK2/AK3: Akzeptanz-e2e `frontend/e2e/issue-1042-dashboard-start-button.spec.ts` (Stil `settings-action-buttons.spec.ts`): Dashboard mit mindestens einer offenen Aufgabe laden, Button per `getByRole('button', { name: 'Jetzt starten' })` greifen, `boundingBox()` gegen die Bounding-Box von `.dashboard-next-task-content` messen — je ein Testfall für 375px (voll, Höhe >= 44px) und 1280px (schmal + linksbündig).
- Zu AK4: bestehender e2e-Lauf `frontend/e2e/settings-action-buttons.spec.ts`, unverändert.

### Ampel

- Ampel: 🟢
- Begründung: Ort und Zielverhalten sind nach der Autoren-Antwort eindeutig, das Muster existiert zweifach im Repo, die Änderung ist CSS-only und in einem PR umsetzbar; AK sind per Bounding-Box messbar.

### ❓ Offene Fragen

- keine

<!-- KI-ANALYSE:END -->

<!-- ai-phase-routing:START -->

| Phase  | Run | Modell | Effort |
| ------ | --- | ------ | ------ |
| ux     | ja  | haiku  | low    |
| spec   | ja  | sonnet | medium |
| impl   | ja  | sonnet | medium |
| review | ja  | sonnet | low    |

<!-- ai-phase-routing:END -->

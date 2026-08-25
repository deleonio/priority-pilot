## Ist-Zustand

<img width="1322" height="488" alt="Image" src="https://github.com/user-attachments/assets/74ca8566-bc11-4175-a9ec-1adfe3c02379" />

Im Tab „Wald“ stehen die Aufgaben-Cards (`.forest-node-card`) nur mit ca. 12 px vertikalem Abstand übereinander (`margin-bottom: var(--pp-gap-tight)` plus `li`-Margin) — sie wirken gedrängt.

## Soll-Zustand

Die Aufgaben-Cards im „Wald“ erhalten deutlich mehr vertikalen Abstand zueinander, damit sie optisch klar getrennt wahrgenommen werden.

<!-- KI-ANALYSE:START stand=2026-08-25T15:10:25Z -->
### UI-Bezug
- UI-Bezug: ja
- Begründung: Reine Frontend-Layout-Änderung am sichtbaren „Wald“-Tab (`ForestPanel`, `KolCard`-Hosts).

### Spec
- Spec nötig: ja
- Begründung: Betrifft Anwendungscode (`frontend/src/app.css`, `frontend/e2e/**`); UI-Bezug erzwingt die Spec zusätzlich.

### Aufwandsklasse
- Aufwandsklasse: haiku
- Begründung: Eine CSS-Regel (`.forest-node-card`) plus eine e2e-Abstandsmessung — Muster und Tokens sind im Code vorhanden.

### Umsetzungskontext
- Betroffene Dateien: `frontend/src/app.css`, `frontend/e2e/issue-704-tree-layout.spec.ts`
- Betroffene Komponenten: `ForestPanel`/`TreeNode` (frontend/src/components/ForestPanel.tsx) — rendern `KolCard` mit Klasse `forest-node-card`; CSS-Regeln `.forest-node-card` (app.css:793) und `.forest-panel li` (app.css:784)
- Vorhandenes Muster: `frontend/src/app.css:118-119` — Spacing-Tokens (`--pp-gap-tight` = 0.5rem, `--pp-gap-base` = 1rem); Empfehlung: `margin-bottom` auf `var(--pp-gap-base)` heben. E2E-Abstandsmessung: `issue-704-tree-layout.spec.ts:280-286` (boundingBox vertikale Distanz).
- Randbedingungen: Bestehende 704-e2e (vertikaler Abstand ≥ 20 px zwischen forest-nodes) muss grün bleiben (wird durch mehr Abstand nur leichter erfüllt); Einrückung/Hierarchie (24 px pro Ebene, `marginLeft` in ForestPanel.tsx) unangetastet; kein horizontaler Scroll bei 375 px (Spacing nur vertikal); Dark-Mode unverändert, da Token-basiert.
- Erwartetes Ergebnis: Auf dem Wald-Tab haben zwei aufeinanderfolgende Top-Level-Aufgaben-Cards einen klar sichtbaren vertikalen Zwischenraum (≥ 24 px statt bisher ~12 px), ohne dass sich Einrückung oder Horizontallayout ändern.

### Akzeptanzkriterien
- AK1: Given der Wald-Tab zeigt ≥ 2 oberste Aufgabenbäume, When die Cards dargestellt werden, Then beträgt der vertikale Leerraum zwischen aufeinanderfolgenden Top-Level-Cards (Lücke zwischen boundingBox-Unterkante der oberen und Oberkante der unteren) mindestens 24 px.
- AK2: Given ein 375-px-Viewport, When der Wald-Tab geöffnet ist, Then entsteht kein horizontaler Scroll (alle `forest-node-*`-Bounding-Boxen bleiben innerhalb des Viewports).
- AK3: Given verschachtelte Aufgaben (`.forest-node-children`), When der Abstand erhöht wird, Then bleiben Einrückung und Hierarchie-Darstellung unverändert (bestehende Tests aus `issue-704-tree-layout.spec.ts` grün).

### Testfälle
- AK1 → e2e: Neue Abstandsmessung nach Muster `issue-704-tree-layout.spec.ts:280-286` (boundingBox zweier `forest-node-*`-Testids), Lücke ≥ 24 px — z. B. eigener Fall in `frontend/e2e/issue-704-tree-layout.spec.ts` oder neue Spec-Datei.
- AK2 → e2e: Mobile-Viewport 375 px, Bounding-Box-Prüfung (Muster `task-tree.spec.ts` AK-6 / `tabs-viewport.spec.ts`).
- AK3 → Regression: bestehende `frontend/e2e/issue-704-tree-layout.spec.ts` bleibt ohne Anpassung grün.

### Ampel
- Ampel: 🟢
- Begründung: Anforderung eindeutig, betroffene Datei und Regel bekannt, in einem PR machbar, AKs über bestehendes boundingBox-e2e-Muster prüfbar.

### ❓ Offene Fragen
- [ ] Zielabstand nicht quantifiziert („etwas“) — Vorschlag 1 rem (`--pp-gap-base`), per Token leicht austauschbar, daher nicht blockierend.
<!-- KI-ANALYSE:END -->

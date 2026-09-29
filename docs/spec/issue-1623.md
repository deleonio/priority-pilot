# Issue 1623 — Abstand zwischen den Aktions-Buttons im „Weitere Aktionen"-Popover (K2)

> **ZURÜCKGENOMMEN (27.09., PR #1750):** Die Umsetzung (JS-Gap-Write in den
> Shadow-DOM, `setToolbarActionGap`) wurde auf Anwenderentscheidung entfernt —
> das „Weitere Aktionen"-Popover rendert wieder vollständig out of the box
> (`KolPopoverButton` + `KolToolbar` ohne JS-Stil-Injektion). Der 0px-Abstand
> des aktiven Default-Themes ist akzeptierter Zustand; AK1 entfällt, AK2
> (44px-Touch-Targets) liefert KoliBri selbst. Nur KERN_V2 hätte einen
> Theme-Gap — es ist aber nicht das aktive Theme.

## Ziel

Bei 375px Viewport haben die sechs Aktions-Buttons im geöffneten „Weitere
Aktionen"-Popover der Aufgabenzeile (Erledigt, Bearbeiten, Abhängigkeiten,
Unteraufgabe anlegen, Anpinnen/Abpinnen, Löschen) mindestens 8px horizontalen
Abstand zueinander — heute 0px (Bounding-Boxen x=45/89/133/177/221/265,
`TaskTree.tsx:219-311`). Die Kopf-Toolbar (`.app-header__primary kol-toolbar`,
#965) und die sequenzielle Lösch-Bestätigung (#Bestand) bleiben unverändert.

K1 (Access-Token-Karte zeigt Fehler und Leer-Zustand gleichzeitig) ist NICHT
Scope dieses Tickets — eigenes Bug-Ticket #1646.

## Ausgangslage

- `frontend/src/components/TaskTree.tsx:219-317` — `.task-tree-actions` umschließt
  `KolPopoverButton` → `KolToolbar` mit 6 icon-only Items, `_orientation="horizontal"`.
- `frontend/src/app.css:1968-1976` — `.task-tree-actions` selbst (Flex-Container um
  den Popover-Trigger); kein Gap-Hebel für die Toolbar-Buttons IM Popover.
- `frontend/src/app.css:2963-2967` — `@property --button-group-gap { initial-value: 8px }`
  ist bereits global registriert (für `kol-tabs`/`.app-header__primary kol-toolbar`,
  #1274/#1529/#965) — wirkt auf JEDE `kol-toolbar`, nicht nur die Popover-Toolbar.
  Die Kopf-Toolbar bei 375px bleibt einzeilig mit sechs 44px-Aktionen
  (`frontend/e2e/mobile-shell.spec.ts`, `frontend/e2e/header-toolbar.spec.ts`) —
  diese Wächter dürfen durch die K2-Änderung nicht rot werden.
- `frontend/e2e/issue-1186-popover-focus-outline.spec.ts` — bestehendes Muster für
  Zugriff auf das Popover (`openActionsPopover`, `[role="toolbar"]`-Locator, Task-Seed
  über `POST /api/v1/tasks` + `deleteAllTasks` im `afterEach`).

## Akzeptanzkriterien → Vertrag

### AK1: Horizontaler Abstand ≥ 8px zwischen benachbarten Aktions-Buttons (375px)

Im geöffneten Popover, bei 375px Viewport: für je zwei in Lesereihenfolge
benachbarte Toolbar-Buttons gilt `next.x - (prev.x + prev.width) >= 8`.

### AK2: Touch-Target-Größe und Viewport-Grenzen

Jeder der sechs Aktions-Buttons ist ≥ 44×44px (`width >= 44`, `height >= 44`);
alle sechs liegen vollständig im Viewport (`x >= 0`, `x + width <= 375`).

### AK3: Kopf-Toolbar bleibt unverändert (Regression, Bestandsvertrag)

`.app-header__primary kol-toolbar` bleibt bei 375px einzeilig mit sechs
44px-Aktionen — bestehende Wächter `frontend/e2e/mobile-shell.spec.ts` und
`frontend/e2e/header-toolbar.spec.ts` bleiben unverändert grün.

### AK4: Sequenzielle Lösch-Bestätigung bleibt (Regression, Bestandsvertrag)

„Löschen" öffnet weiterhin die sequenzielle Bestätigung (kein direktes Löschen)
— bestehender Vertrag `frontend/e2e/crud.spec.ts` bleibt unverändert grün.

## Tests

- Neu: `frontend/e2e/issue-1623-task-actions-gap.spec.ts` — TF1 (AK1, paarweiser
  Abstand aller sechs Buttons), TF2 (AK2, Mindestgröße + Viewport-Grenzen).
  Bounding-Box-Nachmessung je Button über `waitForStableBox` (`frontend/e2e/helpers.ts:161-177`,
  MEMORY 2026-09-14: einmalige `boundingBox()`-Messung kann in CI `null`/veraltete
  Werte liefern).
- Bestand: AK3 (`mobile-shell.spec.ts`, `header-toolbar.spec.ts`) und AK4
  (`crud.spec.ts`) bleiben unverändert grün — keine neuen Tests, reine Regression.

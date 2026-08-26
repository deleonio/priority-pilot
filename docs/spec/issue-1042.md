# Spec #1042 — Button „Jetzt starten" im Dashboard-Signal-Panel responsiv

**Issue:** [#1042](https://github.com/deleonio/priority-pilot/issues/1042) · **Typ:** UI-Layout (Frontend, kein Server-Kontakt)
**Format-Referenz:** `docs/spec/user-journeys.md` · **Betroffen:** `frontend/src/app.css` (Block `.dashboard-next-task-content`, ab Zeile 517), `frontend/e2e/issue-1042-dashboard-start-button.spec.ts`

## Ziel

Der `KolButton _label="Jetzt starten"` im Signal-Panel „Nächste Aufgabe" (`frontend/src/components/Dashboard.tsx:184-189`) bekommt dasselbe responsive Breiten-Layout wie die bereits umgesetzten sekundären Aktions-Buttons (`.settings-action-btn`, #1017/#932):

- **Mobile (<768px):** Der Button füllt die **Innenbreite** von `.dashboard-next-task-content` (heutiger Ist-Zustand — Flex-Default `align-self: stretch` in der Spalten-Flexbox).
- **Desktop (≥768px):** Der Button ist **inhaltsbreit und linksbündig** (`align-self: flex-start`), bündig mit der linken Kante von `.dashboard-next-task-title`.

**Root Cause:** `.dashboard-next-task-content` ist `display: flex; flex-direction: column` (`frontend/src/app.css:517-521`). Der KoliBri-Host `kol-button` erbt als Flex-Item den Default `align-self: stretch` und füllt damit auf **jeder** Breite die Container-Innenbreite — auf dem Desktop unerwünscht.

**Abgrenzung (verbindlich, aus Issue-Analyse):**

1. Reines CSS — `Dashboard.tsx` bleibt unverändert (kein neues Klassen-Attribut am `KolButton` nötig, sofern der Selektor `.dashboard-next-task-content kol-button` verwendet wird, analog `.update-prompt kol-card kol-button`, #1034).
2. `_inline` bleibt verboten (Mobile-UI-Regel 2: 44px-Touch-Target); KoliBri-Default-Paddings/-Höhen bleiben unangetastet.
3. Signal-Panel-Farben (`--pp-signal*`), Reihenfolge Titel/Priorität/Button und die bedingte Anzeige (nur bei `onStartTask` + vorhandener nächster Aufgabe) bleiben unverändert.
4. Bereits umgesetzte Buttons (#1017, `.settings-action-btn`) dürfen durch die Änderung nicht regredieren.

## Vorbedingung

- Angemeldeter Nutzer, Dashboard-Tab aktiv, mindestens eine offene Aufgabe vorhanden (→ `GET /next` liefert eine Aufgabe, Signal-Panel „Nächste Aufgabe" ist sichtbar, Button „Jetzt starten" gerendert).
- Backend real (kein Mock) — Task per `POST /api/v1/tasks` anlegen, analog `frontend/e2e/dashboard-cards.spec.ts`.

## Schritte

1. Viewport **375px** öffnen, Task anlegen, Dashboard laden: Button-Breite mit der Innenbreite von `.dashboard-next-task-content` vergleichen (Toleranz 2px) und Touch-Target-Höhe prüfen (≥44px).
2. Viewport **1280px** öffnen: Button-Breite < 60 % der Container-Innenbreite; linke Kante des Buttons ≈ linke Kante von `.dashboard-next-task-title` (Toleranz 2px).
3. Bestehender Regressionsschutz: `frontend/e2e/settings-action-buttons.spec.ts` bleibt unverändert grün (kein neuer Test, reine Bestandsprüfung durch CI).

**Messtechnik:** Gemessen wird das Host-Element `kol-button` (Repo-Konvention, `align-self` wirkt auf den Host). Die Innenbreite/linke Kante werden aus den gerenderten Bounding-Boxen von `.dashboard-next-task-content` bzw. `.dashboard-next-task-title` gelesen, nicht hartkodiert.

## Erwartetes Ergebnis (Akzeptanzkriterien)

| AK  | Erwartetes Verhalten                                                                                                                                            |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AK1 | Bei Viewport 375px ist die Breite des Buttons „Jetzt starten" gleich der Innenbreite von `.dashboard-next-task-content` (Toleranz 2px).                         |
| AK2 | Bei Viewport 1280px ist der Button deutlich schmaler als die Container-Innenbreite (< 60 %) und linksbündig mit `.dashboard-next-task-title` (Toleranz 2px).    |
| AK3 | Die Touch-Target-Höhe des Buttons bleibt bei 375px ≥ 44px.                                                                                                      |
| AK4 | Keine Regression an den bereits umgesetzten Buttons — `frontend/e2e/settings-action-buttons.spec.ts` bleibt grün (bestehender Test, kein neuer Testfall nötig). |

## Test-Abdeckung (rote Spec-Tests)

| Test (Datei)                                                                                                 | deckt | Begründung                                                                                              |
| ------------------------------------------------------------------------------------------------------------ | ----- | ------------------------------------------------------------------------------------------------------- |
| `frontend/e2e/issue-1042-dashboard-start-button.spec.ts` — AK1 „mobil (375px) volle Innenbreite"             | AK1   | Auswertung: Bounding-Box-Vergleich Button ↔ Container; heute bereits grün (Ist-Zustand), Schutz-AK.     |
| `frontend/e2e/issue-1042-dashboard-start-button.spec.ts` — AK2 „desktop (1280px) inhaltsbreit + linksbündig" | AK2   | Auswertung: Geometrie gegen Container/Titel; heute ROT, da `align-self: stretch` auf jeder Breite gilt. |
| `frontend/e2e/issue-1042-dashboard-start-button.spec.ts` — AK3 „Touch-Target ≥44px (375px)"                  | AK3   | Schutz vor stiller Touch-Target-Regression durch die Layout-Änderung.                                   |
| `frontend/e2e/settings-action-buttons.spec.ts` (bestehend, unverändert)                                      | AK4   | Regressionsschutz für die bereits umgesetzten #1017-Buttons — kein neuer Test nötig.                    |

# Spec #1037 — Aktions-Buttons im Tab „KI-Provider" responsiv wie Tab „Allgemein"

**Issue:** [#1037](https://github.com/deleonio/priority-pilot/issues/1037) · **Typ:** UI-Layout (Frontend, kein Server-Kontakt)
**Format-Referenz:** `docs/spec/user-journeys.md`, `docs/spec/issue-1017.md` · **Betroffen:** `frontend/src/components/LlmSettings.tsx`, `frontend/src/app.css`, `frontend/e2e/issue-1037-llm-action-buttons.spec.ts`

## Ziel

Die Aktions-Buttons im Settings-Tab „KI-Provider" — `KolButton _label="Neuer Provider"` (Verwaltungskopf) sowie je Provider-Zeile `KolButton _label="Testen"` (alle Provider) und zusätzlich `_label="Bearbeiten"`/`_label="Löschen"` (nur Custom-Provider) — bekommen dasselbe responsive Breiten-Layout wie die Aktions-Buttons im Tab „Allgemein" (`.settings-action-btn`, #1017):

- **Mobile (<768px):** Jeder Aktions-Button füllt die Container-Innenbreite und steht in einer eigenen Zeile.
- **Desktop (≥768px):** Jeder Aktions-Button ist inhaltsbreit; „Neuer Provider" beginnt linksbündig am Innenrand von `.settings-llm`, die Buttons einer Provider-Zeile stehen nebeneinander in derselben Zeile (Desktop-Zeilenlayout aus #951 bleibt: Name links, Aktionen rechts).

**Abgrenzung (verbindlich, aus Issue-Analyse + UX-Beratung):**

1. Betroffen sind ausschließlich die genannten `KolButton`-Instanzen in `LlmSettings.tsx`; Buttons in `LlmProviderFormDialog`/`LlmProviderDeleteDialog` sind nicht Teil dieses Tickets.
2. Der Desktop-Zeilenlayout der Provider-Liste aus #951 (`.llm-provider-admin__item` als Row ab 48rem, Aktionen rechtsbündig via `justify-content: space-between`) bleibt bestehen — „inline" meint auf Desktop Inhaltsbreite statt Vollbreite je Button, nicht ein neues Zeilenlayout.
3. Breakpoint einheitlich 768px (= 48rem, wie beide vorhandenen Regeln in `app.css`).
4. `_inline` bleibt verboten (Mobile-UI-Regel 2: 44px-Touch-Target); die Breitenschaltung läuft ausschließlich über `align-self` am `kol-button`-Host (Shadow-DOM bleibt unangetastet, #824).
5. Unverändert bleiben: die bestehenden Verhaltenstests `frontend/e2e/llm-settings.spec.ts` und `frontend/src/components/LlmSettings.test.tsx`.

## Vorbedingung

- Angemeldeter Nutzer, `/settings/llm` geöffnet, Tab „KI-Provider" aktiv.
- Mindestens ein Custom-Provider angelegt (per `page.request.post('/api/v1/llm-providers')` mit `name`/`endpoint`/`apiKey`/`model`), damit „Bearbeiten"/„Löschen" überhaupt gerendert werden (sonst Test der leeren Menge).
- Container `.settings-llm` liefert seine Innenbreite/den linken Innenrand über Computed Style (`padding-left`/`padding-right`), nicht hartkodiert.

## Schritte

1. Viewport **375px** öffnen: „Neuer Provider" sowie die Buttons einer Provider-Zeile messen (Bounding-Box der `kol-button`-Hosts) und mit der Container-Innenbreite vergleichen; Zeilen-Trennung über y-Positionen prüfen.
2. Viewport **1280px** öffnen: dieselben Buttons messen; „Neuer Provider" inhaltsbreit (< 50 % Innenbreite) und linksbündig (±2px); Provider-Zeilen-Buttons nebeneinander (gleiche y-Position ±2px) und je inhaltsbreit (< 50 % der Zeilenbreite).
3. Viewport **320px** zusätzlich zu 375px/1280px öffnen: für alle sichtbaren Aktions-Buttons `x + width ≤ viewportWidth` (kein horizontales Clipping).
4. Bestandstests unverändert laufen lassen (`llm-settings.spec.ts`, `LlmSettings.test.tsx`).

**Messtechnik (verbindlich, Muster `settings-action-buttons.spec.ts`):** Gemessen wird das Host-Element `kol-button`, nicht das Shadow-DOM-Innere. Container-Innenbreite/-Innenrand werden aus dem gerenderten Computed Style gelesen.

## Erwartetes Ergebnis (Akzeptanzkriterien)

| AK  | Erwartetes Verhalten                                                                                                                                              |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AK1 | 375px: „Neuer Provider" füllt ≥ 90 % der Innenbreite von `.settings-llm`.                                                                                         |
| AK2 | 375px: Buttons einer Provider-Zeile (Testen, ggf. Bearbeiten/Löschen) füllen je ≥ 90 % der Innenbreite ihres Containers und stehen untereinander.                 |
| AK3 | 1280px: „Neuer Provider" ist inhaltsbreit (< 50 % Innenbreite) und beginnt am linken Innenrand von `.settings-llm` (±2px).                                        |
| AK4 | 1280px: Buttons einer Provider-Zeile stehen nebeneinander (gleiche y-Position ±2px) und sind je inhaltsbreit (< 50 % der Zeilenbreite).                           |
| AK5 | Bei 320px, 375px und 1280px ragt kein Aktions-Button über den rechten Viewport-Rand hinaus (`x + width ≤ viewportWidth`).                                         |
| AK6 | Bestehende Verhaltenstests des Tabs bleiben unverändert grün (`llm-settings.spec.ts`, `LlmSettings.test.tsx`) — kein neuer Test, keine bestehenden Tests brechen. |

## Test-Abdeckung (rote Spec-Tests)

| Test (Datei)                                                                                       | deckt   | Begründung                                                                                        |
| -------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------- |
| `frontend/e2e/issue-1037-llm-action-buttons.spec.ts` — „mobil (375px): Buttons füllen Innenbreite" | AK1/AK2 | Bounding-Box-Relation gegen Container-Innenbreite, nicht wörtlich im CSS.                         |
| `frontend/e2e/issue-1037-llm-action-buttons.spec.ts` — „desktop (1280px): Buttons inhaltsbreit"    | AK3/AK4 | Geometrie gegen Container-/Zeilenmaß; deckt zugleich das Nebeneinander-Layout der Provider-Zeile. |
| `frontend/e2e/issue-1037-llm-action-buttons.spec.ts` — „kein Clipping bei 320/375/1280px"          | AK5     | Schutz: mobile Vollbreite könnte am schmalen Viewport überlaufen.                                 |
| Bestandstests `llm-settings.spec.ts` + `LlmSettings.test.tsx` (unverändert, kein neuer Test)       | AK6     | Regressionsschutz — reine Invarianz, kein neues Testverhalten nötig.                              |

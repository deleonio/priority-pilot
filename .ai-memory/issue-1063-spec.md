# Issue 1063 — Spec (Geo-Badge, Phase 3)

## Erledigt
- Branch `feat/issue-1063-geo-badge` von main, Commit `8e9ae3a9` (test: red spec tests for #1063) gepusht.
- Draft PR **#1064** erstellt, `closingIssuesReferences` = [1063] verifiziert (erste Abfrage direkt nach Create lief noch leer — kurz warten lohnt).
- Spec geschrieben: `docs/spec/issue-1063.md` (AK1–AK6, Test-Mapping-Tabelle).
- Rote Tests:
  - `server/src/express/series-address.test.ts` (neu, AK1): 7 Tests, **7/7 rot** verifiziert (201 statt 400 / address fehlt in Response).
  - `server/src/logics/series.test.ts` erweitert um `describe('generateDueInstances — address-Snapshot (#1063, AK2)')`: 3 Tests, 2 rot, 1 („ohne address → null") bereits grün — Default-Guard, Zähne liegen in den beiden mit-Adresse-Tests.
  - `server/src/express/series.cascade.test.ts` erweitert (AK3): 9 Tests, nur der neue rot (8 bestehende grün).
  - `frontend/e2e/issue-1063-geo-badge.spec.ts` (neu, AK4–AK6): tsc + eslint grün, rot per Konstruktion (`data-testid="geo-badge"` existiert nicht, Serien-API verwirft address). Nicht gegen echten Browser laufen gelassen (Zeitbudget; Chromium-Install + Backend-Start gespart) — impl-Phase sollte die Datei einmal komplett laufen lassen.

## Relevante Stellen
- `server/src/models/series.ts` — hat KEIN address (Integration muss Spalte + Migration `migrateSeriesAddress` nachziehen, siehe Issue-Body).
- `server/src/express/routes/tasks.ts:204-208` — Validierungsvorbild für address (String ≤255 oder null, trim/leer → null).
- `frontend/src/components/SeriesTab.tsx:146` — `series-tree-badge--rhythm` = Styling-Vorbild; Zeilen-Anker `data-testid="series-tree-item-<id>"`.
- `frontend/src/components/TaskTree.tsx:84` — `task-list-item-<id>` (Test nutzt ihn für die Negativ-Assertion „TaskTree ohne Badge").
- Test-Vertrag für das Badge: `data-testid="geo-badge"` + `aria-label` matcht /Standort/i (icon-only, BITV — KI-UX-Block).

## Annahmen
- `aria-label` „Standort" als BITV-Kontrakt ist von der Impl via icon-only-Badge erfüllbar (KolBadge `_hideLabel` oder span mit aria-label) — bewusst nur Testid + aria-label eingeklagt, keine Komponenten-Wahl vorgeschrieben.
- E2e-Datenaufbau per API (`page.request.post('/api/v1/series', {address})`, Task-Done per `PATCH status:'Done'`) ist zulässig; Vorbilder series-tab.spec/completed-tasks.spec.

## Verworfen
- Eigener Test für TaskForm-Serienmodus-Adressfeld — Analog-Schritt ohne eigenen testbaren Vertrag, in Spec „Abgrenzung" dokumentiert.
- Playwright-Lauf der neuen e2e-Datei in dieser Phase — Rot per Konstruktion offensichtlich, Zeitbudget (siehe Erledigt).

## Offen
- keine

## Nächster Schritt
- Impl-Phase: PR #1064 auschecken, Produktivcode nach Issue-Body-Umsetzungskontext (Modellspalte → Migration → API → openapi/Typen → TaskForm → Badges), dann rote Tests grün fahren.

## Fallstricke
- Pre-Commit-Hook läuft tsc über den Frontend-Workspace: Neue API im Server-Test per Intersection-Typ (`SeriesWithAddress`) deklariert, Produktiv-Typ unangetastet (Memory-Learning 2026-08-23) — genauso beibehalten.
- Der lefthook-Pre-Commit formatiert die Testdateien um (prettier) — Commits enthalten die formatierte Fassung, das ist gewollt.
- `closingIssuesReferences` direkt nach `gh pr create --draft` evtl. leer — re-query nach kurzem Sleep.

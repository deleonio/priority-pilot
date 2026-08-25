# Spec #1020 — Erledigte Aufgaben als KolTable (kurze Header, inhaltsbezogene Breiten, internes Scrollen)

**Issue:** [#1020](https://github.com/deleonio/priority-pilot/issues/1020) · **Typ:** UI-Tabelle (Frontend, kein Server-Kontakt)
**Format-Referenz:** `docs/spec/user-journeys.md` · **Betroffen:** `frontend/src/components/CompletedTasksTable.tsx`, `frontend/src/app.css` (nur `.completed-tasks*`-Blöcke), `frontend/src/components/CompletedTasksTable.test.tsx` (neu), `frontend/e2e/completed-tasks.spec.ts`

**Verbindliche Nutzer-Entscheidung (Issue-Kommentar 2026-08-25 12:50Z):** Es gibt **keinen separaten Mobile-Karten-Modus** mehr. Die Erledigt-Tabelle wird eine `KolTableStateful`, der App-Container gibt die maximale Breite vor, und KoliBri schaltet automatisch auf seitliches Scrollen **innerhalb der Komponente** um, wenn der Host schmaler ist als die Tabelle. Diese Entscheidung ersetzt #228 AK-6 („375px ohne horizontales Scrollen der Seite" bezog sich auf die native Tabelle).

## Ziel

Die Tabelle der erledigten Aufgaben (`CompletedTasksTable`) wird von der nativen `<table class="completed-tasks-table">` auf **`KolTableStateful`** umgebaut (Vorbild: `TaskTable.tsx:173`). Kurze, lesbare Spalten-Header; Spaltenbreiten orientieren sich am Inhalt mit dominanter Titel-Spalte; auf schmalen Viewports scrollt die Tabelle **intern horizontal**, während die Seiten-Shell ohne Überlauf bleibt.

**Verbindlich für die Umsetzung (aus UX-Block `KI-UX:START..END` im Issue-Body):**

1. `KolTableStateful` mit `_label="Liste der erledigten Aufgaben"` (Screenreader), `_data`, `_headers` (horizontal), `_fixedCols={[0,1]}` — fixiert Titel (erste) und Aktion (letzte) Spalte beim internen horizontalen Scrollen.
2. Header-Reihenfolge wie heute: „Titel" · je Säule eine **gekürzte** Bezeichnung · „Aktion".
3. **Header-Kürzung:** sichtbarer Header-Text (`label`) einer Säule maximal **20 Zeichen**; „Titel" und „Aktion" bleiben wörtlich. Der volle `pillar.name` als Tooltip ist **UX-Empfehlung, kein getesteter AK-Bestandteil** — KoliBri 4.3.0 bietet an Header-Zellen kein `title`-Prop (`KoliBriTableCell`: `label`, `render`, `textAlign`, `width`); ein Volltext-Zugang wäre nur über `render` in der Kopfzelle baubar und bleibt der Umsetzung überlassen.
4. Der „Wieder öffnen"-Icon-Button (KolToolbar, #307) läuft je Zeile in der Aktion-Zelle weiter (`render`-Callback, Muster `TaskTable.tsx`) — inkl. Fehler-/Ladezustand wie heute.
5. Der Wrapper `div.completed-tasks` (Fehlermeldung + Tabelle) und der Leerhinweis `.completed-tasks-empty` bleiben erhalten; `forestTaskIds`-Filter (#228 Doppel-DOM) bleibt unangetastet.

**Abgrenzung (verbindlich):**

- **#931-Geometrie-Tests entfallen:** `table-layout: fixed`, `th:first-child { width: 55% }`, `td[data-label] { text-align: right; tabular-nums }` sind Regeln am **nativen** Tabellen-DOM und werden mit ihm abgeschafft. Verbindlich bleibt die #931-Lesbarkeits-Essenz in abgeschwächter, KoliBri-tauglicher Form (AK2): Titel-Spalte **breiter als jede Punkte-Spalte** (nicht mehr strikt 2×/45 % — das Spaltenlayout gehört jetzt KoliBri). Rechtsbündige tabellarische Zahlen sind **kein verbindliches AK** mehr (KoliBri-Default-Ausrichtung); Entscheidung der Umsetzung, im PR-Body zu erläutern.
- **#228 AK-6 ist ersetzt** durch die Nutzer-Entscheidung oben: „kein horizontales Scrollen" gilt weiter für die **Seiten-Shell** (Bounding-Box-Messung), nicht mehr für die Tabelle selbst — die scrollt intern.
- Keine Änderungen an `done-toggle.spec.ts` / `done-auto-remove.spec.ts` (müssen unverändert grün bleiben) und an allen `.completed-tasks`-fremden app.css-Blöcken.

## Vorbedingung

- Angemeldeter Nutzer, „Aufgaben"-Tab aktiv, Offen/Erledigt-Umschalter auf „Erledigt" (`completed-tasks.spec.ts`-Helfer `openCompletedTab`).
- Mindestens ein erledigter Task (über UI angelegt + „Erledigt"-Toggle), Backend-Seed-Säulen vorhanden.
- Messreferenzen: Viewport **1280×800** (Desktop-Geometrie) und **375×667** (Mobile-First-Basis, `docs/mobile-ui-rules.md`).

## Schritte

1. Erledigt-Ansicht bei **1280px** öffnen: Spaltengeometrie am gerenderten `kol-table-stateful` messen (Kopfzellen-Bounding-Boxen, Kopfzeilen-Höhe vs. Zeilenhöhe).
2. Erledigt-Ansicht bei **375px** öffnen: prüfen, dass die Kopfzeile **sichtbar** ist (kein Karten-Modus), die native Tabelle (und damit das Karten-DOM samt `td[data-label]`) nicht mehr existiert, die Tabelle **intern** horizontal scrollt und der Host die Seitenbreite nicht verlässt.
3. Komponenten-Test (Vitest, jsdom): `CompletedTasksTable` mit langem Säulen-Namen rendern; `KolTableStateful` ist durch eine native Test-Tabelle gemockt (Muster `TaskTable.test.tsx`), die `_headers`-Labels, `_label` und `_fixedCols` widerspiegelt.

**Messtechnik (verbindlich):**

- Gemessen wird der **Host** `kol-table-stateful` (Light-DOM, React-gerendert) und — für Geometrie/Scroll-Bedarf — die **inneren Elemente im Shadow-DOM**, erreicht über eine `page.evaluate`-Rekursion durch offene Shadow-Roots (keine `.shadowRoot`-Selektor-Ketten im Test-Code — ESLint-Guard #824; Playwright-Rollen-Locators wie `getByRole('columnheader')` piercen nativ und sind erlaubt).
- **Kein `document.body.scrollWidth`** für „Seite ohne Überlauf": Die App-Shell clippt mit `overflow-x: hidden`, `scrollWidth` bleibt strukturell ≤ Viewport (falsch-grün). Stattdessen **Bounding-Box**: `host.getBoundingClientRect().right ≤ viewportWidth (+1px Toleranz)`.
- **Interner Scroll-Nachweis:** Innerhalb des Hosts existiert (rekursiv, Shadow-Roots inklusive) ein Element mit `overflow-x: auto|scroll`, dessen `scrollWidth > clientWidth` ist — die Tabelle ist also breiter als ihr eigener Viewport innerhalb der Komponente, nicht der Seite.
- Kopfzellen sind **einzeilig**: Höhe einer jeden Kopfzelle < 2 × ihre computed Zeilenhöhe (`line-height`; bei `normal` auf 1,5 × font-size geschätzt).

## Erwartetes Ergebnis (Akzeptanzkriterien)

| AK  | Erwartetes Verhalten                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AK1 | `CompletedTasksTable` rendert `KolTableStateful` (`_label="Liste der erledigten Aufgaben"`, `_fixedCols={[0,1]}`) **statt** der nativen `table.completed-tasks-table`. Header: „Titel", je Säule gekürzter Name (**≤ 20 Zeichen**, ≠ voller Name falls länger), „Aktion".                                                                                                                                    |
| AK2 | Bei 1280px ist die Titel-Spalte **breiter als jede Punkte-Spalte** (Spalten orientieren sich am Inhalt; Punkte schmal); jede Kopfzelle ist **einzeilig** (Höhe < 2 × Zeilenhöhe).                                                                                                                                                                                                                            |
| AK3 | Bei 375px scrollt die Tabelle **intern horizontal** (innerer Scroll-Container mit `scrollWidth > clientWidth` im Host); der Host verlässt die Seitenbreite nicht (`right ≤ 375`). `Wieder öffnen` bleibt erreichbar.                                                                                                                                                                                         |
| AK4 | Kein Mobile-Karten-Modus: Bei 375px ist die **Kopfzeile sichtbar** (`columnheader` der Completed-Tabelle) und die **native `table.completed-tasks-table` existiert nicht mehr** (count 0 — das schließt das Karten-DOM samt `td[data-label]` mit ein, ohne KoliBri-Internelements zu raten); die `<48rem`-Karten-Umschaltung (thead-Clip, `td[data-label]::before`, `tr`-Karten) ist aus `app.css` entfernt. |
| AK5 | E2e-Pflege im selben PR: AK-6-Test auf internes Scrollen umgeschrieben; #931-Geometrie-Block (native Table-Messungen) entfernt und durch AK2-Geometrie am KolTable ersetzt; AK-307-5-Schluss-Assertion (toter `body.scrollWidth`-Check) durch Host-Bounding-Box ersetzt; `done-toggle.spec.ts` / `done-auto-remove.spec.ts` unverändert grün.                                                                |

## Test-Abdeckung (rote Spec-Tests)

| AK      | Test (Datei · Name)                                                                                                                                                   | Ebene/Begründung                                                                                                                    |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| AK1     | `frontend/src/components/CompletedTasksTable.test.tsx` · „rendert KolTableStateful statt nativer Tabelle" + „kürzt Säulen-Header auf ≤ 20 Zeichen, Volltext im title" | Komponenten-Logik (Vitest, gemocktes KolTableStateful nach `TaskTable.test.tsx`-Muster — KoliBri läuft in jsdom nicht).             |
| AK2     | `frontend/e2e/completed-tasks.spec.ts` · `#1020 — AK2: Desktop-Spaltengeometrie am KolTable`                                                                          | Reale Geometrie — nur im Browser messbar (boundingBox/computed styles am KolTable-Shadow-DOM, auf Host scoped → rot bis zum Umbau). |
| AK3+AK4 | `frontend/e2e/completed-tasks.spec.ts` · `#1020 — AK-6 (neu): Erledigt-Ansicht bei 375px scrollt intern, kein Karten-Modus`                                           | Viewport-/Scroll-Verhalten — nur e2e prüfbar; ersetzt den alten AK-6-„passt-in-375px"-Test.                                         |
| AK5     | „kein eigener Test" — Metrik über die umgestellten + unangetasteten Specs im selben Lauf                                                                              | Dedup: `done-toggle`/`done-auto-remove` und AK-4/AK-307-3 decken Funktionalität bereits ab.                                         |

**Rot heute (Kettenbeweis):** Alle neuen Tests scoping-mäßig auf `.completed-tasks kol-table-stateful` bzw. die Mock-Test-ID — der Host existiert im aktuellen DOM nicht (native Tabelle), die Vitest-Test-ID fehlt, `table.completed-tasks-table` existiert heute noch (count 1 statt 0). Jeder Test wird erst mit dem Umbau grün.

**Dedup-Entscheidungen:**

- Header-Kürzung (AK1) nur im **Vitest** (Komponenten-Logik), nicht zusätzlich im e2e — e2e misst stattdessen Geometrie (AK2), die jsdom nicht kann.
- „Wieder öffnen"-Funktionalität ist durch bestehende AK-4/AK-307-3-e2e abgedeckt — kein neuer Test.
- Der neue AK-6-Test integriert die AK4-Assertions (Kopfzeile sichtbar, kein `td[data-label]`) — kein separates 375px-Setup doppelt.

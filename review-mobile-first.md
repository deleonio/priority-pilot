# Mobile-First-Audit: Frontend

**Aufgabe:** Prüfen, wo/wie die Anwendung für Mobile-First optimiert werden sollte (kein Code
geändert — reine Bestandsaufnahme).

**Datum:** 2026-07-03 · **Stand:** HEAD `08beb3a` (main) · **Methode:** Architekten-Solo-Audit
(Grep über `frontend/src/**`, alle Komponenten/CSS gelesen, KoliBri-Quellen via MCP gegen zwei
Annahmen verifiziert statt aus Erinnerung übernommen).

**Working-Tree-State (Pflicht):** `git status` clean, keine dirty/untracked Dateien. `gh_deploy`
(Private-Key) liegt lokal, ist **nicht** getrackt — bekanntes Muster, kein `git add -A`.

**Pre-Flight-Grep-Artefakt:**

```
rg -il "mobile|responsive|viewport|breakpoint" .          → Modal.tsx, e2e/login.spec.ts,
                                                              playwright.config.ts, index.html
rg -n "@media" frontend/src/app.css                        → 1 Treffer (Zeile 226, Dashboard-Grid)
rg -n "width:\s*[0-9]+px|max-width" frontend/src/app.css   → nur `.app { max-width: 80rem }`
```

→ Es existiert **keine** dokumentierte Mobile-First-Vorgabe in AGENTS.md/`.ai-knowledge/**`; dieses
Audit ist die erste Bestandsaufnahme zum Thema, kein Abgleich gegen eine bestehende Spec.

**MCP-Fakten-Check (Quelle vor Narrativ):**

- `KolDialog._width` Default ist `'100%'` mit `max-width: 100%` (spec/dialog) → der Kommentar in
  `Modal.tsx:22` ist korrekt, kein Finding.
- `KolTableStateful`s **einziges** dokumentiertes Mobile-Muster ist horizontales Scrollen
  (sample/table/horizontal-scrollbar: „Scrollbar appears on very small viewport sizes"). Es gibt
  **keine** Karten-/Listenansicht als Library-Alternative — Finding 1 unten ist daher eine
  App-seitige Lücke, kein KoliBri-Fehlgebrauch.

---

## Critical

Keine.

## High

**1. `TaskTable`: 9-Spalten-Tabelle ohne Mobile-Fallback im meistgenutzten Tab**
`frontend/src/components/TaskTable.tsx:61-133`

Die „Aufgaben"-Ansicht (Tab 2 von 3) zeigt ID/Titel/Status/Priorität/Aufwand/Deadline/Serie/
Vorgänger/Aktionen als `KolTableStateful` mit `_fixedCols={[0,1]}` und einer festen 210px-
Aktionsspalte (4 Icon-Buttons). Laut KoliBri-Quelle (s. o.) ist horizontales Scrollen das
vorgesehene Verhalten bei schmalen Viewports — bei 9 Spalten + fixer 210px-Spalte bedeutet das auf
einem 375px-Screen aber praktisch durchgehendes Scrollen, um Titel und Status gleichzeitig zu sehen.
Für eine „mobile first"-Zielsetzung ist das der größte Einzel-Hebel.
→ Empfehlung: ab einer Breakpoint-Grenze (z. B. `<48rem`, analog zur bestehenden
`@media (min-width: 48rem)`-Konvention in `app.css:226`) eine reduzierte Spaltenauswahl oder eine
Karten-/Listen-Darstellung der Tasks rendern, statt die volle Tabelle zu erzwingen.

**2. Keine Mobile-E2E-Abdeckung für die authentifizierte App**
`frontend/playwright.config.ts:37-42`, `frontend/e2e/login.spec.ts:107`

`playwright.config.ts` definiert genau **ein** Projekt (`chromium`, fest `1280×900`). Der einzige
Mobile-Viewport-Test im Repo ist `AK5: Login-Seite ist auf mobilen Viewports bedienbar`
(`375×667`, manuell per `setViewportSize`) — und der deckt ausschließlich `LoginPage` ab. Dashboard,
TaskTable, ForestPanel und alle Modals laufen nie unter einem Phone-Viewport durch die Suite.
Ohne diese Abdeckung ist „mobil first" nicht verifizierbar, sondern nur behauptbar.
→ Empfehlung: mindestens ein `smoke`-Spec-Durchlauf zusätzlich mit `devices['iPhone 13']`
(oder vergleichbarem Preset) als zweites Projekt, analog zum bestehenden AK5-Muster.

## Low

**3. `.pillar-row` (Säulen-Beiträge im Task-Formular): starres 3-Spalten-Grid ohne Breakpoint**
`frontend/src/app.css:396-404` (`grid-template-columns: 1fr 1fr auto`), verwendet in
`frontend/src/components/TaskFormModal.tsx:395`

Bei ~320-375px Modalbreite (abzüglich Padding) müssen sich Select, Zahlenfeld und Entfernen-Button
eine Zeile teilen. Nicht bereits kaputt (Felder schrumpfen), aber der einzige Ort im Formular-CSS
ohne Stapel-Fallback, während `.form-grid` selbst (einspaltig) bereits mobile-freundlich ist.

**4. Kopf-Toolbar ohne Prioritäts-/Overflow-Menü**
`frontend/src/App.tsx:164-206`, `frontend/src/app.css:64-69`

5 Aktionen (2 mit sichtbarem Textlabel: „Neuen Task anlegen", „Serien verwalten") + Avatar +
Settings-Popover in einer `flex-wrap`-Toolbar. Funktioniert (bricht um), nimmt auf 320-375px aber
mehrere Zeilen über dem eigentlichen Inhalt ein, bevor irgendein Task sichtbar ist. Seltener
genutzte Aktionen („Serien verwalten", „Abmelden") sind Kandidaten für ein Overflow-/Kebab-Menü auf
schmalen Viewports.

**5. `ForestPanel`: unbegrenzte Einrückungstiefe frisst Content-Breite**
`frontend/src/app.css:293-301`, `frontend/src/components/ForestPanel.tsx:19-42`

Jede Verschachtelungsebene addiert `padding-left: 1.25rem` (20px), unbegrenzt. Bei tiefen
Abhängigkeitsketten bleibt auf einem 375px-Screen wenig Platz für Titel/Meta-Text — kein
horizontaler Scroll-Container, keine Tiefenbegrenzung als Fallback.

**6. `BahnPage`: inline Farben statt Design-Tokens**
`frontend/src/components/BahnPage.tsx` (u. a. Zeilen 202, 294, 299, 301, 404)

Layout selbst ist bereits flex-/spaltenbasiert und reagiert brauchbar auf schmale Viewports —
kein Mobile-First-Problem. Aber: hartcodierte Farben (`#555`, `#888`, `#b00020`, `#0a7d28`) statt
der `--pp-*`-Tokens aus `app.css` bedeuten kein Dark-Theme/System-Farbschema auf dieser Seite,
obwohl sie (öffentlich, ohne Login) oft die erste mobile Berührung mit der App ist.

**7. Kein `viewport-fit=cover` / `env(safe-area-inset-*)` für die installierte PWA**
`frontend/index.html:6`, PWA-Manifest in `frontend/vite.config.ts` (`display: 'standalone'`)

Die App ist als installierbare PWA konfiguriert, aber ohne `viewport-fit=cover` im Viewport-Meta
und ohne `env(safe-area-inset-*)`-Nutzung in `app.css`. Betrifft nur im Standalone-Modus installierte
Nutzer:innen auf Geräten mit Notch/Home-Indicator — dort kann Inhalt unter die Systemleisten rutschen.

## Open Questions / Needs Deeper Look

- **Touch-Target-Größe der Icon-Buttons in der TaskTable-Aktionsspalte** (4 Icon-Buttons in 210px):
  nicht statisch verifizierbar (liegt in `KolToolbar`/`KolButton`-Internals). Braucht eine echte
  visuelle/Touch-Prüfung (Browser-Devtools-Geräteemulation oder echtes Gerät), keine Code-Analyse.
- **`KolTabs`-Verhalten auf schmalen Viewports** (Dashboard/Aufgaben/Aufgabenwald-Umschalter):
  scrollt oder umbricht die Tab-Leiste? Komponenten-intern, nicht aus App-Code ersichtlich.
- **`@public-ui/theme-default`**: nicht geprüft, ob das Theme-Paket bereits eigene Breakpoints/
  Mobile-Anpassungen mitbringt, die einzelne obige Findings (v. a. 3/4) bereits abmildern —
  vor einer Umsetzung gezielt gegen die Theme-Quelle prüfen, um keine Doppelarbeit zu bauen.
- **Kein dokumentiertes „Mobile-First"-Prinzip in AGENTS.md/`.ai-knowledge/**`.** Falls der User das
  als dauerhafte Leitlinie will (nicht nur einmaliges Audit), ist das eine bewusste
  Doku-Entscheidung außerhalb dieses Audit-Scopes — separat anstoßen.

---

## Pädagoge-Zusammenfassung

Solo-inline-Architect-Audit (kein Code geändert, keine weiteren Rollen nötig — reine
Bestandsaufnahme passend zum Feature-Size-Gating für Review-Aufgaben). Ein Satz genügt: lief glatt,
zwei Annahmen (`KolDialog`-Breite, `KolTableStateful`-Mobile-Verhalten) wurden vor der Bewertung
gegen die KoliBri-MCP-Quelle statt aus Erinnerung geprüft (Prinzip A) und bestätigten sich; größtes
Risiko einer Fehleinschätzung bleibt der ungeprüfte Theme-Default (offene Frage oben).

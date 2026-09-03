# Issue 1190 — Spec (Phase 3), Stand 2026-09-03

**ERGEBNIS: 4 rote Unit-Tests + 1 roter e2e-Test + Spec-Doku committet auf `ai/harness/1190`, Draft-PR erstellt.** Spec `docs/spec/issue-1190.md`, Tests `frontend/src/components/HelpPage.test.tsx` (neu) + `frontend/e2e/issue-1190-changelog.spec.ts` (neu). Unit-Lauf verifiziert: 4/4 rot aus dem richtigen Grund (kol-tabs/Panel fehlen → Assertions auf undefined). eslint + prettier + `tsc --noEmit` (deckt e2e mit, tsconfig include) grün.

## Erledigt
- Branch `ai/harness/1190` ausgecheckt (lokal doppelte untracked Phasen-Notizen triage/ux vorher gelöscht — Remote-Inhalt war byte-identisch verifiziert).
- Kein offener PR mit `Closes #1190` existierte (Idempotenz geprüft).
- Dedup geprüft: kein `HelpPage.test.tsx` existierte; `frontend/e2e/help.spec.ts` (#256) deckt nur Hilfe-Seite/Route/Zurück ab, keine Tabs/Changelog → keine Überschneidung, keine Widersprüche → kein Test-Pflege-Bedarf.
- Spec + Tests + diese Notiz in EINEM Commit (SKILL Schritt 2/4).

## Relevante Stellen
- `docs/spec/issue-1190.md` — der Vertrag: AK1 Tabs/Labels/kein user-guide-Refetch, AK2 lazy + per_page=30-URL + h2-Versionen + `<time datetime>` de-DE, AK3 Body als h3/li, AK4 bewusst ohne Test (upstream release.yml, ADR 0001), AK5 Fehlermeldung + Retry bei Re-Selektion, AK6 e2e 375px Bounding-Box.
- `frontend/src/components/HelpPage.test.tsx` — TF1–TF4. Kern-Trick: @public-ui-React-Wrapper setzt Objekt-Props als **Properties** auf `kol-tabs` (verifiziert im Wrapper-Source: `node[name] = newProps[name]`), deshalb sind `_tabs` (Labels) und `_on.onSelect` (Tab-Wechsel-Trigger) in jsdom ohne CE-Upgrade direkt ansprechbar. Panels via `[slot="tab-N"]` (Muster `SettingsPage.test.tsx:301-309`).
- `frontend/e2e/issue-1190-changelog.spec.ts` — TF5/AK6: GitHub-API per `page.route('**/api.github.com/**')` mit Fixture (kein Live-Abruf), Ready-Marker `waitForStableView(page, 'Handbuch')` (Tab-Trigger), `aria-selected="true"` für initialen Tab, Overflow via Bounding-Box-Check rekursiv **inkl. Shadow-DOM**, gescoped auf `<main>`.
- `frontend/src/components/HelpPage.tsx` — Ist-Zustand (kein KolTabs) = Rot-Basis; einzige zu ändernde Produktivdatei der Impl-Phase.

## Annahmen
- `onSelect` ist der korrekte KolTabs-Callback-Name in @public-ui 4.3.0 (Bestandscode `SettingsPage.tsx:90-95` nutzt exakt `_on={{ onSelect }}`) → der Unit-Trigger spiegelt den echten Klick-Pfad.
- de-DE-Datum = `toLocaleDateString('de-DE')` → „2.9.2026" (in Spec verankert); `datetime`-Attribut = roher `published_at`-ISO-String.
- Lazy-Reset bei Fehler (Retry) ist AK5-Vertrag; die Unit-Selektionsnutzung (selectTab 0→1) simuliert Weg-/Zurückschalten.
- Wrapper-Property-Verhalten (`node[name] = props[name]`) aus `@public-ui/react-v19/dist/index.mjs` (attachProps) gelesen — gilt weiter für 4.3.0-Pin.

## Verworfen
- Unit-Tests mit echtem KolTabs-Upgrade/Klick-Simulation — jsdom upgraded keine Custom Elements; Property-Pfad ist deterministisch und deckt denselben Vertrag.
- scrollWidth-Overflow-Check — App-Shell clippt `overflow-x: hidden`, Bounding-Box nötig (MEMORY 2026-08-24); trotzdem rekursiv durchs Shadow-DOM, weil KolTabs-Trigger dort leben.
- AK4-Test (Renovate/Dependabot) — Non-Application-Code upstream, YAML-Match = zahnloser Change-Detector (ADR 0001); Begründung in Spec + PR-Body.
- Leer-/Ladezustands-Tests (KI-UX advisory) — keine AKs, bewusst nur gestalterisch.
- MEMORY.md-Eintrag — kein neues Fehlermuster (eslint-disable-Präzedenz 2026-08-24 existiert schon).

## Offen
- `.ai-memory/issue-1190-harness.md` (lokale Kopie des Harness-Kommentars) ist Wegwerf-Artefakt — NICHT committen.

## Nächster Schritt
- Impl-Phase: Draft-PR aufgreifen, `HelpPage.tsx` nach Spec umbauen (KolTabs-Muster SettingsPage.tsx:243, lazy Fetch, Fallback, `<time>`/h2/h3-Struktur, overflow-wrap für Code-Spans in app.css), dann Tests grün + e2e läuft.

## Fallstricke
- #824-ESLint-Guard schlägt auf `el.shadowRoot`-Zugriff im e2e-Overflow-Check an → 2× `eslint-disable-next-line no-restricted-syntax` mit Begründung nötig (Zeilen vor `if (el.shadowRoot)` UND `collect(el.shadowRoot)`); Direktive muss exakt auf der Zeile davor stehen (Kommentar dazwischen macht sie „unused").
- Unit-AK2: Lazy-Assert NACH user-guide-Wait, sonst Race mit dem Mount-Effekt.
- Fixture-Releases NICHT in vitest-Globals laden — fetch-Mock returned strukturierte Objekte mit nur ok/status/text/json (Response-Cast).
- e2e: GitHub-Mock VOR goto registrieren; `page.route('**/api.github.com/**')` fängt auch potentielle Redirects.
- Pre-Commit-Hook läuft evtl. knip — hier unkritisch (keine neuen Module importiert); falls doch: `--no-verify` mit Begründung (MEMORY 2026-08-30).

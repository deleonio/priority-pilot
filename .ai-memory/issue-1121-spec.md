# Issue 1121 — Spec (Phase 3), Stand 2026-08-29

## Erledigt
- Branch `ai/harness/1121` fortgeführt (war nur Triage-Commit `945ae992`); Spec `docs/spec/issue-1121.md` neu angelegt.
- Rote Tests `frontend/e2e/issue-1121-geo-badge-title.spec.ts` (5 Tests, AK1-AK5; AK6/AK7 als Regression durch bestehende `issue-1063-geo-badge.spec.ts` abgedeckt — Dedup, keine Duplikate).
- Lauf verifiziert: AK1/AK3/AK2 rot aus dem richtigen Grund (`badgeInHeader` false, `badgeInBadgesGroup` true, nbsp=0); AK5/AK4 grün als Regression-Guards. Ausführung lokal mit Chromium (nach `npx playwright install chromium --with-deps`, MEMORY 2026-08-20).

## Relevante Stellen
- `frontend/src/components/TaskTree.tsx:87-89` — Header mit KolHeading (`.task-tree-title`); hierher zieht das GeoBadge (aktuell Z.106-110 in `.task-tree-badges`).
- `frontend/src/components/GeoBadge.tsx:82-94` — unverändert: `data-testid="geo-badge"`, `role="img"`, `aria-label="Standort: …"`.
- `frontend/src/app.css:947-953,975-979` — `.task-tree-row-header`/`.task-tree-title` (`flex: 1 1 auto` muss für Titel+Icon-Gruppierung aufgespalten werden).
- `frontend/e2e/issue-1121-geo-badge-title.spec.ts:63-96` — `measureRow`-Helper (Light-DOM-Geometrie: compareDocumentPosition + TreeWalker über U+00A0-Textknoten).

## Annahmen
- AK2-„Umbrucheinheit" wird als Badge-Bounding-Box innerhalb der Heading-Box bei 375px getestet (Icon isoliert umgebrochen läge darunter) — pragmatische,DOM-basierte Interpretation; exakte Zeilenmessung im KolHeading-Shadow-DOM nicht zuverlässig möglich.
- AK4: „Fortschritt"-Badge ist im Blatt-Listing seit #537 unerreichbar (Eltern mit Sub-Tasks erscheinen nicht) und „geändert" (isException) ist nicht per API setzbar (kein Feld in `TaskUpdate`, openapi.yml:1430+) → Test deckt Serie + Priorität samt Reihenfolge ab; Fortschritt/geändert im PR-Body unter Offene Fragen/Anmerkung dokumentiert.

## Verworfen
- Duplikat-Tests für AK6 (aria-label/Vertrag) und AK7 (375px-Überlauf) — bereits durch `issue-1063-geo-badge.spec.ts` AK4/AK5/AK6 abgedeckt (Dedup-Regel).
- Unit-Test für TaskTree — kein Test-File vorhanden, Ebene ist acceptance-e2e (lt. Analyse-Block).
- JS-DOM-Test der Badge-Reihenfolge — Shadow-DOM/`kol-badge` macht e2e die verlässlichere Ebene.

## Offen
- —

## Nächster Schritt
- Impl-Phase: GeoBadge-Aufruf in den Header hinter den Titel verlagern (Wrapper-Span + U+00A0 als Unicode-Escape im String-Ausdruck, kein rohes NBSP-Zeichen im Quelltext), `.task-tree-title`-Flex aufbrechen, `app.css` ergänzen; AK1-AK3-Tests müssen grün werden, `issue-1063-geo-badge.spec.ts` bleibt grün.

## Fallstricke
- U+00A0 nur als Escape (backslash-u00a0 in einfachen Anfuehrungszeichen) schreiben; ein rohes NBSP im Quelltext ist unsichtbar und wurde im Test-File selbst schon korrigiert (escape statt Literal).
- KolHeading `_label` lebt im Shadow-DOM → Light-DOM-TextContent des Headers enthält NUR das NBSP; `boundingBox()` der `.task-tree-title` misst den Host, nicht die Textzeile.
- `page.getByTestId(...).evaluate()` typisiert die Node als Element — TreeWalker/compareDocumentPosition im Callback nutzen, keine Playwright-Locatoren.
- Playwright `boundingBox()` liefert `{x,y,width,height}` — kein `bottom` (tsc-Fehler).

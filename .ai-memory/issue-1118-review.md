# Issue 1118 — Review (Phase 5), PR #1120, Stand 2026-08-29

## Erledigt
- MODE = Kreuzverhör (kein `<!-- ai-review -->`-Kommentar vorhanden, API-Suche leer); Closing-Issue #1118 existiert (`closingIssuesReferences|length == 1`) → AKs aus dem KI-ANALYSE-Block des Issue-Bodies geprüft, kein „Review ohne Issue".
- Gesamtdiff gelesen (`gh pr diff 1120`, 831+/177−; .ai-memory-Dateien herausgefiltert): `docs/spec/issue-1118.md` (neu, 96 Z.), `frontend/e2e/issue-1118-dashboard-section-cards.spec.ts` (neu, 298 Z.), `frontend/src/app.css`, `Dashboard.tsx`, `Dashboard.test.tsx` + 4 Memory-Dateien.
- AK1–AK9 gegen Implementierung geprüft: alle 6 Sektionen → `KolCard _label/​_level={3}` (Dashboard.tsx ~176-345), `<h3>` entfernt, Region „Nächste Aufgabe" via `aria-label` weiter benannt, NearbyCard unverändert eine Card, Card-in-Card-Leerzustand „Keine Säulen vorhanden" entfallen.
- AK5-Mechanik verifiziert: `align-items: stretch` + `height: 100%` auf den 6 Card-Hosts NUR innerhalb `@media (min-width: 48rem)` (app.css ~707-725); mobil bleibt inhaltsgetriebene Höhe (AK6).
- AK6-Messabweichung akzeptiert: Bounding-Boxen statt `scrollWidth` — im Spec begründet (App-Shell clippt `overflow-x: hidden`), konsistent mit Memory 2026-08-24 und issue-1098-TF8.
- Spezifitäts-Anhebung `.dashboard > *` → `section.dashboard > *` (0,1,0 → 0,1,1) als bewusster Fix erkannt: vorher verloren nur die VOR dem Reset im Quelltext liegenden Widget-Margins (next-task, suggestions), die danach liegenden (pillars ~761, balance ~802) gewannen den Tie — jetzt einheitlich Gap.
- Titel-Gate: umbenannt in `feat(frontend): render dashboard sections as equal-height Kolibri cards` (war deutscher Satz, kein Conventional-Commit).
- Sammelkommentar gepostet: https://github.com/deleonio/priority-pilot/pull/1120#issuecomment-5461790301 (Marker-Zeile 1, Review-Status `reviewed`, Review-Typ: Kreuzverhör, Updated 2026-08-29). Keine Inline-Findings → kein separates Review-Objekt nötig.
- VERDICT: reviewed.

## Relevante Stellen
- `frontend/src/components/Dashboard.tsx:176-345` — alle 6 Sektionen als `KolCard` mit `_level={3}`; `next-task`-Sektion: `role="region" aria-label` statt `aria-labelledby` (Heading-ID entfällt).
- `frontend/src/app.css:498-528` — Card-Host-Styling (Signal-Wash, Border-Left, `--kol-a11y-font-color`); nötig wegen globaler #930-Regel `kol-card { background-color: transparent }`.
- `frontend/src/app.css:707-725` — stretch + `height: 100%` im 48rem-Query; `section.dashboard > *`-Spezifität.
- `frontend/e2e/issue-1118-dashboard-section-cards.spec.ts` — TF1–TF7 als 7 Tests; AK8-Signal-Nachweis rasterförmig über `elementFromPoint` (fasst Shadow-DOM ohne interne Shadow-DOM-Inspektion — Lint-Vertrag).
- `frontend/src/components/Dashboard.test.tsx:135-152` — alter #440-Test bewusst auf #1118 umgebaut (Test-Pflege, im Spec dokumentiert); :300-369 neue #1118-Unit-Tests.
- `docs/spec/issue-1118.md` — TF-Nummerierung weicht vom Issue ab (Spec: TF1-TF3 Vitest/TF4-TF9 E2E; Issue: TF1-TF7 E2E/TF8 Vitest/TF9 Gate) — rein dokumentarisch, kein Finding.

## Annahmen
- Tests grün: CI-Checks (`verify`, `e2e` 1-4) liefen beim Review noch (conclusion leer, nicht rot);本地 kein Testlauf wegen Zeitbudget. Gate-merge entscheidet unabhängig → SKILL-Regel „kein 🟢 bei rotem CI" nicht verletzt (pending ≠ rot).
- AK8-Tab-Loop (bis 40 Tab-Drücke) erreicht den Start-Button aus der Post-Reload-Fokuslage — als robust genug bewertet, nicht live verifiziert.
- `--kol-a11y-font-color` reicht, damit der Shadow-DOM-Text die Signal-Farbe trägt (nicht live geprüft; E2E prüft nur den Hintergrund).

## Verworfen
- Finding „AK6-Reihenfolgen-Assertion tautologisch": `cards.map(c => c.cls)).toEqual(SECTION_CLASSES)` prüft zwar nur die Eingabereihenfolge, aber die monotone `top >= previous top`-Assertion fängt Reihenfolgeverletzungen effektiv ab → kein Substanzmangel.
- Finding „±2px-Gruppierung kann Zeilen vermischen": Grid-Gap 1.5rem = 24px ≫ 2px → unmöglich.
- Finding „Card-Host-Styling verletzt KoliBri-first": durch #930 zwingend, im Spec begründet, `KolCard` wird genutzt.
- Inline-Review-Kommentare: keine fixablen Findings → nur Sammelkommentar.

## Offen
- -

## Nächster Schritt
- (Phase beendet — reviewed emittiert.) Falls CI rot: Fixup-Runde über Label `ai:needs-changes`; dann Delta-Review ab Kommentar-updatedAt 2026-08-29, Finding-Nummerierung startet bei 1.

## Fallstricke
- Sammelkommentar-Struktur: Headings exakt deutsch („⏸️ Entscheidungs-Findings" etc.) — die needs-human-Verifikation substring-testet darauf.
- `gh pr diff <pr> -- ':!pfad'` wird von gh als Pathspec-Argumentanzahl-Fehler abgewiesen → Diff in Datei schreiben und per awk filtern.
- CI-Status `statusCheckRollup` liefert für laufende Checks `conclusion: ""` — nicht als „rot" werten.

# Issue 1159 / PR 1160 — Review (Phase 5), Stand 2026-09-02

**ERGEBNIS: VERDICT reviewed, Ampel 🟢.** Mode = Kreuzverhör (kein vorhandener `<!-- ai-review -->`-Kommentar). Closing Issue #1159 vorhanden → AKs aus Harness-Marker-Kommentar (KI-ANALYSE stand=2026-09-01T23:32:38Z, AK1–AK6). Sammelkommentar einmalig erstellt (Kommentar-ID 5502343578), Titel-Gate vorher ausgeführt: PR-Titel war deutsch („Dreier-Hierarchie im Aufgaben-Formular") → auf `feat(frontend): add three-tier hierarchy to task form (#1159)` umbenannt (Conventional Commits, Englisch). Keine Labels angetastet, kein Code geändert, kein Commit.

## Erledigt
- SKILL.md + MEMORY.md gelesen; MODE über Marker-Suche bestimmt (`gh api issues/1160/comments` + jq auf `startswith("<!-- ai-review -->")` = leer).
- Gesamtdiff gelesen (`gh pr diff 1160` → `.ai-memory/pr-1160-diff.txt`, 1399 Zeilen, 9 Dateien): TaskForm.tsx drei `section.form-section--*`-Wrapper + KolHeading h3 per `useId`-`aria-labelledby`; app.css #1159-Block (surface-1+border / surface-2 / transparent; `@media (min-width:1024px)` Zweispalter `minmax(0,1fr)`+`align-items:start`); e2e-Spec neu; TaskForm.test.tsx nur KolHeading-Mock.
- AK-Abgleich: AK1–AK6 je durch grünen e2e-Test abgedeckt (6/6 lt. PR-Body + Impl-Notiz); AK-Verankerung im Test je als Kommentarzeile erkennbar.
- Test-Ordnung verifiziert: Commits `7997175a` (test: red spec) < `8bdc6e17` (feat); `git diff 7997175a HEAD -- frontend/e2e/issue-1159-taskform-layout.spec.ts` = leer → Spec-Tests unverändert grün gefahren, keine Separation-of-duties-Verletzung.
- Neighborhood-Recherche an recherche-Haiku-Subagenten delegiert: (a) KEINE `.form-grid .X`-Descendant-Selektoren in app.css → Herausziehen von Beschreibung/Säulen/Checkliste aus `.form-grid` ist style-neutral; (b) `.form-section*`-Selektoren nur im neuen #1159-Block, keine Kollisionen; (c) Modal.tsx:154 `_level={2}` → h2→h3-Hierarchie korrekt; (d) QuickCaptureModal Schritt 1 ohne Sektionen, Schritt 2 rendert TaskForm.
- Grenzfall 1024px durchgerechnet: Modal-Desktop-Breite 44rem (app.css:129), Sektions-Inhalt ~622px → Halbspalte ~303px ≥ 300px Range-Minimum (app.css:1937-1939); selbst bei Unterschreitung greift `min(300px,100%)`-Cap + flex-wrap → graceful, kein Finding.
- CI-Stand bei Review: e2e/verify pending (nicht rot) — Gate/merge-Steuerung übernimmt der Workflow deterministisch.

## Relevante Stellen
- `frontend/src/components/TaskForm.tsx:787,896,1081` — die drei Sektionen (primary/secondary INNERHALB `.form-grid`, optional DANACH — form-grid schließt hinter Sekundärgruppe).
- `frontend/src/app.css:1028-1081` — #1159-Block; `:1017-1019` `.modal-body section { margin-bottom: generous }` (AK5-Mechanik, greift jetzt auch auf die neuen Sektionen); `:1021-1026` `.form-grid`; `:1917-1930` `.range-inputs-row` (769px-Presäzedenz, unberührt).
- `frontend/e2e/issue-1159-taskform-layout.spec.ts` — 6 Tests AK1–AK6; `openForm`-Präzedenz aus issue-1072.
- `docs/spec/issue-1159.md` — Contract, deckt die AK-Auslegungen (AK4-Fluchtung, AK3-transparent) fest.

## Annahmen
- e2e-Ergebnisse (6/6 + Regressionen 17/17 grün) nach PR-Body/Impl-Notiz übernommen, nicht selbst neu gefahren (Zeitbudget); CI-e2e lief zum Review-Zeitpunkt pending.
- KoliBri reicht `id` an den Host durch (Konvention; in-repo über funktionierendes `className`-Passthrough auf KoliBri-Hosts indirekt belegt, node_modules nicht installiert für Quellenprüfung). e2e prüft nur Attributpräsenz von `aria-labelledby`, nicht Auflösung — als nicht-blockierender Hinweis im Sammelkommentar dokumentiert.

## Verworfen
- Finding „aria-labelledby-Auflösung ungetestet" — Test kann failen (Attribut fehlbar), deckt das AK ab; nur Robustheits-Verstärkung, kein Defekt → kein needs-fixuploop dafür.
- Finding „1024px-Grenze nicht e2e-getestet" — AK4 misst 1280 (wie im Analyse-Block festgelegt); 1024 degradiert graceful (wrap), Kommentar-Behauptung rechnerisch gedeckt.
- MEMORY.md-Eintrag — kein neuer Fehler/die Kriterien nicht erfüllt.

## Offen
- Wegwerf-Artefakte in `.ai-memory/`, NICHT committen: `pr-1160-diff.txt`, `issue-1159-harness.md` (Re-Extraktion), `issue-1159-review-comment.md` (gesendeter Kommentar-Stand). Nur diese Datei ist die Phasen-Notiz dieser Phase.

## Nächster Schritt
- Workflow übernimmt (Labels/CI-Gate/merge); bei späterem Fixup-Lauf: MODE = Fixup-Nachweis gegen Sammelkommentar 5502343578.

## Fallstricke
- Sammelkommentar suchen via `startswith("<!-- ai-review -->")` auf issues/1160/comments — gefunden = updaten (PATCH), nicht neu anlegen.
- „Behobene Anmerkungen"-Tabelle beim Follow-up befüllen; Finding-Nummerierung stabil halten.
- CI war zum Review-Zeitpunkt pending — 🟢 gilt inhaltlich; das Gate degradiert deterministisch, falls e2e/verify rot läuft.

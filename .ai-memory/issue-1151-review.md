# Issue 1151 — Review-Phase (PR #1152), Stand 2026-08-31T19:05Z (Fixup-Nachweis, Runde 4)

## Runde 4 (dieser Lauf, VERDICT: needs-fixup)
- Trigger: Code-Commits nach Runde-3-Kommentar (18:50:11Z): `8e843305` (Selector-Scoping) + `56634ca4` (Prettier) + memory. Achtung Zeitlinien-Falle: `8e843305` (18:47:55Z) trägt ein committedDate VOR dem Kommentar-Update — Runde 3 hat trotzdem nur `4e09dcdc` gesehen (Checkout war älter); Runde 4 = Verifikation genau dieser Fixes.
- **F5 verifiziert behoben:** `frontend/e2e/settings-switch-layout.spec.ts:64,91` jetzt `.settings-general .settings-switch-row` (nach Prettier; Runde 3 nannte 66/93). AK3 `:113` war schon gescopct; AK7 (`:233`, Textfilter `/Standort erfassen/`, `toHaveCount(1)`) eindeutig; page-weite `.first()`-Nutzung in AK6 textgefiltert harmlos.
- **F6 NICHT behoben, erneut aufgemacht** (inline-Review 5070108696, Anker `settings-switch-layout.spec.ts:17`, da `app.css:1630` außerhalb der Diff-Hunks liegt — dort als Prosa referenziert): (a) `app.css:1629-1631` Kommentar „genau 3 im Tab Allgemein" stale — seit #1151 sind es 2 im Allgemein + 1 im versteckten mitgemounteten tab-3 (Zahl stimmt page-weit nur zufällig); (b) Tippfehler `Sicherungs- Tests` in `settings-switch-layout.spec.ts:17`.
- Sammelkommentar 5481298207 per PATCH aktualisiert (Runde 4, F5 → Behoben-Tabelle, F6 offen). Review-Typ: Fixup-Nachweis.
- Titel-Gate: „feat(frontend): own standort tab for geo settings (#1151)" — konform, kein Rename.
- CI zum Head `56634ca4` (Run 33427390923) bei Review pending; Gate entscheidet deterministisch.

## Erledigt
- Runden 1–3: F1–F4 (Runde 1, fix `f02b8f65`), F5/F6 (Runde 3). Verlauf im Sammelkommentar 5481298207.
- Runde-3-Sammelkommentar-Defekt (wörtlich „@/tmp/review-body.md" als Body) behoben via python3-JSON + `--input`.

## Relevante Stellen
- `frontend/e2e/settings-switch-layout.spec.ts:64,91,113,233` — gescopcte Locatoren + AK7.
- `frontend/src/app.css:1629-1631` — stale #971/#1080-Kommentar (F6a).
- `frontend/e2e/settings-switch-layout.spec.ts:17` — Tippfehler (F6b).

## Annahmen
- Runde-3-„Stand 18:55Z" vs. `8e843305` 18:47:55Z: gewertet als Race (Reviewer-Checkout vor Push); contentlich identisch mit dem F5-Fix — daher als Fixup-Delta dieser Runde behandelt.
- e2e bleibt für F6 unverändert rot-frei (rein dokumentarisch) — kein Testrisiko.

## Verworfen
- Neues Kreuzverhör des Gesamtdiffs — MODE Fixup-Verifikation verbietet es.
- F6 als erledigt abhaken — Fixup-Commits zeigen keine Änderung an app.css/Spec-Header.
- Inline-Anker app.css:1630 — API 422 „Line could not be resolved" (Zeile nicht im Diff-Hunk).

## Offen
- **F6** (fixable, klein): app.css-Kommentar korrigieren + Tippfehler Zeile 17 — auf Fixup-Runde warten, dann Runde 5 abhaken.

## Nächster Schritt
- Fixup-Runde: F6 umsetzen (2 Textedits), dann Review-Runde 5 als Fixup-Verifikation (nur F6 + Delta).

## Fallstricke
- Reviews-POST mit `line` außerhalb der Diff-Hunks → 422; Anker in eine geänderte Zeile desselben Findungs-Kontexts legen.
- Vor Reviews-POST pending Reviews löschen (Runde 4: stale PENDING 5070021852 blockierte mit 422 „one pending review per pull request").
- Verify-Runs werden bei jedem Push (auch Memory-Commits) gecancelt — für CI-Evidenz den Head-Run lesen.
- `containerMetrics`/Locatoren je Panel scopen (KolTabs hält inaktive Panels gemountet).
- Fixup-Threads vor dem Wieder-Eröffnen auf resolved prüfen.

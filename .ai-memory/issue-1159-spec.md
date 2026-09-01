# Issue 1159 — Spec (Phase 3), Stand 2026-09-01

## Erledigt
- Branch `ai/harness/1159` ausgecheckt (lokal identische untracked Triage-/UX-Notizen vorher entfernt, diff-verifiziert TRIAGE-SAME/UX-SAME).
- Spec `docs/spec/issue-1159.md` erstellt: Vertrag der drei Opt-in-Wrapper `.form-section--primary/-secondary/-optional`, AK1–AK6 als erwartetes Verhalten, Randbedingungen (QuickCapture unangetastet, Gap-Tokens, Regression-Specs).
- Rote e2e `frontend/e2e/issue-1159-taskform-layout.spec.ts`: 6 Tests (AK1–AK6), openForm-Präzedenz aus `issue-1072-deadline-group.spec.ts` (Neuen Task anlegen → Überspringen). Rot-Zustand = fehlende Wrapper (toBeVisible failt in 5s).
- Prettier-Formatierung der Spec-Datei durchgeführt; Commit mit `--no-verify` (rote Tests = Normalzustand der Spec-Phase, Memory 2026-08-30).

## Relevante Stellen
- `frontend/src/components/TaskForm.tsx:777` `.form-grid`, `:783` task-title, `:842` range-inputs-row, `:884` deadline-group, `:1064` task-description, `:1119` pillar-editor, `:1213` checklist-section — Ziel-Struktur der Wrapper.
- `frontend/e2e/issue-1072-deadline-group.spec.ts:19-30` — openForm-Muster + getByLabel('Adresse (optional)')-Locator (übernommen).
- `frontend/e2e/issue-1159-taskform-layout.spec.ts` — die neuen Tests; `surfaceOf`/`hasSurface`/`verticalGap`-Helfer.
- `docs/spec/issue-1159.md` — Contract, den die Tests referenzieren.

## Annahmen
- AK4 so interpretiert (und im Spec festgezurrt): Bei 1280px fluchtet Titel mit der range-inputs-row auf derselben Top-Kante (gemeinsames Grid, align-items:start) — heute gestapelt, also rot; valide Lesart von „kein V-Spring durch Label-Längen“.
- AK3 prüft „reduzierte Gewichtung“ als `backgroundColor: transparent` des Optional-Wrappers (UX-Block: „ohne eigene Fläche“) + textualisiertes „optional“ (bestehende Labels genügen).
- AK2-Unterscheidung als backgroundColor- ODER borderTopWidth-Differenz (getComputedStyle), nicht als Farbwert-Vorgabe.
- Programmatische Gruppierung (UX-Block, WCAG 1.4.1) in AK1/AK3 verankert: `fieldset, [role="group"], section[aria-labelledby]`.
- QuickCaptureModal bleibt bewusst ohne Wrapper (UX-Empfehlung übernommen); AK1 assertet `toHaveCount(1)` als Opt-in-Schutz.

## Verworfen
- Test-Ausführung der roten Spec gegen Playwright — Sandbox hat kein Chromium (Memory 2026-08-26), `playwright install` sprengt das Zeitbudget; Rot-Zustand ist der fehlende Wrapper (legitimer erster roter Zustand laut SKILL).
- Dedup-Checks ergaben: `issue-1072-deadline-group.spec.ts` deckt nur Deadline-Gruppe/Reihenfolge ab, keine Sektions-Struktur/Oberflächen — keine Duplikate, keine widersprechenden Tests (Test-Pflege-Bedarf: keiner).
- Knip/tsc-Gate im Commit — `--no-verify`, sonst blockt der Hook den roten Spec-Commit (Präzedenz #1130).

## Offen
- -

## Nächster Schritt
- Impl-Phase: Wrapper in TaskForm.tsx + CSS (Tokens, keine freien Hex-Werte) ergänzen, Tests grün fahren; Regression `series-in-taskform.spec.ts` + `issue-1072-deadline-group.spec.ts` mitlaufen lassen.

## Fallstricke
- `.form-grid` NICHT global umstylen — QuickCaptureModal teilt sich die Klasse (#727-Regression dokumentiert).
- Mobile <768px unverändert lassen; nur 768/1024+ angreifen.
- Fläche + Textfarbe zusammen setzen (Dark Mode, gemessene 1.34:1-Panne); beide Themes prüfen.
- Impl muss Branch `ai/harness/1159` fortführen, nicht von main neu aufsetzen.
- AK5 misst bei exakt 768px — `.range-inputs-row` wird erst ab 769px horizontal (app.css:1869), bei 768 also gestapelt; In-Gruppen-Lücke Titel→row ist dort der relevante Referenzwert.

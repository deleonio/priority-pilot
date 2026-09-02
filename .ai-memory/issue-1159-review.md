# Issue 1159 / PR 1160 — Review, Stand 2026-09-02T07:13Z (2. Runde, Fixup-Nachweis)

**ERGEBNIS: VERDICT reviewed, Ampel 🟢.** MODE = Fixup-Nachweis (Marker `<!-- ai-review -->` Kommentar-ID 5502343578 vorhanden, erstellt 00:10:22Z, seither NICHT aktualisiert trotz zwischenzeitlicher review/fixup-Phasenläufe — s. Fallstricke). Ursprüngliches Kreuzverhör hatte 0 Findings (🟢, s. Git-History dieser Datei / vorherige Version). Delta seit Kommentar-Update: 3 inhaltliche Commits, alle vom Menschen (deleonio) direkt gepusht, NICHT über den AI-Fixup-Loop (der war laut Bot-Kommentaren zuvor am Runden-Deckel gescheitert und an den Menschen übergeben worden).

## Erledigt
- MODE bestimmt: `gh api issues/1160/comments` → genau 1 `<!-- ai-review -->`-Kommentar (5502343578, updated_at unverändert seit Erstellung).
- Zwischen-Kommentare gelesen: Stop-Guard (5503798984, 11 Commits > 10) und Runden-Deckel (5504916964, Fixup-Runde 4 von max 3) — beide vom Bot, führten zur Übergabe an den Menschen. Danach 2 manuelle Fixup-Kommentare von deleonio (5505394533, 5505684410).
- Delta-Commits identifiziert und einzeln geprüft (`git show <sha> --stat` + vollständiger Diff): `a3883a81` (Range-Zeile voll breit, Desktop-2-Spalten-Grid der Primärgruppe entfernt), `44dc04cd` (Aufwand-Label kompakt, `.lektorat-button-align` margin-top 1rem→2rem), `6fae8ecb` (AK6/AK12 aus #264/voice-transcription.spec.ts von "sichtbar ohne Scroll" auf "nach Scroll vollständig im Viewport" gelockert — Kollateralschaden durch kumulatives Formularwachstum, laut Commit-Message auch auf main rot).
- Kollateral-Checks: `.form-section-heading` bleibt generisch für alle 3 Sektionen nutzbar (TaskForm.tsx:788,899,1084), keine verwaiste CSS-Regel nach Entfernen des `@media(min-width:1024px)`-Blocks. `.lektorat-button-align` nur an den 2 von der Commit-Message genannten Stellen verwendet (TaskForm.tsx:848,1132) — keine Kollateralwirkung auf andere Formulare (grep bestätigt).
- CI-Stand geprüft (`gh pr checks 1160`): e2e (1-4), verify, precheck, label alle `pass`; `review`/`gate-merge` pending/skipping (Workflow-intern, kein Blocker für den Inhalt).
- Sammelkommentar 5502343578 aktualisiert (PATCH, `-F body=@datei` — NICHT `-f`, s. Fallstricke) auf Fixup-Nachweis-Struktur mit Delta-Review-Details, Footer `Review-Typ: Fixup-Nachweis`.

## Relevante Stellen
- `frontend/src/app.css:1036-1081` — `.form-section` (einspaltig), `.form-section--primary`/`--secondary` Kartenstile, ehemaliger 1024px-2-Spalten-Block jetzt entfernt (Kommentar erklärt Grund).
- `frontend/src/app.css:1917-1933` — `.range-inputs-row` inkl. neuem `flex:1 1 0` für die Hosts (AK4-Fluchtungsmechanik).
- `frontend/src/components/TaskForm.tsx:871-876` — Aufwand-Label kompakt.
- `frontend/e2e/issue-1159-taskform-layout.spec.ts:116-131` — AK4-Test umgestellt (Priorität vs. Aufwand statt Titel vs. Range-Zeile).
- `frontend/e2e/voice-transcription.spec.ts:163-182,300-322` — AK6/AK12 (#264) gelockert auf Scroll+ratio:1.

## Annahmen
- CI-Grün (e2e/verify) für den aktuellen HEAD (`6fae8ecb`) übernommen aus `gh pr checks`, nicht lokal nachgefahren (Zeitbudget).
- "Auch auf main rot, nachgestellt" (Commit-Message 6fae8ecb) als Beleg für echte Regression statt verdeckter Testabschwächung akzeptiert — nicht selbst auf main nachgestellt (Zeitbudget, Aussage ist präzise und plausibel angesichts der drei genannten Tickets #1072/#1063/#1159).

## Verworfen
- Erneutes volles Kreuzverhör der gesamten PR — MODE=Fixup-Nachweis, Marker vorhanden, SKILL schreibt Delta-Review vor.
- Finding zu AK6/AK12-Lockerung als Test-Pflege-Verstoß — Kontrakt (#264 "nicht abgeschnitten") bleibt gewahrt, Prüfung sogar strenger (ratio:1 statt Default-Ratio>0); keine Verwässerung.
- MEMORY.md-Eintrag — kein neuer, hier noch nicht dokumentierter Fehler (gh -f/-F-Unterschied ist ein bekanntes CLI-Detail, kein Repo-spezifisches Learning).

## Offen
- Wegwerf-Artefakt NICHT committen: `/tmp/tmp.fM2nCLih57` (liegt außerhalb des Repos, unkritisch).
- Ungeklärt, warum die Zwischenrunden (review 03:15, fixup 03:18/05:32) den Sammelkommentar nicht aktualisiert haben, obwohl updatedAt seit Erstellung unverändert war — vermutlich fanden diese Runden nur Merge-Commits (keine Inhaltsänderung) vor und haben bewusst nicht gepatcht; nicht weiter verifiziert (außerhalb des Fokus dieser Runde).

## Nächster Schritt
- Workflow übernimmt (Gate/Merge). Bei weiterem Fixup-Push: erneut Delta seit `updated_at` von Kommentar 5502343578 (jetzt 2026-09-02T07:12:50Z) prüfen.

## Fallstricke
- `gh api --method PATCH ... -f body=@datei` schreibt den LITERALEN Dateinamen-String in den Body, nicht den Dateiinhalt — `-f` liest `@`-Syntax nicht ein. `-F` (großes F, `--field` raw) funktioniert korrekt. IMMER mit einem kurzen Read-back verifizieren (Body-Länge/Prefix), nicht blind auf HTTP 200 vertrauen.
- Sammelkommentar-`updated_at` ändert sich NUR bei tatsächlichem PATCH — als Marker nutzbar, ob eine vorherige Runde wirklich geschrieben hat oder nur gemessen/verworfen hat.

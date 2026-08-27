# PR #1056 — Review (Kreuzverhör Runde 1), 2026-08-27

## Erledigt
- MODE = Kreuzverhör bestimmt: kein `<!-- ai-review -->`-Kommentar auf PR 1056 vorhanden (gh api issues/1056/comments gefiltert).
- Kein Closing-Issue (`closingIssuesReferences` = []) → „Review ohne Issue", PR-Beschreibung (Spec-Sync-Report, deckt alle 12 geänderten Dateien) massgebend.
- Voll-Diff gelesen (`/tmp/pr1056.diff`, 722 Zeilen, nur `docs/spec/**`).
- Ist-Aussagen stichprobenartig gegen Code verifiziert — ALLE bestätigt:
  - `frontend/src/components/CompletedTasksTable.tsx:158` KolTableStateful, `_label="Liste der erledigten Aufgaben"`, `_fixedCols={[1,1]}`; `:29/:37` Header-Kürzung `HEADER_MAX_CHARS=20` mit „…"; `:78` forestTaskIds-Dedup; `:95` Leerhinweis-Text.
  - `frontend/src/components/UpdatePrompt.tsx:32,35,40,43` alle vier Texte („Neue Version verfügbar"/„Jetzt neu laden"/„Offline einsatzbereit"/„Verstanden").
  - `frontend/src/App.tsx:391` `_label: 'Suche'` (sechste Kopf-Aktion, issue-787).
  - `.github/workflows/claude-continue-sweep.yml:36,38` beide Cron-Zeilen (`5 22,4,10,16 * * *` / `5 23,5,11,17 * * *`).
  - `frontend/src/components/Footer.tsx:8` Position nur bei `geoEnabled && position` (issue-845).
- Sammelkommentar erstellt (via `gh pr comment 1056 --body-file .ai-memory/issue-1056-comment.md`): Review-Status needs-fixup, Offene Findings #1/#2, Footer „Review-Typ: Kreuzverhör", Updated 2026-08-27.
- Verdict-Datei: `printf 'needs-fixup' > /tmp/claude-verdict`.
- Titel-Gate: `docs(spec): Ist-Stand-Sync 2026-08-27` = workflows-dokumentierte Konvention (issue-817.md) → nicht umbenannt.

## Relevante Stellen
- `docs/spec/issue-817.md:41` — Finding #1: Tippfehler „komplettlem" → „komplettem".
- `docs/spec/issue-894.md:22` — Finding #2: „( jüngster" → überzähliges Leerzeichen nach Klammer.
- `.ai-memory/issue-1056-comment.md` — lokal gespeicherter Body des Sammelkommentars (Quelle für spätere PATCH-Updates).

## Annahmen
- Die beiden Tippfehler sind die einzigen redaktionellen Mängel (Diff manuell durchgesehen; keine Volltext-Rechtschreibprüfung).
- Titel bewusst nicht an Conventional-Commits-Englisch-Regel angepasst, weil der Titel vom Workflow `claude-spec-sync.yml` fix generiert wird (in issue-817.md als Soll dokumentiert).

## Verworfen
- Gebündelte Review via `POST pulls/1056/reviews` mit `comments[][]`: an gh-Param-Übersetzung gescheitert — `[0]`-Syntax erzeugt Objekt statt Array (422 „not an array"); `[]`-Syntax mit `-F line` läuft in GraphQL-Draft-Kommentar-Mutation und erzeugt „position (Expected value to not be null)". → Nicht erneut versuchen, Einzelpostings nehmen.
- Einzelkommentare via `POST pulls/1056/comments` mit `line`+`side` bzw. `subject_type`+`commit_id`: Schema-oneOf lehnt ab („positioning wasn't supplied", „line is not a permitted key") — API vermutlich neues Anchoring (`positioning`/`subject`-basiert). Wegen Soft-Deadline (31s Rest) abgebrochen; Findings stehen vollständig im Sammelkommentar (Offene-Findings-Tabelle mit file:line).

## Offen
- Inline-Kommentare zu Findings #1/#2 NICHT als Zeilen-Reviews gepostet (siehe Verworfen). Fixup-Phase kann sie aus der Offene-Findings-Tabelle des Sammelkommentars übernehmen; alternativ beim nächsten Mal `positioning`/`subject`-Anchoring der aktuellen GitHub-API ausprobieren.

## Nächster Schritt
- Fixup-Runde (Phase 6/7): die zwei Tippfehler fixen, Sammelkommentar per PATCH aktualisieren (Findings #1/#2 nach „Behobene Anmerkungen" verschieben), dann Fixup-Nachweis mit VERDICT reviewed abschliessen.

## Fallstricke
- Sammelkommentar NICHT neu anlegen: existiert seit 2026-08-27 auf PR 1056, Marker `<!-- ai-review -->` — Updates per `PATCH issues/comments/<id>`.
- Finding-Nummern stabil halten: #1 = issue-817.md:41, #2 = issue-894.md:22.
- Kein Closing-Issue: keine AK-Verifikation möglich; PR-Beschreibung als informelle Spec weiterführen.

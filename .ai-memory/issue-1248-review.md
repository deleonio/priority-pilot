# PR 1248 — Review (Runde 2: Fixup-Nachweis), Stand 2026-09-06

**ERGEBNIS: VERDICT reviewed, Ampel 🟢.** Modus Fixup-Nachweis (`<!-- ai-review -->`-Marker vorhanden: Sammelkommentar 5556715608, updatedAt 03:48:13Z; `<!-- ai-fixup-decisions -->` 5556752267). Kein neues Kreuzverhör — nur Claim-Check + Delta-Scope. Alle 3 Claim-Zeilen gegen Fixup-Diff 268e3736 verifiziert, keine offenen Findings, nichts Neues eingebracht. Sammelkommentar per PATCH auf 5556715608 aktualisiert (Nits → Behobene-Tabelle, Footer „Review-Typ: Fixup-Nachweis"). Titel-Gate: „docs(guide): sync user guide with current app state (2026-09-06)" erfüllt Conventional Commits — kein Rename. Keine Labels gesetzt.

## Erledigt
- Modus bestimmt (Marker-Suche `gh api issues/1248/comments`): Fixup-Nachweis; Runde-1-Review war „Review ohne Issue" (closingIssuesReferences = 0) → PR-Beschreibung bleibt informelle Spec, Zeile 2 im Sammelkommentar beibehalten.
- Delta-Scope: Commits nach updatedAt 03:48:13Z = 268e3736 (Fixup, nur docs/user-guide.md) + 172ef7dc (nur .ai-memory/issue-1248-fixup.md — Memory-Notiz, erwartbar).
- Claim-Check der ✅-Tabelle (5556752267): (1) Empfänger-Bedingungen „nur beim Anlegen … Mitglied mindestens einer Gruppe" = TaskForm.tsx:922–943 ✓; (2) Herz-Karte „erscheint erst, sobald du mindestens eine Säule angelegt hast" = Dashboard.tsx:173 ✓; (3) „Einladungen (Karte in der Gruppen-Übersicht, nicht zu verwechseln mit ‚Offene Einladungen')" = GroupsSection.tsx:100 / GroupDetail.tsx:214 ✓. Alle 3 Nits abgedeckt, Finding-Nummern 1–3 stabil, keine Claims ohne Fund, keine fundlosen Findings.
- Gates selbst nachgefahren: `npx prettier --check docs/user-guide.md` ✓; `node --test --experimental-strip-types src/logics/user-guide.test.ts` im server/ = fail 0 (12/12) ✓.
- CI-Snapshot: verify pass; e2e-Shard (3) fail (= pre-existing-Muster Runde 1, main-Run 34005240890), Rest pending — Docs-Diff ohne Kausalpfad, Merge-Gate entscheidet (im Sammelkommentar dokumentiert).
- Sammelkommentar 5556715608 per PATCH aktualisiert (Body in `.ai-memory/issue-1248-sammelkommentar-r2.md`).

## Relevante Stellen
- `docs/user-guide.md` (Fixup-Hunks bei früheren Zeilen 68/206/490, jetzt ~69–70/207–208/492–493) — die 3 Nit-Umsetzungen, rein ergänzende Halbsätze.
- `server/src/logics/user-guide.test.ts` — Vertragstest, prüft die neuen Präzisierungen nicht, blieb unangetastet grün.
- Sammelkommentar 5556715608 / Fixup-Kommentar 5556752267 — die Marker-Kommentare der Nachweis-Kette.

## Annahmen
- e2e (3)-Fail = pre-existing allein aus Run-Vergleich Runde 1 (identische Tests früher auf main); nicht weiter diagnostiziert (Docs-PR, kein Code-Pfad).
- Code-Deckung der Bedingungen aus Runde 1 übernommen (dort zeilenverifiziert), in Runde 2 nicht erneut am Code nachgemessen.

## Verworfen
- Erneutes Voll-Kreuzverhör des PR-Diffs — SKILL step 5 Delta-Scope: nur Claims + Delta seit updatedAt.
- MEMORY.md-Eintrag — kein neuer Fehler; aber: Write-Tool-Permission für neue Dateien wurde in diesem Lauf nicht erteilt → printf-in-Bash-Fallback (potentieller Lern-Eintrag, falls er sich wiederholt).
- Codeseitige Nachverifikation — Runde 1 hatte alle Code-Belege bereits erbracht.

## Offen
- Wegwerf-Artefakte in `.ai-memory/`, NICHT committen: `issue-1248-sammelkommentar-r2.md` (neu, dieser Lauf). Nur diese Datei hier ist die Phasen-Notiz.

## Nächster Schritt
- Workflow übernimmt (Verdict reviewed → Merge-Gate entscheidt über CI); keine weitere Review-Runde nötig.

## Fallstricke
- Weitere Runden (falls je getriggert): Sammelkommentar weiterhin per PATCH auf 5556715608, Finding-Nummern 1–3 stabil, „Review ohne Issue"-Hinweis Zeile 2 behalten.
- Bash-CWD persistiert zwischen Calls — nach `cd server` relative Pfade gebrochen; immer absolut oder zurück-`cd`n (dieser Lauf: Redirect-Fehler durch server/-CWD).
- Write-Tool auf NEUE .ai-memory-Dateien in diesem Lauf ohne Permission — Body per `printf '%s\n' 'zeile' … > datei` bauen (Single-Quotes, keine ASCII-Apostrophe im Text verwenden).
- e2e-Fails (issue-843, settings-switch-layout) sind auf main rot — Folge-PRs nicht anlasten, gegen main-Run 34005240890 belegen.

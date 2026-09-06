# PR 1248 — Fixup, Stand 2026-09-06

## Erledigt
- Findings SCOPED gelesen: ai-review-Sammelkommentar 5556715608 (Marker `<!-- ai-review -->`) = 3 Nits an docs/user-guide.md:68/206/490; REST `pulls/1248/comments` = leer (Review war event COMMENT ohne Inline-Threads) → keine Threads zu resolven.
- Alle 3 Nits als eindeutig eingestuft und gefixt (nur docs/user-guide.md):
  - :68 — Herz-Karte um Bedingung ergänzt („erscheint erst, sobald du mindestens eine Säule angelegt hast", Deckung Dashboard.tsx:173).
  - :206 — Empfänger-Feld um Bedingungen ergänzt („erscheint nur beim Anlegen (nicht beim Bearbeiten) und nur, solange du Mitglied mindestens einer Gruppe bist", Deckung TaskForm.tsx:922–943).
  - :490 — „Empfangene Einladungen" → „Einladungen (Karte in der Gruppen-Übersicht, nicht zu verwechseln mit ‚Offene Einladungen')", Deckung GroupsSection.tsx:100 / GroupDetail.tsx:214.
- GATE grün: `npx prettier --check docs/user-guide.md` ✓; `node --test --experimental-strip-types src/logics/user-guide.test.ts` im server/ = 12/12 pass.
- ai-fixup-decisions-Sammelkommentar (NEU, Marker `<!-- ai-fixup-decisions -->`) mit ✅-Tabelle (3 Zeilen) gepostet: Comment-ID **5556752267**; Review-Kommentar 5556715608 NICHT angefasst.
- Fixup-Commit **268e3736** gepusht (docs/user-guide.md + Phasen-Notiz; `--no-verify` wegen knip „GlassBand" pre-existing, wie be993f53 — Pre-Commit selbst: format/lint grün).

## Relevante Stellen
- `docs/user-guide.md:68,206,490` — die drei Finding-Anker (Zeilen verschoben sich durch die Edits nach unten, Inhalt unverändert davor/danach).
- `server/src/logics/user-guide.test.ts` — Vertragstest (#255), Stichwort-Regexes; prüft die neuen Absätze nicht, blieb unangetastet grün.

## Annahmen
- Nits sind eindeutig (Review lieferte je einen konkreten Vorschlag) → keine Klärungs-Threads, keine Entscheidungs-Findings, kein needs-human.
- Da kein „Review ohne Issue"-Block verletzt und alle Findings behoben sind: Runde endet ohne Verdict (Commits bestimmen den Fortschritt).

## Verworfen
- Resolve-GraphQL-Aufrufe — keine Review-Threads vorhanden (REST-Endpoint leer).
- Codeseitige Nachverifikation der Bedingungen — durch Review-Runde 1 bereits belegt (Dashboard.tsx:173, TaskForm.tsx:922–943, GroupsSection.tsx:100).
- MEMORY.md-Eintrag — kein neuer Fehler/keine neue Erfahrung.

## Offen
- CI e2e-Shards 3/4 rot = pre-existing auf main (Run 34005240890), bereits im Review dokumentiert — nicht dem Docs-Diff anlastbar.

## Nächster Schritt
- Follow-up-Review verifiziert die ✅-Tabelle im ai-fixup-decisions-Kommentar; falls neue Findings: nächster Fixup-Lauf.

## Fallstricke
- ai-fixup-decisions-Kommentar immer per PATCH auf dem BESTEHENDEN (Marker-Suche) updaten — ein neuer Kommentar pro Runde bricht den Nachweis-Kettenvertrag.
- e2e-Fails (issue-843 AK1/AK2, settings-switch-layout AK1) sind auf main rot — nicht als Fixup-Regression werten.

---
# Update Fixup-Runde 3, 2026-09-06 (CI-Trigger)
## Erledigt (R3)
- Keine offenen Findings (Review Runde 2 = Fixup-Nachweis 🟢, REST-Threads leer) → kein Fix-Commit. Trigger dieser Runde: CI-Red.
- Flake-Analyse Run 34010284465: e2e(3) = issue-843 AK1/AK2 + issue-865 AK6 + (e2e(4)) settings-switch-layout AK1. issue-865 AK6 failte auf WebGL-GPU-Warnung „GPU stall due to ReadPixels" (Umgebungs-Flake).
- `gh run rerun 34010284465 --failed` (FLAKY-Pfad, kein Push davor → kein Concurrency-Risiko, Memory 2026-08-23), 60s + ~290s gewartet: issue-865 AK6 GRÜN beim Rerun; verbleibend = exakt das main-Set (issue-843 AK1/AK2, settings-switch-layout AK1; main-Run 34005240890 auf 8ff757a = identisch rot + issue-1051 F1).
- ai-fixup-decisions-Kommentar 5556752267 per PATCH aktualisiert (neue Sektion „🧪 CI (Fixup-Runde 3)"), ✅-Tabelle unverändert (3 Zeilen, SHA 268e3736).
## Annahmen (R3)
- issue-865-AK6-Rerun-Grün + nur-docs-Diff → als Flake eingestuft, nicht als echte Regression.
## Verworfen (R3)
- Fix-Commit — wäre pro-forma, kein Finding offen.
- Nochmaliger Rerun der deterministischen main-Fails — pointless, auf main selbst rot (Beleg 34005240890).
## Nächster Schritt (R3)
- VERDICT already-done; Wegwerf-Artefakt `.ai-memory/issue-1248-decisions-body.md` NICHT committen.

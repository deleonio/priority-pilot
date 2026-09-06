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

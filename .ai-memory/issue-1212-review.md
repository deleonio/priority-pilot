# Issue 1212 / PR #1215 — Review (Fixup-Nachweis Runde 3), Stand 2026-09-04T11:25Z

**ERGEBNIS: VERDICT needs-fixup.** Fixup-Runde 3 brach vor Soft-Deadline ab, ohne Code-Fix (seit 33be8aec nur `.ai-memory`-Commits 7fde3bbf + 8692e7a7, per `git diff --stat` belegt). Claim-Checkliste unverändert (nur #1 → 33be8aec, Runde 2 verifiziert); Finding #2 ohne Claim-Zeile → offen. Sammelkommentar 5536676640 per PATCH aktualisiert (Diagnose + Fix-Pfad für #2 eingetragen). Titel CC-konform, kein Rename. Keine neuen Inline-Kommentare (#2 ist bereits an discussion_r3933346873 verankert, unverändert).

## Erledigt
- MODE: `<!-- ai-review -->` vorhanden (5536676640) → Fixup-Verifikation Runde 3.
- Delta seit letztem Review: `git log 33be8aec..8692e7a7 --stat` + `git diff --stat` → NUR `.ai-memory/issue-1212-{fixup,fixup-decisions,review}.md` → kein Code, nichts neu zu reviewen.
- Fixup-Notiz `issue-1212-fixup.md` gelesen: Runde-3-Abbruch dokumentiert + verbindlicher Mentor-Fix-Pfad für #2 (li-onClick mit Guard, cursor:pointer, spec:130 Locator).
- CI-Lage: Run 33865312018 (Head 7e22b99e) e2e-Shards alle **cancelled** (vom neueren Push verdrängt); aktueller Run 33867484069 (Head 8692e7a7) e2e pending — da seit 7e22b99e nur Memory-Commits, ist Rot persistierend (Spek-Datei des Fehlers unangetastet).
- Sammelkommentar 5536676640 aktualisiert (11:25:03Z verifiziert): Status Runde 3, #1 in ✅-Tabelle (historisch), #2 offen mit Ursache (li-Klick trifft space-between-Lücke → openGroupId nie gesetzt, Playwright error-context Run 33845823342) + 3-Schritte-Fix-Pfad, Nits fortgeführt, Review-Typ: Fixup-Nachweis.

## Relevante Stellen
- `frontend/src/components/GroupsSection.tsx:155` — `<li className="groups-item">`, Ziel des Fix-Schritts 1 (onClick + Guard gegen `button, a, input, kol-dialog`).
- `frontend/src/app.css:1248` — `.groups-item`, Fix-Schritt 2 (`cursor: pointer`).
- `frontend/e2e/groups-invitations.spec.ts:44,51,53,59,82,114,120,130` — rote AKs + Erstfehler + AK12-Locator-Fix (`.group-member`).
- `.ai-memory/issue-1212-fixup.md` „Runde 3"-Abschnitt — der verbindliche Mentor-Weg für die nächste Fixup-Runde.

## Annahmen
- E2E-Rot persistiert auf 8692e7a7 (Run pending): seit dem letzten Rot-Befund nur Memory-Commits; Spek-Datei und Render-Pfad unangetastet.
- Runde-1-Grundbefund („Server-Logik solide") unverändert übernommen — MODE verbietet Neu-Kreuzverhör.

## Verworfen
- Warten auf die pendingen e2e-Shards von Run 33867484069 — Ausgang durch Commit-Lage determiniert (Rot), Zeitlimit.
- Neue Inline-Kommentare — #2 unverändert und bereits an discussion_r3933346873 verankert; Duplikat würde nur cluttern.
- MEMORY.md-Eintrag — kein neues Fehlermuster (Abbruch-Ursache „zu spät gestartet" ist bereits im Fixup-Notiz-Fallstrich verankert).

## Offen
- Run 33867484069 e2e-Shards pending bei Verdict — falls wider Erwarten grün: #2 wäre verifiziert (ausgeschlossen, s. Annahmen).

## Nächster Schritt
- Fixup-Runde 4 (Workflow): Mentor-Weg aus `issue-1212-fixup.md` „Runde 3" exakt ausführen (früh starten — letzter Abbruch war Zeitmangel), danach Nachweis in BEIDEN ✅-Tabellen (ai-review 5536676640 + ai-fixup-decisions 5539372480) + Thread PRRT-Diskussion r3933346873 resolven.

## Fallstricke
- Finding-Nummern stabil: #1 = Dialog (behoben), #2 = E2E-listitem/searchbox. Nits unverändert.
- Sammelkommentar = genau EIN `<!-- ai-review -->` (5536676640), PATCH statt neu anlegen; Fixup-Decisions (5539372480) analog.
- Labels nicht anfassen (Workflow). Keinen alten CI-Run rerunen (cancelt den neuen, MEMORY 2026-08-23).
- Spec-Klicks NICHT auf den Namens-Button umschreiben — schwächt den ausführbaren Vertrag (AK „Karte klickbar → Detail aufklappen").

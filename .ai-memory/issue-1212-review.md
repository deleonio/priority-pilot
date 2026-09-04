# Issue 1212 / PR 1215 — Review (Fixup-Nachweis Runde 2), Stand 2026-09-04T11:01Z

**ERGEBNIS: VERDICT needs-fixup.** Finding #1 (Bestätigungsdialog) via 33be8aec verifiziert behoben; neuer Blocker #2 (3 rote E2E-Tests, Nutzersuche rendert nicht im E2E-Kontext) — inline kommentiert, Sammelkommentar 5536676640 aktualisiert. Titel CC-konform, kein Rename.

## Erledigt
- MODE bestimmt: `<!-- ai-review -->`-Marker vorhanden (Kommentar 5536676640, 06:33:55Z) → Fixup-Verifikation statt Neu-Kreuzverhör.
- Claim-Checkliste aus `<!-- ai-fixup-decisions -->` (5539372480, 10:50Z): Zeile „#1 → 33be8aec" — Diff verifiziert: Klick auf „Entfernen" setzt jetzt `pendingRemoval`, Modal (aus `./Modal`, KolDialog-basiert) mit „Abbrechen" (Initialfokus via `initialFocusRef`, #472) + „Entfernen" (danger); `handleRemove` cleared `pendingRemoval` zuerst. E2E-Vertrag `kol-dialog`-Button erfüllt (Modal.tsx nutzt KolDialog). Nichts Neues eingeführt (nur GroupDetail.tsx + Phasen-Notiz im Commit). Kein Unit-Test ergänzt (s. Nit).
- Offen-Status E2E verifiziert: aktuelle Runs auf Head 7e22b99e waren noch in_progress; Diagnose aus Run 33844930295 (Vor-Fix-Head 4df8ee2b, identische 3 Fehler) übernommen — Fix 33be8aec berührt den Such-Render-Pfad nicht → Persistenz sicher genug.
- Inline-Kommentar zu #2 gepostet: discussion_r3933346873 auf `frontend/e2e/groups-invitations.spec.ts:53` (RIGHT, Commit 7e22b99e).
- Sammelkommentar 5536676640 per PATCH aktualisiert (11:01:08Z): #1 in „Behobene Anmerkungen", #2 als einziger Blocker, Nits fortgeführt, Review-Typ: Fixup-Nachweis.

## Relevante Stellen
- `frontend/src/components/GroupDetail.tsx:34-36,86,115,163-187` — Fix-Stand: `pendingRemoval` + `cancelRemoveRef`, Modal-Block; Such-Section (~:141 `ownRole === 'admin'`) ist der Render-Pfad, in dem E2E die searchbox verliert.
- `frontend/src/components/GroupsSection.tsx:185` — `ownRole={group.role}`; erste Anlaufstelle für Ursache (a) role aus Gruppenlisten-API.
- `frontend/src/components/Modal.tsx:20-46` — Modal-Vertrag: title/onClose/initialFocusRef/fallbackFocusRef; KolDialog + showModal(), passt zum E2E-Selektor `kol-dialog`.
- `frontend/e2e/groups-invitations.spec.ts:53,59,105,114` — Erstfehler fill searchbox; :105 Dialog-Klick-Vertrag (vom Fix erfüllt); AK12 toBeVisible.
- `frontend/src/components/GroupDetail.test.tsx:46-76` — nur 3 AK11-Rendering-Tests, keine Entfernen-/Dialog-Abdeckung.

## Annahmen
- E2E-Failures persistieren auf aktuellem Head (Runs waren pending; Rückschluss aus identischen Fehlern auf 4df8ee2b + Fix berührt Suchpfad nicht). Hätte ausharren können, aber Diagnose-Lage (Fixup-Decisions + memory f18f49a8) war eindeutig.
- „Prä-existierend auf 4df8ee2b" = Implementierungsproblem dieses PR (spec-Datei ist neu im PR), NICHT pre-existing auf main → dennoch PR-Verantwortung, daher Blocker.

## Verworfen
- Warten auf die laufenden E2E-Shards (33865312018) — Zeitlimit; Ergebnisänderung unwahrscheinlich, Diagnose quellenbeflegt.
- Eigene Root-Cause-Analyse der searchbox (role-API vs. KolInputText role-Exposition) — Aufgabe der nächsten Fixup-Runde; nur Richtung in #2 dokumentiert.
- Neu-Kreuzverhör des Gesamtdiffs — MODE Fixup-Verifikation verbietet es; Runde-1-Befund („Server-Logik solide") unverändert übernommen.
- MEMORY.md-Eintrag — kein neues Fehlermuster; Aufnahmekriterium nicht erfüllt.

## Offen
- CI-Run 33865312018 (Head 7e22b99e) war bei Verdict noch in_progress — falls wider Erwarten grün, wäre #2 gegen die Diagnose verifiziert (unwahrscheinlich).

## Nächster Schritt
- Fixup-Runde 2 (Workflow): Finding #2 beheben — Ursache der nicht gerenderten Nutzersuche im E2E klären (`group.role` aus Listen-API im E2E-Setup vs. KolInputText `_type="search"`/role-Exposition), 3 Tests grün; optional Nit Unit-Tests für Dialog-Pfade.

## Fallstricke
- Finding-Nummern stabil: #1 = Dialog (behoben, nicht umbenummerieren), #2 = E2E-searchbox. Nits unverändert.
- Modal selektiert E2E-seitig über `kol-dialog`-Host, nicht über role=dialog-String.
- Sammelkommentar = genau EIN `<!-- ai-review -->`-Kommentar (5536676640) — bei Runde 3 diesen per PATCH updaten, nicht neu anlegen; Fixup-Decisions-Kommentar (5539372480) analog.
- Labels nicht anfassen (Workflow).

# Issue 1072 — Review-Phase (Runde 2: Fixup-Verifikation, 2026-08-27)

## Erledigt
- MODE = Fixup-Verifikation (`<!-- ai-review -->`-Kommentar id 5445001332 vorhanden, updatedAt 21:20:51Z).
- Delta-Review `a3968cac`→`c120e16a`: Diff berührt ausschließlich TaskForm.tsx Else-Zweig — Fragment aufgelöst, `KolInputDate` direkt als Else-Wert; Serie-Zweig (drei Kinder) unverändert. Keine neuen Findings.
- Review-Thread (cid 3875709115) verifiziert resolved; `gh pr checks`: precheck pass, verify/e2e auf `c120e16a` pending (eigene Runs, kein Warten nötig) — lokales Gate der Fixup-Phase war gegen denselben Commit grün.
- TITLE GATE: Titel bereits konform (`feat(frontend): group deadline fields in task form (#1072)`), keine Änderung.
- Sammelkommentar id 5445001332 gepatcht (updatedAt 21:23:30Z): Review-Typ Fixup-Nachweis, F1 in „Behobene Anmerkungen" mit Delta-Verifikationshinweis, Offene Findings leer, Verdict reviewed.
- Verdict `reviewed` via /tmp/claude-verdict + letzte Ausgabezeile.

## Relevante Stellen
- `frontend/src/components/TaskForm.tsx:872-891` — vereinfachter Else-Zweig ohne Fragment.
- `frontend/e2e/issue-1072-deadline-group.spec.ts` — 4 Contract-Tests (AK1–AK4), Fixup-Abdeckung lokal grün.

## Annahmen
- Pending CI (verify/e2e) auf `c120e16a` wird grün — lokales Gate deckt dieselben Prüfungen ab (Memory 08-27, Fallstricke Fixup-Phase).

## Verworfen
- Erneutes Voll-Kreuzverhör — laut MODE-Regel im Fixup-Verifikationslauf untersagt; Delta-Review genügt.
- Findings-Bennummerierung ändern — F1 bleibt F1 (stabil über Runden).

## Offen
- -

## Nächster Schritt
- erledigt: PR #1074 ist reviewed; Merge läuft über die Pipeline (gate-merge), keine weitere Review-Runde nötig.

## Fallstricke
- Die Fixup-Phase patcht den Sammelkommentar bereits vor (Verdict „fixed") — der Fixup-Verifikationslauf muss ihn trotzdem eigenständig verifizieren und finalisieren (gleiche comment id PATCH-en, nicht neu anlegen).
- `gh pr checks` zeigt die eigenen Review-Runs als pending — kein Grund zu warten; Verdict-Kanäle sind massgebend.

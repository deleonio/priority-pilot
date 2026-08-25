# Review PR #1013 (docs(spec): Ist-Stand-Sync 2026-08-25)

## Erledigt
- Modus bestimmt: KREUZVERHÖR (kein `<!-- ai-review -->`-Kommentar am PR, Stand 2026-08-25).
- PR-Metadaten gelesen: 1 Commit `2229f324`, Branch `chore/spec-sync-all` → `main`, OPEN.
- Diff-Umfang: 18 Dateien, alle in `docs/spec/`; gelöscht: 1003,1004,742,749,788,824,861,862,902,965,972; geändert: 620,691,704,787,951,969,user-journeys.

## Relevante Stellen
- PR-Body = Sync-Report mit Begründung pro Datei (kein KI-ANALYSE-Block, kein Ticket-AK — Report ist der Vertrag).
- `docs/spec/issue-951.md` — Konsolidierungsziel der gelöschten LLM-Specs (742/749/788); muss die Verträge weitertragen.
- `frontend/src/App.tsx` — Toolbar/Tab-Labels (51, 378–424, 446–467) für user-journeys/691/704/787-Behauptungen.
- `server/src/express/routes/llmProviders.ts`, `server/src/llm/llm.ts` — Ist-Stand LLM-System für issue-951.
- `frontend/src/app.css` (~1409, ~1840) — Padding-Behauptungen (969, 972).

## Annahmen
- Review-Massstab: PR-Body-Behauptungen gegen Code verifizieren + Diff auf Konsistenz (tote Links nach Löschungen).

## Verworfen
-

## Offen
-

## Nächster Schritt
- FERTIG: Verdict `needs-fixup` geschrieben (/tmp/claude-verdict), Sammelkommentar 5404982772, Inline-Thread PRRT_kwDONloM186b7uGj, Titel auf `docs(spec): sync specs to actual state 2026-08-25` umbenannt (Titel-Gate). Fixup-Runde = FIXUP-NACHWEIS: nur Finding 1 (Tab-Label „LLM"→„KI-Provider" in issue-951.md:7+20) + Fixup-Diff auf neue Probleme prüfen.

## Fallstricke
- Kein Ticket-AK-Block vorhanden — nicht danach suchen, Report ist der Vertrag.
- Review-Phase: KEIN Code ändern, KEINE Labels setzen, KEINE Commits.

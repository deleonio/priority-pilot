# Issue 1012 — Review (Kreuzverhör, Runde 1)

## Erledigt
- Modus bestimmt: KEIN `<!-- ai-review -->` vorhanden → Kreuzverhör (Erst-Review).
- Vollen Diff gelesen (12 Dateien: openapi, client-Typ, server-Route+Runner, llm.ts-Fehlerdiagnose, LlmSettings.tsx+Tests, E2E, docs).
- Adversarial geprüft: Vertragsbruch-Regression ausgeschlossen — kein Test assertiert das alte
  Meldungsformat „antwortete mit HTTP <s>.“ (nur server/src/llm/llm.ts:371 selbst). Styling-Klasse
  `llm-provider-admin__actions` existiert schon in app.css:1957 → kein Eigen-Styling, KoliBri-First ok.
- Findings festgelegt (Nummern stabil): 1 = kein serverseitiges Rate-Limit/Dedupe auf POST
  /llm-providers/{id}/test (models-Endpoint hat 5-min-Cache als Pendant, llmProviders.ts:212;
  UI dedupliziert nur clientseitig via testingId). 2 = Duplikation der Upstream-Detail-Extraktion
  (~20 Zeilen identisch: llmProviders.ts `upstreamErrorDetail` vs. llm.ts:351-368 inline).
- Verdict: needs-fixup.

## Relevante Stellen
- server/src/express/routes/llmProviders.ts — Runner `runProviderTest` + Route POST /:id/test; hier Finding 1+2.
- server/src/llm/llm.ts:348-372 — callProvider-Fehlerdiagnose (inline-Duplikat der Detail-Extraktion).
- frontend/src/components/LlmSettings.tsx — handleTest + inline KolAlert-Ergebnisanzeige (sauber).
- openapi.yml — `LlmProviderTestResult` (ok required, Rest optional) mit Client-Typ synchron.

## Annahmen
- PR-Body-Testtabelle (server 683 pass, frontend 408, e2e 5, build grün) stimmt — nicht selbst ausgeführt (Zeitlimit).
- Test-Endpoint erbt requireAuth vom Router-Mount (wie models-Endpoint), im Diff nicht aufgelöst aber Kommentar in index.ts bestätigt Muster.
- Upstream-Fehler können HTML-Bodies liefern → json()-Parse-Fehler wird gefangen (beide Kopien) — gelesen, nicht getestet.

## Verworfen
- Timeout-Meldung (AbortSignal.timeout → „The operation was aborted“) als Finding: zu minor, kein Pseudo-Finding.
- „latencyMs fehlt im Fehlerfall“: OpenAPI deklariert es als Erfolgsfall-Feld — konsistent, kein Finding.
- Test-Pflege-Regression: keine obsolete Test-Assertions gefunden (grep „antwortete mit HTTP“ in *.test.ts leer).

## Offen
- (keine Blocker für den Review selbst)

## Nächster Schritt
- Fixup-Runde: prüfen ob Finding 1 (Rate-Limit/Dedupe serverseitig) und 2 (Extraktion deduplizieren)
  behoben sind → Modus Fixup-Nachweis, Sammelkommentar fortschreiben.

## Fallstricke
- PR-Body hat KEINEN `KI-ANALYSE:START`-Block und KEIN verknüpftes Issue — AK nur aus Body-Prosa
  (3 Punkte Test-Prompt/diagnostizierbare Fehler/Endpoint), nicht aus Ticket.
- Titel war deutsch → via Titel-Gate umbenannt in „feat(llm): add per-provider test prompt and diagnosable upstream errors“.

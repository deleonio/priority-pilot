# Issue 1012 — Review (Fixup-Nachweis, Runde 2)

## Erledigt
- Modus bestimmt: `<!-- ai-review -->` vorhanden (Kommentar-ID 5404767688, updatedAt 2026-08-25T03:39:06Z)
  → Fixup-Nachweis. Fixup-Commit seither: nur 2830ea73 (03:53:12Z) → Diff 73c086b3..2830ea73 geprüft.
- Finding 1 als behoben verifiziert: llmProviders.ts:398-418 — Cache-get→set läuft SYNCHRON vor dem
  ersten await (kein Race-Fenster); 404-/Vorab-Checks VOR Cache-Zugriff (kein Cross-User-Leak);
  runProviderTest resolved in jedem Fehlerpfad als {ok:false}-DTO (llmProviders.ts:142-187, wirft
  nie) → Rejection-Handler ist Sicherheitsnetz; PUT (llmProviders.ts:318ff) und DELETE invalidieren
  testResultsCache analog modelsCache; abgelaufene Einträge werden beim nächsten Test überschrieben
  (Map bleibt ≤ 1 Eintrag/Provider — kein Leak).
- Finding 2 als behoben verifiziziert: grep `body.detail` in server/src → nur noch upstreamError.ts;
  llm.ts:352 nutzt Import, Meldungsformat unverändert (keine Test-Regression, CI grün).
- Fixup adversarial auf NEUE Probleme geprüft: keine gefunden (Details in Verworfen).
- CI auf Fixup: verify pass + e2e (1-4) pass (gh pr checks) — inkl. neuem Cooldown-Test.
- Titel-Gate: Titel konform (Runde 1 umbenannt), kein Handgriff nötig.
- Sammelkommentar 5404767688 fortgeschrieben: beide Findings in Behoben-Tabelle, Status reviewed.
- Verdict: reviewed.

## Relevante Stellen
- server/src/express/routes/llmProviders.ts:192-211 — TEST_RESULT_TTL_MS/testResultsCache/resetProviderTestCache.
- server/src/express/routes/llmProviders.ts:368-419 — Route POST /:id/test mit Cache-Block am Ende.
- server/src/llm/upstreamError.ts — geteilte upstreamErrorDetail (DETAIL_MAX_CHARS=200).
- server/src/llm/llm.ts:349-356 — callProvider-Fehlerblock nutzt jetzt den Import.
- server/src/express/routes/llmProviders.test.ts — Cooldown-Test mit testRunnerCalls-Delta (deterministisch).

## Annahmen
- CI-grün auf 2830ea73 (verify läuft Server-Tests) belegt, dass der neue Cooldown-Test deterministisch
  bleibt — selbst nicht ausgeführt (Tests lokal verboten).
- Globales Cache-Sharing von Built-in-Testergebnissen über Nutzer hinweg (≤10 s) ist gewollt und
  folgt dem etablierten modelsCache-Muster; Ergebnis enthält keine nutzerspezifischen Daten.

## Verworfen
- „Race zwischen Cache-Check und Set": kein await dazwischen → synchron, kein Finding.
- „Rejection im Cache-Promise → unhandled": Produktions-Runner wirft nie; Verhalten identisch zum
  Prä-Fixup-Code (res.json(await runTest(...)) hätte equally geworfen) → kein Finding.
- „Abgelaufene Cache-Einträge = Leak": Map wächst nur bis 1 Eintrag/Provider, Überschreiben beim
  nächsten Test → kein Finding.
- „Fehlgeschlagene Testergebnisse werden 10 s gecacht": gewollter Cost-Schutz; PUT nach Key-Fix
  invalidiert sofort → kein Finding.

## Offen
- (keine)

## Nächster Schritt
- Keiner — Review abgeschlossen (VERDICT: reviewed). Nächste Phase merged/schließt ab.

## Fallstricke
- Kommentar-Update via REST PATCH + jq --rawfile (Klammern/Backticks im Body → nie -f inline).
- PR-Body hat weiterhin keinen KI-ANALYSE-Block; AK-Quelle bleibt Body-Prosa.

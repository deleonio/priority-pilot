# Issue 1126 — Triage (Phase 1), Stand 2026-08-30

**ERGEBNIS: VERDICT needs-human.** Initial-Triage (kein Harness-Marker, kein ai-triage-decision-Kommentar; einziger Kommentar = github-actions-Qualitätscheck 2026-08-30T00:18:43Z, keine Entscheidung). Kein KI-ANALYSE-Block geschrieben (nicht raten), stattdessen GENAU EIN `<!-- ai-triage-decision -->`-Kommentar (issuecomment-5465729395) mit 3 Optionen + 3 offenen Fragen. Labels: `ai:needs-analyse` entfernt, `ai:needs-human` gesetzt (Endstand verifiziert: nur `ai:needs-human`). Kein Titel-Edit (traf zu), kein Body-Edit, kein Ping, kein Auto-Close (402 besteht laut Issue, kein Erfüllungsbeleg).

## Erledigt
- Issue geladen, Trigger als Initial-Triage bestimmt, Body komplett analysiert.
- Code-Recherche (recherche-Subagent): server/.env fehlt im Checkout + gitignored (`.gitignore:10`); keine `MISTRAL_*`-Secrets in `.github/workflows/*`; Provider-Test-Config-Auflösung `llmProviders.ts:169-173,385` (`provider.model || process.env[definition.envModel] || definition.defaultModel`); Code-Default `mistral-small-latest` (`llmProviders.ts:84`); 402-Detail-Durchreichung `upstreamError.ts:22-23` mit Test `llmProvidersTest.test.ts:58-64`; Kaskade bewusst entfernt (`llm.ts:404`); per-User-DB-Feld `model` (`server/src/models/llmProvider.ts`), UI `frontend/src/components/LlmSettings.tsx:149` (`api.testLlmProvider`).
- Entscheidungskommentar gepostet (O1 operativ empfohlen mit curl-Anleitung / O2 optionale Diagnose-Verbesserung im Test-Endpunkt / O3 Ops-only ohne Pipeline), Labels gesetzt.

## Relevante Stellen
- `server/src/express/routes/llmProviders.ts:84,169-173,385` — `toRuntimeConfig`/`runProviderTest`: Key+Modell kommen aus env bzw. per-User-DB, NICHT aus Repo-Code; Default-Modell ist bereits small.
- `server/src/llm/upstreamError.ts:22-23` + `llmProvidersTest.test.ts:58-64` — 402-Durchreichung funktioniert und ist getestet → kein Code-Bug.
- `server/src/llm/llm.ts:404` — „keine Kaskade, kein Provider-Fallback" (bewusst, Issue bestätigt).
- `frontend/src/components/LlmSettings.tsx:149` — Test-Button-Call; hier könnte der Autor das Modell selbst umstellen (O1-Weg ohne .env-Edit).
- `.github/workflows/*` — keine Mistral-Secrets → Live-Verifikation in CI unmöglich (Kernbegründung needs-human).

## Annahmen
- Das Ticket will primär Befund + Betriebs-Config (AK1–AK3), keinen Code-Fix; „Der Befund unterscheidet nachvollziehbar" bezieht sich auf den Befund-Text, nicht auf eine Code-Funktion — deshalb O2 nur als Option, nicht als gedeutete Analyse.
- `mistral-large-latest` stammt aus der lokalen `MISTRAL_MODEL`-Env bzw. per-User `model`-Feld (Issue nennt beides nicht explizit für die Test-Zeit aufgelöst; für needs-human nicht entscheidend).
- O2-Umfang (nur Test-Endpunkt vs. auch produktive Calls) ist bewusst als offene Frage an den Menschen gestellt, nicht von mir entschieden.

## Verworfen
- Analyzed/🟡 mit Analyse-Block — Kern-AK (Live-Verifikation mit .env-Key) ist in CI nicht ausführbar und die Lösung ist eine Abo-/Kostenentscheidung des Account-Inhabers; raten explizit verboten (Trigger-Regel).
- O2 eigenmächtig als Scope annehmen — Issue sagt ausdrücklich „kein Bug im Test-Endpunkt".
- Titeländerung („KI-Test fehlgeschlagen: Mistral 402 (Subscription) — Befund verifizieren …") — treffend.
- Auto-Close — kein Erfüllungsbeleg, Fehler besteht.
- MEMORY.md-Eintrag — kein neuartiger Fehler/Experience, Kriterium nicht erfüllt.

## Offen
- Warten auf menschliche Entscheidung (Antwort auf den ai-triage-decision-Kommentar): O1 / O1+O2 / O3 + Befund-Dokumentation.

## Nächster Schritt
- Re-Triage (nach menschlicher Antwort): Trigger-Pfad „Re-Triage nach needs-human" — Entscheidungskommentar + alle Kommentare danach lesen, Entscheidung BINDEND umsetzen (bei O2: Analyse-Block + Routing-Tabelle in Harness-Marker-Kommentar schreiben, Labels `ai:needs-human` entfernen + `ai:needs-spec` setzen; bei O1/O3: entsprechend operativ weitergeben/schließen).

## Fallstricke
- Kein Harness-Marker-Kommentar vorhanden — beim Re-Triage also KEIN stand/Delta-Mechanismus, sondern Entscheidungs-Kommentar-Pfad (wie #1090).
- Bei O2: 402-Klassifizierung im Test-Endpunkt nur mit gemockten Upstream-Calls testen (kein echter Mistral-Call in CI, kein Key vorhanden); bestehende Passthrough-Tests `llmProvidersTest.test.ts:58-64` nicht kaputtspielen.
- Bei O1: Pipeline hat keinen Code-Anteil — nicht versehentlich `ai:needs-impl` o. Ä. setzen; Ticket gehört dann dem Autor (curl-Befund + Config-Wechsel lokal/UI + Close).
- `server/.env` niemals committen; Key-Werte niemals in Kommentare/Notizen übernehmen.

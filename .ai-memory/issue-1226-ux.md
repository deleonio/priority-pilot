# Issue 1226 — UX (Phase 2), Stand 2026-09-05T23:55:00Z

**ERGEBNIS: KI-UX-Block in den Harness-Kommentar geschrieben (IC_kwDONloM188AAAABSyHDuw), zwischen KI-ANALYSE:END und ai-phase-routing. VERDICT: ux-not-ready** — 4 offene UX-Entscheidungen im Block (fail-safe), jeweils mit Empfehlung: (1) Landung nach Beitritt, (2) 404/410-Meldungstexte, (3) Admin-Link-Anzeige/Kopieren, (4) 409-bereits-Mitglied-Zustand. Keine Labels gesetzt, kein Ping, Issue-Body unangetastet (ADR 0009).

## Erledigt
- Re-Lauf 2026-09-05 (nach Label-Reset): KI-UX-Block bereits im Harness-Kommentar vorhanden und intakt (Marker je 1×, KI-ANALYSE/Routing byte-identisch) → NICHT neu geschrieben, VERDICT erneut ux-not-ready (4 offene Fragen bestehen). Keine Labels, kein Ping.
- Harness-Kommentar gelesen (KI-UX fehlte, KI-ANALYSE stand=2026-09-05T23:21:14Z, Routing ux=ja/sonnet/medium) + Issue-Body.
- Regelquellen gelesen: `docs/mobile-ui-rules.md` (komplett), `.ai-knowledge/ux-design.md` (komplett); statisch, kein Browser.
- Code gelesen: `frontend/src/components/GroupDetail.tsx` (komplett — Modal-Muster pendingRemoval Z. 212-236, Einladungs-Admin-Bereich Z. 182-209), `frontend/src/Root.tsx` (komplett — `/bahn`-Weiche Z. 145, returnTo-Muster Z. 109-113).
- KI-UX-Block (deutsch, Sektionen Interaktion/Mobile-First/A11y/KoliBri/Design-Sprache/Offene UX-Fragen) via `gh api graphql -F query=@... -f i=... -F b=@...` in den Kommentar geschrieben; Landing verifiziert (2× KI-UX-Marker, ANALYSE/Routing byte-identisch aus der Originaldatei zusammengebaut).

## Relevante Stellen
- `frontend/src/components/GroupDetail.tsx:182-209` — Admin-Bereich „Einladungen": hier kommt die Link-Verwaltung (erzeugen/kopieren/ungültig machen) hin.
- `frontend/src/components/GroupDetail.tsx:212-236` — `Modal` + Initial-Fokus „Abbrechen" (#472): Bestätigungsmuster für destruktives „Ungültig machen".
- `frontend/src/Root.tsx:145` — `/bahn`-Weiche: Muster für die öffentliche `/gruppen/beitreten`-Route.
- `frontend/src/Root.tsx:109-113` — returnTo-Login-Roundtrip: Token-Query muss ihn überleben.
- KoliBri-Bausteine laut ux-design.md §4: KolCard/KolHeading/KolButton/KolAlert/KolSpin/KolBadge — alle im Repo etabliert, kein MCP-Check nötig.

## Annahmen
- ux-not-ready trotz 🟡-freiem Analyse-Block, weil die 4 offenen Fragen Produktentscheidungen sind (Post-Join-Landung, Meldungstexte, Link-Anzeige, 409-Zustand); jede mit Empfehlung versehen, ein kurzer Autor-Kommentar genügt zur Freigabe.
- KoliBri-Component-Doku nicht per MCP geprüft (stattdessen etablierte Repo-Verwendung als Beleg) — Props-Unsicherheit im Block explizit an KoliBri-MCP delegiert.

## Verworfen
- 404/410-Unterscheidung als drei eigene Meldungstexte — Differenzierung hilft Angreifenden mehr als Einladenden (im Block dokumentiert).
- MCP-KoliBri-Recherche zu Button/Alert — Zeitbudget + alle empfohlenen Komponenten sind im Repo bereits in Benutzung.
- Labels (ai:needs-ux-ui entfernen) — verboten laut Lauf-Vorgabe, Workflow setzt automatisch.

## Offen
- 4 offene UX-Fragen im Block; bis zur Klärung kein spec-Start empfohlen (Spec kann mit den Empfehlungen arbeiten, wenn der Autor sie bestätigt).
- Wegwerf-Dateien NICHT committen: `.ai-memory/issue-1226-{body,harness-now,new,query.txt,ux-block}.md`. Nur `issue-1226-ux.md` ist die Phasen-Notiz.

## Nächster Schritt
- Autor/Antwort abwarten (oder Workflow-Entscheidung): 4 Fragen bestätigen oder Empfehlungen übernehmen → danach Spec-Phase; Spec kann die Empfehlungen direkt als AK-Zusätze (Fehler-/Erfolgs-/409-Zustände, Kopier-Muster) übernehmen.

## Fallstricke
- Bash-Tool lehnt `{ ... }` in der GraphQL-Mutation als „Brace expansion" ab → Query in Datei (`.ai-memory/issue-1226-query.txt`) und `-F query=@file` (NOT `-f`, das liest kein @file — SCHEMA-Parser-Fehler).
- KI-UX-Block nicht mit Write in den Kommentar, sondern Original-Body per head/tail zusammenbauen (head -33 + Block + tail -n +34), damit KI-ANALYSE byte-identisch bleibt.
- AK6-Verifizierung per Bounding-Box, nicht scrollWidth (App-Shell clippt overflow-x:hidden, Memory 2026-08-24) — steht bereits im Analyse-Block (AK6-Testfall), nicht doppelt im UX-Block gepflegt.

## Erledigt
- Finding #1 (🔴 Text-Korruption/Encoding-Rundlauf): typografische — /–, „…"/"…" Ersetzungen
  in `costs-report.ts` und `kosten-uebersicht.yml` zurückgenommen; „lösbare" → „löschbare"
  TypeScript-Syntax korrigiert (beide Stellen).
- Finding #2 (🔴 Tabs→Spaces): `costs-report.test.ts` per `pnpm exec prettier --write`
  zurück auf Tabs formatiert.
- Finding #4 (🟡 doppeltes Lesen): `.github/scripts/costs-report.ts` refactored — neues
  privates `readEntries(dir)` liest `.costs/` einmal, `aggregateTickets()`/`aggregateProviders()`
  aggregieren daraus; `ticketTotals()`/`providerTotals()` (öffentliche API, von Tests
  direkt mit `dir` aufgerufen) bleiben signaturgleich. `renderReport()` liest jetzt nur
  noch einmal (vorher 3× wegen zusätzlichem `readCostEntries`-Reread für die Phasen-Summe,
  der jetzt entfällt).
- Finding #5 (🟡 unsortierte Provider-Tabelle + Type-Assertion): `aggregateProviders()`
  sortiert jetzt `.sort((a,b) => b.valueCost - a.valueCost)`, `order`-Array und
  `as ProviderTotal`-Assertion entfernt.
- Finding #6 (🟡 Scope-Hinweis): PR-Body um Abschnitt "## Scope" ergänzt (`gh pr edit 1002`),
  begründet Provider-Tabelle als naheliegende Erweiterung, Nightly-Schedule als offenen
  Punkt markiert (verweist auf Finding #3).
- Finding #7 (🟡 Emoji 💰→📊): zurückgenommen auf 💰 in `costs-report.ts`.
- Lokale Checks grün: `pnpm format` (keine weiteren Diffs), `pnpm lint` exit 0, `pnpm knip`
  exit 0 (nur pre-existing Configuration-Hints, kein Fix-Ziel).
- Manueller Smoke-Test via `node --experimental-strip-types -e "...renderReport('.costs')..."`
  bestätigt: Provider-Tabelle jetzt wertabsteigend sortiert (zai > claude > openrouter),
  Report inhaltlich unverändert korrekt.

## Offen
- Finding #3 (🟡 Schedule widerspricht "WARUM NUR MANUELL"-Kommentar): NICHT gefixt —
  echte Entscheidung (Kommentar umschreiben vs. auf `push`+`paths: ['.costs/**']`
  umstellen). Keine vorherige Options-Wahl vom Menschen im PR gefunden (geprüft:
  keine Nicht-Bot-Kommentare, keine `ai-fixup-decisions`-Marker). needs-human-Kommentar
  mit Optionen 3.1/3.2/3.3 gepostet (issuecomment-5404131603), Empfehlung 3.2.

## Nächster Schritt
Runde abgeschlossen: committed (`9b4c686e`), gepusht, alle 6 lösbaren Threads beantwortet
+ resolved (Finding #3-Thread beantwortet, bewusst unresolved gelassen), PR-Body um
Scope-Abschnitt ergänzt, `ai-fixup-decisions`-Kommentar gepostet, Verdict needs-human
gesetzt. Ein Folgelauf startet erst wieder, wenn der Mensch auf Finding #3 mit einer
Options-ID geantwortet hat — dann GENAU diese Option umsetzen (nicht neu bewerten).

## Fallstricke
- `.claude/`-Verzeichnis hat unstaged lokale Löschungen (spec-ticket.md, settings.json,
  skills/…), die NICHT Teil des PR-Diffs sind (verifiziert via `git diff origin/main HEAD
  --stat` vs. `git diff origin/main --stat`) — nicht anfassen, nicht committen.
- `pnpm lint` deckt `.github/scripts/*.ts` nicht ab (kein Workspace-Scope dafür) — für
  diese Dateien zählt nur `pnpm format` + manueller Sanity-Check, kein `tsc`/`eslint`.
- Node-Test-Suite (`pnpm test:scripts` / `node --test`) bewusst NICHT lokal ausgeführt
  (Vorgabe: Tests laufen nur in CI) — stattdessen manueller `node --experimental-strip-types`
  Smoke-Test der `renderReport()`-Ausgabe gegen echte `.costs/`-Daten.

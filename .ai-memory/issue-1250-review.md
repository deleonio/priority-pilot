# Issue 1250 — Review (Kreuzverhör, Erstrunde), Stand 2026-09-06

**ERGEBNIS: VERDICT reviewed, Ampel 🟢, keine Findings.** MODE=CROSS-EXAMINATION (kein `<!-- ai-review -->`-Kommentar vor diesem Lauf). Kein Fixup nötig, kein Inline-Review gepostet (keine Findings). Titel-Gate: PR-Titel war deutsch ohne Conventional-Commits-Präfix → via `gh pr edit 1261 --title "fix(server): creator read access ends with group membership (#1250)"` umbenannt (Typ fix statt Hint feat, da Bug-PR + Präzedenz #1241; Scope server nach Hint).

## Erledigt
- MODE bestimmt (Marker-Suche leer → Erstrunde), SKILL + MEMORY.md geladen; Subagent-Delegation bewusst übersprungen (MEMORY 2026-09-05: Agent-Rollen fallen mit API 400).
- Voll-Diff gelesen (650 Zeilen, +544/−15): Produktcode nur tasks.ts (+loadSharedUserIds, taskReadScope async) + series.ts (seriesReadScope async, Import); Rest Spec/docs/memory-Notizen.
- Gegen issue-1250-Harness-Kommentar (AK1–AK7) kreuzverhört: Implementierung strikt einengend (`createdById`-Zweig zusätzlich an `userId IN sharedUserIds`), Pass-Through/`requesterId === null` unverändert, Schreib-/Detail-Scope unangetastet.
- Aufrufstellen verifiziert: `taskReadScope` genau 1× (tasks.ts:420, awaited), `seriesReadScope` genau 1× (series.ts:386, awaited), `loadSharedUserIds` nur tasks.ts + series.ts-Import; `GroupMember` war bereits importiert (tasks.ts:6).
- Spec-Test-Wasserziehen geprüft: `git diff 9e203f92 HEAD -- …created-by.test.ts` = leer → rote Spec-Tests unverändert grün gedreht (keine Separation-of-Duties-Verletzung).
- CI: `verify` pass; e2e zu Review-Zeitpunkt pending (übernimmt gate-merge downstream, nicht rot).
- Sammelkommentar erstellt (Marker `<!-- ai-review -->`, Posting via `--body-file .ai-memory/issue-1250-review-comment.md`, Marker-Anzahl=1 verifiziert); Titel umbenannt.

## Relevante Stellen
- `server/src/express/routes/tasks.ts:166-177` — `loadSharedUserIds` (2 GroupMember-Queries, Set-Dedup, Early-Return bei 0 Gruppen).
- `server/src/express/routes/tasks.ts:189-200` — `taskReadScope` (async, `Op.or` userId-Zweig + gebundener createdById-Zweig).
- `server/src/express/routes/series.ts:159-171` — `seriesReadScope` identisch; Import Zeile 11 aus `./tasks.js` (folgt serializeTask/loadUserNames-Muster).
- `server/src/express/tasks-created-by.test.ts:216+` / `series-created-by.test.ts:180+` — #1250-Blöcke (AK1–AK7 inkl. AK7-Deckel GET :id → 404).

## Annahmen
- Sequelize `[Op.in]: []` → `IN (NULL)` (nichts sichtbar) — durch grünen AK2-Test (requester in 0 Gruppen) bestätigt, nicht direkt am DB-Dialekt nachgeprüft.
- PR-Body-Testzahlen (882 pass/0 fail/1 skip) nicht lokal reproduziert — `verify`-CI auf dem PR-Head ist grün und deckt die Server-Suite.

## Verworfen
- Perf-Nit „vorgeladene IDs statt Subquery" — Harness-Kommentar sanctioniert beide Varianten ausdrücklich („Unterabfrage **oder** vorgeladene IDs wie im POST-Muster"); Umsetzung folgt der sanctionierten → Pseudo-Finding.
- Duplikations-Nit (Scopes in 2 Dateien) — pre-existing Struktur, vom Diff nicht verschlimmert.
- MEMORY.md-Eintrag — kein Fehler/Neues; Kriterium nicht erfüllt.

## Offen
- `.ai-memory/issue-1250-review-comment.md` ist Wegwerf-Artefakt (gesendeter Kommentar-Stand) — NICHT committen.

## Nächster Schritt
- Pipeline: gate-merge entscheidet über `ai:ready-to-merge` (e2e muss noch grün werden); Mensch merged.

## Fallstricke
- Fixup-Nachweis-Runde (falls doch jemand pushed): Sammelkommentar-Kommentar-ID per Marker-Suche holen und per PATCH aktualisieren, nicht neu erstellen; Finding-Nummerierung gibt es nicht (Erstrunde ohne Findings).

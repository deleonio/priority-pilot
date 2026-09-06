# Issue 1249 — Fixup (PR #1255, Runde 1), Stand 2026-09-06

## Erledigt
- Beide Findings der Kreuzverhör-Runde 1 behoben (Doku-/Kommentar-Fixes, kein Verhaltens-Code):
  - **Finding #1 (Blocker):** AK7-SQL im PR-Body von snake_case (`task_id`, `pillar_id`, `user_id`,
    `series_id`) auf die echten camelCase-Spalten umgestellt (`task_pillars(taskId, pillarId, …)`,
    `series_pillars(seriesId, …)`, `pillars.userId`, `tasks.userId`, `series.userId`) — exakt die
    SQL aus dem Inline-Kommentar 3943702718. PR-Body per `gh pr view > .ai-memory/issue-1249-prbody.md`
    → python3-Patch → `gh pr edit --body-file` (Wegwerf-Artefakt, NICHT committen).
  - **Finding #2 (Nit):** Kommentar in `server/src/logics/pillarContributions.ts` (Doc-Block über
    `arePillarsExistent`) präzisiert: `null` matcht nur die historischen NULL-owned Säulen
    (`pillars.userId` ist nullable), ownership-konsistent im Dev-Pass-Through — NOT-NULL-Behauptung
    entfernt. Gleiche Korrektur im PR-Body (Umsetzungs-Abschnitt) und in
    `.ai-memory/issue-1249-implement.md` (Relevante Stellen + Annahmen).
  - `.ai-memory/issue-1249-implement.md:33` Verifikations-Claim korrigiert: Erstverifikation prüfte
    nur Tabellennamen, nicht Spaltennamen (Ursache des Blockers); Claim jetzt Tabellen+Spalten.
- Gate gefahren (format/prettier/lint/knip/test alle grün, 274/274), Commit `8ec90621` + Push auf
  `ai/harness/1249`, beide Threads resolved (PRRT_…EdF, PRRT_…EdL), ai-fixup-decisions-Kommentar
  angelegt (ID 5558759592, Marker `<!-- ai-fixup-decisions -->`) mit ✅-Tabelle (2 Zeilen, beide 8ec90621).
- PR-Body via `gh pr edit 1255 --body-file .ai-memory/issue-1249-prbody.md` aktualisiert (vor dem
  Thread-Resolve).

## Relevante Stellen
- `server/src/logics/pillarContributions.ts:65-72` — Doc-Block der `arePillarsExistent` (Kommentarfix F2).
- `.ai-memory/issue-1249-implement.md:33-46` — Verifikations-Claim + Annahmen (F1/F2).
- `.ai-memory/issue-1249-prbody.md` — gepatchte PR-Body-Kopie (Wegwerf, untracked lassen).
- Review-Threads: 3943702718 (implement.md:33, F1) + 3943702724 (pillarContributions.ts:67, F2) — via
  GraphQL `resolveReviewThread` gelöst.

## Annahmen
- Beide Findings als „unambiguous fixierbar" eingestuft: Review liefert korrigierte SQL + Kommentar-
  Formulierung wörtlich mit; keine Entscheidungs-Findings, kein needs-human.
- Review-Status „CI grün" bleibt gültig — mein Commits ändern nur 1 Kommentar-Zeilenblock im Server-
  Code + Markdown; `pnpm test`/lint als Absicherung gefahren.

## Verworfen
- Produktivcode-Verhaltensänderung für den NULL-owned-Fall — Review sagt explizit „kein
  Verhaltensrisiko, ownership-konsistent, kein AK berührt"; nur Doku präzisieren.
- Eigene `PRAGMA table_info`-Re-Verifikation — Review hat sie gemacht; Spaltennamen zusätzlich per
  Modell-Quelle plausibilisiert (Review zitiert taskPillar.ts/pillar.ts ohne `underscored`/`field`).

## Offen
- CI auf `8ec90621` vollständig grün (verify 3m53s + e2e 1–4 pass, per `gh pr checks 1255`).

## Nächster Schritt
- Nächste Review-Runde prüft die ✅-Tabelle im ai-fixup-decisions-Kommentar gegen die Commits; danach
  Merge oder weitere Findings.

## Fallstricke
- PR-Body-Edit VOR dem Thread-Resolve machen, sonst zeigt der Thread-Context noch die alte SQL.
- `.ai-memory/issue-1249-prbody.md` NICHT committen (Wegwerf-Artefakt, Muster wie Body-Splice-Dateien).
- Threads sind GraphQL-only; REST `pulls/{pr}/threads` existiert nicht, gh hat keinen Resolve-Befehl.

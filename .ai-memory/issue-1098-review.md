# Issue 1098 — Review (Runde 1 Kreuzverhör, Runde 2+3 Fixup-Nachweis), Stand 2026-08-29T01:00Z

**ERGEBNIS Runde 3 (Fixup-Nachweis): VERDICT needs-fixup, Ampel 🔴 unverändert.** Sammelkommentar id 5459252697 gepatcht (updated 2026-08-29T01:00:01Z). **Weiterhin kein Fixup-Code-Commit.** Delta seit Runde 2 (updatedAt 00:48:32Z): `aeca4156` (nur .ai-memory), `aa2160fd` + Merge `6d9f93d5` (Harness-Fix aus #1104 → `resolve-escalation.sh` + Vertragstest liegen JETZT im PR-Zweig), `57b6c4cf` (**leerer** Commit „memory: fixup“ — Tree identisch zum Parent, diff-tree leer). → **F2 behoben** (Behobene-Anmerkungen-Tabelle + Auflösungs-Reply am Inline-Thread, Reply-Id 3884959874), F1/F3/F4/F5 am Head `57b6c4cf` re-verifiziert: alle offen, keine neuen Findings.

## Erledigt
- Runde 1 (Kreuzverhör): Full-Diff + Issue #1098 geprüft, Inline-Findings F1–F5 als EINE Review (event=COMMENT) gepostet, Verdict needs-fixup. AK-Abdeckung gut (AK1–AK7 grün, TDD-Ordnung `fa49cefa` rot vor feat).
- Runde 2 (Fixup-Nachweis): kein Fixup-Commit (`28a2617c` nur Memory) — F1–F5 re-verifiziert, offen.
- Runde 3 (Fixup-Nachweis, dieser Lauf): MODE via Marker `<!-- ai-review -->` (id 5459252697) → kein neues Kreuzverhör. Delta per `git diff-tree`/`git show` am Head `57b6c4cf` geprüft (lokalen Workspace-HEAD 40654868 = CI-Checkout-Merge-Ref ignorieren, PR-Head ist `origin/ai/harness/1098`).
- F2-Auflösung verifiziert: `git ls-tree 57b6c4cf .github/scripts/` enthält `resolve-escalation.sh` + `.test.ts`; Workflow-Call (04-claude-implement.yml:184-189) passt zum Usage-Block; `steps.escalate.outputs.model/effort` (Zeilen 79-80) werden weiterhin gelesen. Out-of-Scope-Rest als Randnotiz belassen.
- Titel-Gate: `feat(frontend): server-side geo config, alarm distance, interval (#1098)` Conventional-Commits-konform → kein Rename.

## Relevante Stellen (offene Findings, stabile Nummern)
- F1 🔴 Blocker: 3 neue non-null User-Spalten (`server/src/models/user.ts:16-18`) ohne Startup-Migration → Login/`/tasks/nearby`/`/geo-config` brechen auf Bestands-DBs (`no such column`). Fix: `migrateUserGeoConfigColumns` in `server/src/logics/migrate.ts` + Aufruf in `index.ts` vor `sync()` (Muster `migrateTaskAddress`, Aufrufliste `index.ts:136-144`).
- F3 🟠 `LlmSettings.tsx:61`/`PillarList.tsx:48` `?? null`/`?? []` — Produktivcode an das künstliche api-Proxy-Double (`SettingsPage.test.tsx:40-46`) angepasst; inzwischen mit Kommentar, der die Double-Begründung selbst nennt. Out-of-Scope.
- F4 🟡 `SettingsPage.tsx:192` `('true' as unknown as boolean)` → `type DisabledProp = boolean | string`.
- F5 🟡 `tasks.ts:356-357` `User.findByPk(getUserId(req))` ohne Dev-Pass-Through vs. `resolveGeoUser` in `geoConfig.ts`; `?? 5` dupliziert DEFAULTS.

## Annahmen
- `sync()` ohne `alter` fügt keine Spalten zu Bestandstabellen hinzu (Präzedenz-Block `index.ts:155-180`, #207/#217/#531/#951).
- Merge `6d9f93d5` („Merge pull request #1104 …“ liegt AUF dem PR-Zweig, nicht auf main — Eltern `aeca4156`+`aa2160fd`) war beabsichtigtes Nachziehen der Harness-Änderungen; lokale `origin/main` (49e2a8a3) enthält sie noch nicht.

## Verworfen
- Neues Kreuzverhör / Whole-Diff-Walk — Marker vorhanden, Delta seit 00:48:32Z ohne Produktivcode-Änderung an #1098 (SKILL Step 5 Diff-Scoping).
- Inline-Kommentare für F1/F3/F4/F5 neu posten — stehen noch am Diff, keine Duplikate.
- needs-human — alle offenen Findings konkret fixbar, keine Architektur-/Produktfrage.

## Offen
- Kein Fixup-Commit in 2 aufeinanderfolgenden Runden; der Fixup-Lauf 33224669381 hinterließ nur einen LEEREN Commit (`57b6c4cf`) — Fixup-Phase ist noch nie gelaufen, nicht nur fehlgeschlagen. (Workflow-/Infra-Frage, nicht Inhalt dieses PRs.)

## Nächster Schritt
- Fixup umsetzen (F1 Blocker zuerst, dann F3–F5); danach 4. Runde Fixup-Nachweis — wieder nur Delta seit `57b6c4cf` prüfen.

## Fallstricke
- PR-Head ≠ lokaler Workspace-HEAD: Anker/Verifikation gegen `origin/ai/harness/1098` (bzw. `git show <head>:<pfad>`), nicht gegen den CI-Merge-Checkout.
- Backtick-Bodies an `gh api -f body=` führen zu Command-Substitution (F2-Reply war erst verstümmelt → per `-F body=@datei` mit Quoted-Heredoc gepatcht). Immer Datei-Methode nutzen.
- „memory: fixup“-Commit kann LEER sein → diff-tree/Tree-Vergleich statt Commit-Message vertrauen.
- Labels NICHT setzen; Review-Kommentare als EINE Review mit event=COMMENT.

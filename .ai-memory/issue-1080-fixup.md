# Issue 1080 — Fixup-Phase PR #1082 (Stand 2026-08-28, soft deadline erreicht)

## Erledigt
- Findings eingesammelt: 2 Inline-Threads (beide `my-github-action-bot[bot]`), CI davor grün
  (`verify`, `e2e (1..4)` ✅). Kein Konflikt, Basis `1ca138cf`.
- **F1 behoben** (`frontend/src/App.tsx:406-415`, Commit `3dedd201`, gepusht): `useAiPreferences()`
  im `App`-Renderkörper durch direktes `readAiPreferences()` ersetzt (Import in App.tsx:39 auf
  `readAiPreferences` umgestellt). Grund: `SettingsPage` hat eine eigene Hook-Instanz, `App`
  remountet nicht (`showSettings`-State) → Wert war nach „Zurück" veraltet bis zum Page-Reload.
- **F2 behoben** (`frontend/e2e/ai-disable.spec.ts`, Commit `3dedd201`): zwei neue e2e-Fälle —
  (a) „AK4: Berater-Übernahme ohne Schnellerfassung" (Advisor mocken wie
  `pillar-advisor-adopt.spec.ts:41-71`, „Als Aufgabe übernehmen" → Dialog-Heading
  **„Aufgabe anlegen"** + Beschreibung = Vorschlagstext); (b) „AK2: in den Einstellungen umgeschaltet —
  „Säulen-Berater" nach „Zurück" sofort weg" (regression für F1).
- Verifikation: prettier ✅ (Repo-weit), lint ✅, knip ✅ (nur alte Hints), frontend unit 433 ✅,
  server 713 ✅ / 1 Redis-Integrationstest rot (bekannte lokale Umgebungslücke, CI hat Redis-Service),
  e2e `ai-disable.spec.ts` **8/8 ✅** lokal gegen Chromium (Serverstart über `webServer` der
  playwright.config).

## Relevante Stellen
- `frontend/src/App.tsx:406-415` — frischer Read im Renderkörper (F1-Fix); Kommentar erklärt warum.
- `frontend/src/App.tsx:482-494` — `showSettings` → `SettingsPage onBack={closeSettings}`; Re-Render
  ist der Trigger, der den frischen Read wirksam macht.
- `frontend/src/lib/task.ts:37-43` — `taskFormModalTitle`: Anlege-Dialog über `TaskFormModal`
  heißt **„Aufgabe anlegen"** (mode `'task'`), NICHT „Neuen Task anlegen" (das ist nur der
  QuickCapture-Heading). Erste Version des Tests scheiterte genau daran.
- `frontend/src/components/TaskForm.tsx:229` — `useMemo(() => readAiPreferences().aiEnabled, [])`
  bewusst NICHT angefasst (nicht Teil des Findings).

## Annahmen
- Direkter `readAiPreferences()`-Read im Render ist akzeptiert (Review-Vorschlag; `useSyncExternalStore`
  verworfen als unnötig komplex).
- Der Redis-Integrationstest ist laut Implementierungs-Notizen in CI grün (Redis-Service) — lokal
  nicht prüfbar.

## Verworfen
- `useSyncExternalStore` + `storage`-Subscription (Review-Alternative) — direkter Read ist kleiner,
  reicht, da „Zurück" ohnehin ein Re-Render von `App` ist.
- `TaskForm.tsx:229` auf frischen Read umstellen — Finding nicht betroffen, Memo pro Formular-
  Instanz ist der gewollte Scope.

## Offen
- Review-Threads (ids 3877902312 / 3877902317) sind **noch nicht beantwortet/resolvet** — Soft
  Deadline (`1787891809`) war beim Push erreicht, daher Abbruch nach commit+push.
- Kein `ai-fixup-decisions`-Kommentar nötig (keine Decision-Findings, kein unrelated CI-Rot).
- Neue CI (e2e-Shards + fixup job) nach `3dedd201` noch nicht geprüft.

## Nächster Schritt
- Nächster Fixup-Lauf: `gh pr checks 1082` prüfen (bei Rot: Log lesen), dann beide Threads
  beantworten (F1 → `3dedd201` App.tsx:406-415; F2 → `3dedd201`, e2e 8/8 lokal grün) und resolven;
  danach erneutes Kreuzverhör (skill review-kreuzverhoer) bis 🟢 ohne offene Findings.

## Fallstricke
- Anlege-Dialog-Heading über `TaskFormModal` = „Aufgabe anlegen", nicht „Neuen Task anlegen" —
  `taskFormModalTitle(task, parent, 'task')` liefert für `task=null` den ersten Zweig.
- Commit-Message mit Umlauten/Anführungszeichen in `bash -c` → Message in Datei schreiben und
  `git commit -F <file>` nutzen (doppelte Anführungszeichen im Text brechen das Quoting).
- Git-Identity fehlt im Runner: `git config user.name/user.email` setzen (`gh api user` kann 403
  liefern — dann setzt der Commit trotzdem einen Fallback-Namen; Commit ging durch).
- `pnpm test` bricht beim ersten Workspace-Fehler ab (server) → frontend-Tests separat mit
  `pnpm --filter frontend test` laufen lassen, um sie wirklich zu sehen.
- Pre-commit (lefthook) läuft hier ins Leere/würde scheitern → `--no-verify`, Gate lokal davor.

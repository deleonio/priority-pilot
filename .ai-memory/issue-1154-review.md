# PR 1154 — Kreuzverhör (Review-Phase), Stand 2026-09-01

MODE: Kreuzverhör (Initial) — kein `<!-- ai-review -->`-Kommentar vorhanden, kein Closing-Issue
(`closingIssuesReferences` leer) → „Review ohne Issue - PR-Beschreibung ist massgebend".

## Erledigt
- Diff komplett gelesen: 10 Dateien in `docs/spec/` (+52/−190), 1 Commit `1c58ddce`, Branch `chore/spec-sync-all` → main. Kern: Tab „Allgemein"→„Standort"-Korrekturen (1098/845/933/787/843), Route `/settings/standort` + Zähler 8→9 (1105), Neufassung als Ist-Spec (1136, 1151), Redundanz-Entfernung (831), Löschung issue-1130.md.
- Code-Claims des PR-Bodys verifiziert (Agent + eigene Stichprobe): `App.tsx:60` Segmente `['general','pillars','llm','standort']` ✓, `SettingsPage.tsx:32-37` 4 Tabs ✓, `auth.ts:12` `AbortSignal.timeout(30_000)` ✓, `routes/auth.ts:187,191` `/?error=`/`/?silent=unavailable` + `/auth/error` JSON-400-Fallback (Z.136) ✓, Fallback unbekanntes Segment → Index 1 (`App.tsx:124-126`) ✓, AK1-Tabelle 1105 hat 9 Zeilen ✓.
- `server/src/express/http-error.ts` + `http-error.test.ts` existieren, Zentralisierung via #1131 (Commit 347bb7e7) gemergt → Lösch-Begründung issue-1130.md trägt.
- TITLE GATE ausgeführt: alter Titel „docs(spec): Ist-Stand-Sync 2026-09-01" (deutsch, Grossbuchstabe) → umbenannt zu „docs(spec): sync specs to implemented state 2026-09-01" (`gh pr edit 1154 --title`, verifiziert).

## Relevante Stellen
- `docs/spec/issue-1130.md` — gelöscht; interne Refactoring-Spec ohne Aussenverhalten.
- `docs/spec/issue-1136.md`, `issue-1151.md` — Neufassungen Soll→Ist.
- `server/src/express/http-error.ts` — Existenznachweis der Lösch-Begründung.

## Annahmen
- PR-Beschreibung („alle 42 Dateien der Triage, 32 unverändert") als Arbeitsvertrag; keine AK-Verifikation möglich (ohne Issue).

## Verworfen
- Finding „http-error.ts existiert nicht" — False Negative des Haiku-Subagents (ls/grep direkt widerlegt).

## Offen
- -

## Ergebnis
- **VERDICT: needs-fixup (🟡)** — Review gepostet (pullrequestreview-5073612975): F1 `docs/spec/issue-831.md:3` (keine Leerzeile vor `## Ziel` + Hard-Break-Spaces, prettier rot), F2 `docs/spec/issue-1105.md:32` (Tabellen-Padding nicht re-aligniert + ASCII-`"` statt `“` bei „Standort", prettier rot; Gate = `prettier --check .` in verify.yml:79), F3 `server/src/express/http-error.test.ts:9` (Test-Pflege: Kommentar verweist auf gelöschte docs/spec/issue-1130.md; kein Inline-Anker möglich — Datei nicht im Diff → steht im Review-Body).
- Sammelkommentar `<!-- ai-review -->` neu angelegt (genau 1, verifiziert), Review-Status needs-fixup, Offene Findings F1–F3, Footer „Review-Typ: Kreuzverhör".

## Nächster Schritt
- Fixup-Runde (Workflow): F1/F2 per `prettier --write` auf die beiden Dateien, F3 Kommentar-Verweis auf `#1130` umbiegen; danach Fixup-Nachweis-Review gegen diese Datei (Delta = 1 Commit, aktualisierte Stand-Zeilen bleiben unberührt).

## Fallstricke
- Haiku-Recherche-Ergebnisse vor Berücksichtigung stichprobenartig selbst verifizern (1 False Negative in diesem Lauf).

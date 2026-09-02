# Issue 1178 — Documenter (PR 1178), Stand 2026-09-02

## Erledigt
- PR 1178 (Renovate: brace-expansion@2 2.1.4 → 5.0.9, Author app/my-github-action-bot, 2 Dateien: pnpm-workspace.yaml, pnpm-lock.yaml) analysiert; Diff komplett gelesen.
- Klassifikation `internal` (reiner Override-/Lockfile-Bump, kein User-Impact); title leer („chore(deps): update dependency brace-expansion@2 to v5" ist CC-konform, passend zu type/scope build), issues leer (kein „Closes/Fixes #" im Body).
- `/tmp/doc.json` geschrieben und mit `jq` validiert (JSON_OK).

## Relevante Stellen
- `pnpm-workspace.yaml:26` — Override-Zeile `brace-expansion@2: '2.1.4'` → `'5.0.9'`; Advisory-Kommentar (GHSA-f886-m6hf-6m8v / -v6h2-p8h4-qcjw) unverändert erhalten.
- `pnpm-lock.yaml` — Override-Block, Snapshot-Entfernung 2.1.4, `minimatch@5.1.9` → brace-expansion 5.0.9, `balanced-match@1.0.2` jetzt `optional: true`.

## Annahmen
- internal-Klassifikation trotz „when in doubt NOT internal": hier kein Zweifel — reine Lockfile-/Override-Änderung ohne Laufzeitverhalten im Repo-Code.

## Verworfen
- `improved`/`fixed` (Security-Heilung als Bugfix) — der Fix liegt im Upstream-Paket, das Repo ändert nur die Pinning-Version; etabliertes Muster für Renovate-Bumps ist internal.
- MEMORY.md-Eintrag — Routine-Renovate-Bump, kein neues Fehler-/Erfahrungsmuster.

## Offen
- -

## Nächster Schritt
- -

## Fallstricke
- Release Notes im PR-Body listen brace-expansion v3–v5 inkl. ESM-Switch und Node ≥20-Engine — für die Doc-Note irrelevant, da nur die Override-Version im Workspace angehoben wird.

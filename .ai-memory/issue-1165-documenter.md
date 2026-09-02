# Issue 1165 — PR-Documenter (PR #1165), Stand 2026-09-02

**ERGEBNIS: `/tmp/doc.json` geschrieben und per `jq` verifiziert.** Renovate-Automerge-PR (Bot `app/my-github-action-bot`, Label `dependencies`), merged als `3d51bcf9`. Klassifikation **internal**, `title: ""` (Compliance bestätigt), 2 files, keine Issues (kein "Closes #", Bot-Body ohne verknüpfte Issues).

## Erledigt
- `gh pr view 1165` + `gh pr diff 1165` gelesen: Diff = exakt 2 Zeilen — `pnpm-workspace.yaml` Override-Pin `undici@6: '6.27.0' → '6.28.0'` (inkl. GHSA-Kommentarzeile) und `pnpm-lock.yaml` (`overrides`-Block, gleiche Ersetzung).
- Kontext übernommen: title compliant = true, type/scope = build/k.A. → Titel unverändert, `title_reason` weggelassen.
- JSON per python3 nach `/tmp/doc.json` (Write-Tool kann nicht nach `/tmp`, Memory 2026-08-26), `jq`-Check grün (`classification` internal, 2 files, title length 0).
- Summaries erwähnen die drei 6.28.0-Advisories (GHSA-m8rv-5g2x-5cg5 CRLF-Injection, GHSA-8xcm-r25x-g524 Content-Length-Desync, GHSA-v3r7-h72x-cjcm setCookie-Injection) aus dem Renovate-Release-Notes-Block; `release_note_en` = ein Satz „kein End-User-Bezug" (internal-Regel), `migration_en` leer, `issues` = [].

## Relevante Stellen
- `pnpm-workspace.yaml` (overrides-Block, ~Z.25) — der eigentliche Pin; Kommentarliste der GHSA-IDs blieb auf dem Altstand (nur Version geändert).
- `pnpm-lock.yaml` (~Z.14) — Folge des Overrides; undici wird transitiv via node-gyp gezogen.

## Annahmen
- internal (nicht `fixed`): Security-Bump einer Build-Transitiv-Abhängigkeit ohne Anwendungsverhalten — kein End-User-Impact; Skill-Regel „when in doubt NOT internal" bewusst nicht angewandt, da reiner Lockfile/Override-Diff.
- 7.x-„clean"-Kommentar im Workspace bleibt gültig (6.28.0 schließt nur die drei 6.x-Advisories; die beiden Cache-Interceptor-Advisories betreffen laut Release Notes nur undici v7/v8).

## Verworfen
- Klassifikation `fixed` — Security-Advisories klingen nach Bugfix, aber der Diff berührt keinen Produktionscode; Nutzer verhält sich identisch.
- `title`-Setzung — bestehender Titel `chore(deps): update dependency undici@6 to v6.28.0` ist compliant (per Input bestätigt).
- MEMORY.md-Eintrag — Routine-Renovate-Dokumentation, kein Fehler/kein neues Learning.

## Offen
- -

## Nächster Schritt
- Keiner — Phase abgeschlossen; Ausgabe liegt unter `/tmp/doc.json` für den aufrufenden Run.

## Fallstricke
- Write-Tool ist aufs Repo-Verzeichnis beschränkt → `/tmp/doc.json` nur per Bash (python3/printf) schreiben, danach `jq`-Verifikation.
- Renovate-PRs haben keine "Closes #"-Issues im Body → `issues` leer lassen statt die Update-Tabelle zu misinterpretieren.

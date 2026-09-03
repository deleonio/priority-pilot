# PR 1191 — Documenter (Phase 6), Stand 2026-09-03

## Erledigt
- PR 1191 analysiert (`gh pr view` + `gh pr diff`): Renovate-Bump des pnpm-Security-Overrides `undici@6` 6.28.0 → 8.10.1; Diff = genau 2 Zeilen in `pnpm-workspace.yaml:25` und `pnpm-lock.yaml` (overrides-Block), kein Quellcode.
- `/tmp/doc.json` geschrieben und per `jq -e` validiert (classification=internal, title leer, 2 files, 0 issues).
- Kontext verifiziert: `pnpm-workspace.yaml:14` dokumentiert version-gescopete Security-Overrides; Zeile 25 nennt die 4 GHSA-Advisories (<- node-gyp) — der Bump deckt dieselben Advisories mit der gepatchten 8.x-Linie ab. Consumer laut Dateikopf: sequelize, eslint, sqlite3, openapi-typescript, vite-plugin-pwa.

## Relevante Stellen
- `pnpm-workspace.yaml:25` — eigentliche Änderung (Override-Wert + unveränderter GHSA-Kommentar; Hinweis „7.x ist clean" blieb stehen, ist für 8.10.1 implizit weiter wahr).
- `pnpm-lock.yaml` — Lockfile-Spiegel des Overrides, automatisch von Renovate.

## Annahmen
- classification `internal`: transitive node-gyp-Abhängigkeit = Build-Tooling, kein Runtime-/User-Impact; SKILL-Regel „when in doubt NOT internal" bewusst nicht angewandt, da ein reiner CVE-Override-Bump eindeutig keinen User-Impact hat.
- Kein Release-Note nötig (ein Satz Begründung statt 2-4 Sätzen, wie im SKILL für internal vorgesehen).
- `issues: []` — kein „Closes/Fixes #" im Body, keine verlinkten Issues im Prompt genannt.

## Verworfen
- Titeländerung — `chore(deps): update dependency undici@6 to v8` ist Conventional-Commits-konform und Typ passt (Prompt: title compliant = true).
- classification `fixed` — Advisories betreffen nur buildzeitiges node-gyp, kein Fehlerverhalten im Produkt.
- Release-Note-Text zu Advisory-Details — internal-Regel verlangt nur einen Satz.

## Offen
- -

## Nächster Schritt
- `-` (Phase abgeschlossen; Output liegt unter `/tmp/doc.json`).

## Fallstricke
- Der GHSA-Kommentar an der Override-Zeile sagt „7.x ist clean" — beim nächsten Advisory-Bump nicht fälschlich auf 7.x springen; 8.10.1 ist der gepatchte Zielstand.
- Renovate-Bodies sind auf Plattform-Limits trunciert (PR-Body-Header) — Diff und pnpm-workspace.yaml sind die verlässliche Quelle, nicht der Body.

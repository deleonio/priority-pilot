# Issue 1248 — Documenter (Phase), Stand 2026-09-06

## Erledigt
- PR 1248 analysiert (Titel `docs(guide): sync user guide with current app state (2026-09-06)`, Author my-github-action-bot, Labels ai:reviewed/ai:skip-commit-guard, 5 Dateien). `gh pr view` + `gh pr diff` selbst gelesen.
- `/tmp/doc.json` geschrieben und mit `jq empty` verifiziert (JQ-OK). Classification `internal` (nur docs + e2e-Selektorpflege, kein Produktivcode), `title` leer (Compliance-Flag war exakt `true`), `issues: []` (Body enthält kein Closes/Fixes, closingIssuesReferences leer).
- Diff-Kern: docs/user-guide.md (+43/−6), docs/ux-pattern-master-detail-settings.md (Sub-Marker-Klasse `.settings-switch-row--sub` entfallen → KolDetails-Gruppierung), frontend/e2e/issue-843.spec.ts + settings-switch-layout.spec.ts (Selektoren von `:not(.--sub)` auf `.settings-general > .settings-switch-row` bzw. `kol-details .settings-switch-row` umgestellt), plus `.ai-memory/issue-1248-fixup.md` (nicht in files aufgenommen).

## Relevante Stellen
- `docs/user-guide.md` — Hauptsynthese; PR-Body enthält vollen Guide-Sync-Report (5 Funde: Balance-Priorisierung, Dashboard-Erledigt-Flow, Balance-Karte, Gruppen-Abschnitt, 5 Settings-Tabs).
- `frontend/e2e/settings-switch-layout.spec.ts:68-93` — Sub-Zeilen-Lokation jetzt über `kol-details .settings-switch-row`.
- `frontend/e2e/issue-843.spec.ts:40,80` — Alignment-Selektoren ohne `--sub`-Klasse.

## Annahmen
- `classification: internal` trotz SKILL-„when in doubt NOT internal": Diff ist 100 % docs + Test-Selektorpflege, kein Verhaltens-/Feature-Change — kein Zweifel.
- Keine Linked-Issue-Kontext geliefert („keine (context)") → issues leer; #843/#971/#1227 im Body sind nur Spec-/Verweis-Zitate, kein `Closes`.

## Verworfen
- `title` setzen — Compliance-Flag exakt `true`, bestehender Titel ist Conventional-Compliant.
- `.ai-memory/issue-1248-fixup.md` in `files` — Phase-Notiz, nicht Doku-relevant (SKILL: 3–8 relevanteste Dateien; 4 dokumentiert).
- classification `improved` (Handbuch-Verbesserung als User-Nutzen) — Release-Notes-Relevanz bei reiner Doku-Korrektur Standard „internal".

## Offen
- Wegwerf-Artefakt `.ai-memory/issue-1248-doc.json` (Zwischenspeicher für /tmp/doc.json, weil Write auf /tmp verboten) untracked — NICHT committen.

## Nächster Schritt
- Keine Folgephase — Documenter ist letzte Phase; Output liegt unter /tmp/doc.json.

## Fallstricke
- Write-Tool darf nicht nach /tmp schreiben (Memory 2026-08-26) → JSON erst ins Repo (`.ai-memory/`) schreiben und per `cp` nach /tmp/doc.json bringen, dann `jq empty` gegenprüfen.
- `gh pr diff --stat` existiert nicht → `gh pr diff <n> --name-only` für Dateiliste, voller Diff für Analyse.

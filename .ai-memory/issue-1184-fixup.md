# Issue 1184 — Fixup (Runde 1, PR #1192), Stand 2026-09-03

## Erledigt
- Review-Kontext eingesammelt: ai-review-Kommentar (needs-fixup, 2 fixbare Findings, kein
  Entscheidungs-Bedarf) + 2 Review-Threads (.pi/settings.json:29, setup-pi/action.yml:82).
- **Finding 1 (PR-Body stale):** Body per `gh pr view 1192 --json body --jq '.body'` →
  /tmp/pr1192-body.md, Punkt 3 „Kein LSP-Paket" GESTRICHEN (Realität: Commit 501d6e99 hat
  `npm:@narumitw/pi-lsp@0.49.6` aufgenommen, in `.pi/settings.json:29` sichtbar), Punkt 4
  (Rollout 02–06) auf 3 umnummeriert; zusätzlich die direkt widersprüchliche Zeile
  „`.pi/settings.json` bleibt unangetastet" umformuliert (gleiche Staleness-Ursache 501d6e99).
  `gh pr edit 1192 --body-file` ausgeführt, Landing verifiziert.
- **Finding 2 (Cache-Pfade):** `.github/actions/setup-pi/action.yml` — `path:` von nur
  `@earendil-works` + `/usr/local/bin/pi` auf das ganze `/usr/local/lib/node_modules` erweitert
  mit `!`-Exklusion für `npm` und `corepack` (gehören zum Runner-Node, Restore dürfte die
  Runner-npm-Version nicht überschreiben), Key v1→v2 gebustet, Kommentar begründet warum
  (npm hoisted 15 unscoped Runtime-Deps als Geschwister — Scoped-Only-Cache hätte nie einen
  nutzbaren Treffer ergeben).

## Relevante Stellen
- `.github/actions/setup-pi/action.yml` — Cache-Block (ehem. Z. 77-84), Verify-Step darunter
  warnt weiterhin korrekt bei Cache-Treffer-ohne-lauffähige-CLI.
- `gh pr view 1192` Body — „Bewusst offen"-Liste jetzt 3 Punkte (LSP-Punkt entfallen).

## Annahmen
- Review-Option „path erweitern" der Alternative „Cache entfernen" vorgezogen: Key trägt die
  gepinnte pi-Version, Exklusionen halten Runner-eigenes npm/corepack draußen. Ein echter
  Cache-Hit-Nachweis im zweiten Lauf ist auf diesem PR nicht möglich (setup-pi läuft nur bei
  gesetztem `vars.AGENT_RUNTIME=pi`) — im Fixup-Vermerk im PR/Thread dokumentiert.
- Body-Punkt 2 („Versionslose Paketeinträge") ist ebenfalls leicht stale (Pakete sind inzwischen
  gepinnt), wurde aber NICHT vom Review beanstandet → nicht angefasst (nur gemeldete Findings).

## Verworfen
- Cache ganz entfernen — zweitbeste Option laut Review; Erweitern erhält die beabsichtigte
  Kalte-Runner-Ersparnis und ist durch den Verify-Step abgesichert.
- Ganze node_modules ohne Exklusion cachen — würde Runner-npm/-corepack im Restore
  überschreiben können.

## Offen
- Arbeitsbaum hat uncommittierte Löschungen `.ai-memory/issue-1183-*.md` / `issue-1187-*.md`
  — NICHT von diesem Fixup angerührt und nicht committet (nur action.yml, fixup-Note und die
  vormals untracked `issue-1184-review.md` sind in 28b24ead).
- „04 Implement"-Workflow-Lauf 33716868300 (alter SHA c96a7a89) lief noch — Orchestrierung,
  kein rotes CI; Verify 33717629236 auf 28b24ead grün.

## Nächster Schritt
- Runde abgeschlossen: Commit 28b24ead gepusht, beide Threads (PRRT_…ex2G6 / ex2G8) mit
  Antwort + Resolve geschlossen, PR-Body korrigiert. Warten auf Re-Review.

## Fallstricke
- Thread-Resolve geht NUR via GraphQL-Mutation `resolveReviewThread` (kein gh-Native, kein REST).
- Keine Labels setzen (Workflow macht das).

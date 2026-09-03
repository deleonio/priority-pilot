# Issue 1184 / PR 1192 — Review (Kreuzverhör, Runde 1), Stand 2026-09-03

## Erledigt
- MODE = CROSS-EXAMINATION festgestellt: kein `<!-- ai-review -->`-Kommentar auf PR 1192 (API-Suche leer). Closing-Issue #1184 (refs length 1).
- AK-Quelle: KEIN `<!-- ai-harness -->`-Kommentar und KEIN KI-ANALYSE-Block im Issue-Body (einziger Issue-Kommentar = github-actions-Qualitätscheck) → AKs aus der Issue-eigenen Sektion „Woran messen wir das?" (4 Kriterien) übernommen und im Verdikt vermerkt.
- Kompletten Diff gelesen (2108+/574-, 28 Dateien; `.ai-memory/pr1192.diff` = Wegwerf-Artefakt, nicht committen). PR-Body, Issue-Body ausgewertet.
- Regression geprüft: kein Workflow nutzt mehr `uses: …/setup-claude` (nur noch Kommentare nennen es — kosmetisch); alle `steps.setup.outputs.*`-Referenzen (configured, gh-token, invoke-*, issue-number, llm-provider, memory-status-text, runtime, session-dir) werden von setup-agent bedient (Output-Menge = Superset der alten setup-claude-Outputs). `test-time-window.sh`-Umzug: keine verwaisten Pfad-Referenzen (grep über .github leer).
- `cost-from-pi-session.test.ts` lokal ausgeführt: alle Tests grün (TAP ok; lief versehentlich via `node <file>` direkt — main()-Guard feuert nur bei Direktausführung des Scripts selbst, Test-Aufruf von main() druckt erwartete key=value-Zeilen).
- CI: e2e (1-4), verify, label grün; `review` = dieser Lauf (pending).
- renovate.json5-Regex des CustomManagers manuell nachvollgezogen (Objektform `"source": "npm:pkg@1.2.3"` und scoped `npm:@scope/pkg@x` matchen korrekt; ungepinnte Einträge matchen nicht → nur setup-pi-Warning, konsistent).
- Befunde als Review (event COMMENT) mit 2 Inline-Kommentaren + Sammelkommentar (neu angelegt, Marker `<!-- ai-review -->`) gepostet; Titel-Gate: deutscher Subject → PR umbenannt in `feat(ci): add pi as switchable agent runtime (pilot: triage) (#1184)`.

## Relevante Stellen
- `.github/actions/setup-agent/action.yml` (neu, 554 Zeilen) — Runtime-Weiche; validiert `runtime` als ERSTEN Step (Tippfehler → exit 1, kein stiller Fallback).
- `.github/actions/setup-pi/action.yml` (neu) — pi-CLI (gepinnt 0.84.4, Cache Z. 81-83), Paket-Install aus `.pi/settings.json` (hart failend), Auth, Modell-Alias aus `.github/pi/model-aliases.json` + vars.PI_MODEL_ALIASES-Overlay (jq `.[0] * .[1]`, Overlay gewinnt), invoke-args Z. ~445.
- `.github/scripts/cost-from-pi-session.ts` (+ .test.ts) — liest `<session-dir>` inkl. `subagents/`-Kindsitzungen, zeichengleiche key=value-Ausgabe wie cost-from-transcript.ts; Preistabelle geteilt.
- `.github/workflows/01-triage.yml` — einzige Phase mit `runtime: ${{ vars.AGENT_RUNTIME }}`; invoke-Zeile für beide Laufzeiten identisch (Step-ID `claude` + /tmp/claude-Pfade bewusst historisch).
- `.github/workflows/set-agent-config.yml` (neu, ersetzt gelöschtes set-provider.yml) — setzt AGENT_RUNTIME+LLM_PROVIDER, Kombinations-Check fail-closed VOR dem Setzen (pi+openrouter ohne PI_MODEL_ALIASES; pi+claude mit sk-ant-oat-Token).
- `.pi/settings.json:29` — LSP-Paket `npm:@narumitw/pi-lsp@0.49.6` neu ergänzt; alle Einträge jetzt gepinnt (Renovate-CustomManager pflegt).
- `docs/ci-architecture.md` — neue Sektionen „Laufzeit umschalten", „pi-Pakete im Runner", „Was pi NICHT kann: die Tool-Tiers" (Verweis auf Folge-Issue #1193), „Kostenerfassung unter pi".

## Annahmen
- pi-Session-Format (Feldnamen input/output/cacheRead/cacheWrite, 1 Zeile je Nachricht, compaction-usage) wie im PR-Body „am Bestand verifiziert" — vom Autor mit echter Sitzungsdatei geprüft behauptet, hier nicht reproduzierbar (kein pi in der Sandbox).
- `pi-subagents`-Konfig-Schlüssel (`subagents.defaultModel`, `extensions/subagent/config.json` → `defaultSessionDir`) laut PR-Body lokal verifiziert.
- npm-Registry-Abfrage lieferte die Dep-Liste von pi-coding-agent@0.84.4 (19 Runtime-Deps, 15 davon unscoped) — Evidenz für Finding 2.

## Verworfen
- Weitere Finding-Suche zu set-agent-config.yml (id-token:write unnötig für client-id/private-key-Flow — harmlos, Pattern-Übernahme aus set-provider.yml, kein Befund wert).
- Docs-Drift `00-set-llm-provider.yml`/`cron.ci.multi-provider.yml` werden in docs/ci-architecture.md erwähnt, existieren aber nicht unter .github/workflows/ — vorbestehender Text, nicht Teil dieses Diffs (kein Side-Trip per FOCUS).
- AK1/AK4 als eigenes Finding — inhärent erst durch echten Pilotlauf beweisbar, im PR-Body + docs ehrlich als offen dokumentiert; im Sammelkommentar vermerkt statt Findings.

## Offen
- `.ai-memory/issue-1184-body.md`, `.ai-memory/issue-1184-harness.md` (leer, 0 Byte), `.ai-memory/pr1192.diff` = Wegwarf-Artefakte dieses Laufs, NICHT committen.

## Nächster Schritt
- Fixup-Runde: Finding 1 (PR-Body „Bewusst offen" Nr. 3 ist stale — LSP-Paket IST ergänzt) + Finding 2 (Cache-Pfade decken gehoistete pi-Deps nicht) abarbeiten; danach Fixup-Verifikation (Modus über `<!-- ai-review -->`-Marker).

## Fallstricke
- Finding-Nummern stabil: F1 = PR-Body/LSP-Kontradiktion (Anchor .pi/settings.json:29), F2 = pi-CLI-Cache-Pfade (Anchor .github/actions/setup-pi/action.yml:82).
- Sammelkommentar-Zeile 2 nennt PR #1192 + Issue #1184; Footer „Review-Typ: Kreuzverhör".
- KEINE Labels setzen (Workflow macht das selbst).
- Nächste Runde: Fixup-Verifikation NICHT wieder Voll-Diff — nur Deltas seit updatedAt des Sammelkommentars.

# Review — Commit `0c79b21` „feat: Enhance AI backend support in workflows"

**Scope:** GitHub-Actions-Pipeline-Topologie (5 Claude-Workflows + 2 Composite-Actions), 647 Insertions.
**Klassifizierung:** Review · **Large / Hochrisiko** (Pipeline-/Trigger-Topologie-Änderung) → non-umgehbares Topologie-Gate: **separater Reviewer Pflicht** → als **Kreuzverhör** (Ankläger + Verteidiger, unabhängig, ohne Architect-Ground-Truth) ausgeführt.
**Working-Tree:** clean; HEAD == Review-Ziel (`feat/hermes`). Kein Commit/Push durch das Team.
**Empirische Grundwahrheit (Architect-Sonde + beide Reviewer):** `node --test server/src/workflows/ai-backend.test.ts` → **Parent `0c79b21^`: 77/77 grün. HEAD: 72 pass / 5 fail, exit 1.** Die Testdatei ist parent↔HEAD **byte-identisch** (`diff -q` → identisch; zuletzt in `c7f105d`/`8d51de8` geändert, nicht in diesem Commit). Die 5 Fehler stammen also **ausschließlich** aus den Workflow-Edits dieses Commits — keine verschobene Messlatte.

**Verdikt:** 🔴 **Nicht mergefähig.** Der Commit ist auf CI rot und bricht **auch den Default-(Claude/Anthropic-)Pfad** — den Normalfall — auf mehreren Wegen, während jeder Step grün bleibt (stiller Bruch). Beide unabhängigen Reviewer sind zu diesem Schluss gekommen; die Befunde decken sich.

---

## CRITICAL

### C1 — CI ist rot: `if→case`-Refaktor bricht 5 Vertrags-Tests

**`.github/workflows/claude-triage.yml` (+ spec/implement/pr-review/pr-fixup)** · Test `ai-backend.test.ts:146` („zai-Fruehreturn").
Parent hatte `if [ "${AI_BACKEND:-}" = "zai" ]; then … exit 0`. Der Commit ersetzt das durch `case "${AI_BACKEND:-}" in zai) … hermes) …`. Das gepinnte Vertrags-Literal `/AI_BACKEND:-\}.*=.*"zai"/` matcht nicht mehr → **5 Fehlschläge** (einer je Workflow), `exit 1`.
Der `case`-Umbau selbst ist funktional in Ordnung (zai-Early-Return bleibt, hermes-Early-Return kommt hinzu) — aber der Test läuft in `ci.yml` und ist das Merge-Gate. **Entweder Test mitziehen (Regex an `case` anpassen) oder das Literal erhalten.** _Fehlerbild: `ci.yml` schlägt fehl, PR kann nicht mergen._

### C2 — `steps[AGENT_STEP].outputs.*`: Bash-Variable in `${{ }}` → alle Agent-Outputs leer/Fehler (alle 5 Workflows, beide Pfade)

**`claude-triage.yml:339-348`** (+ `spec:343`, `implement:370`, `pr-review:332`, `pr-fixup:501`):

```
AGENT_STEP="claude"                                             # Bash-Var, erst zur Laufzeit
echo "outcome=${{ steps[AGENT_STEP].outputs.outcome }}" >> "$GITHUB_OUTPUT"
```

`${{ … }}` wird von der Actions-Expression-Engine **beim Dispatch expandiert, bevor Bash läuft** — reine Template-Substitution, keine Shell-Expansion. `AGENT_STEP` existiert dort nicht; im Ausdruck `steps[AGENT_STEP]` ist `AGENT_STEP` ein **unbekannter named-value**. Das `if/else`, das die Bash-Variable setzt, ist **toter Code** und kann keinen Step auswählen.
Konsequenz: `execution_file`, `session_id`, `outcome` sind **immer leer (bzw. der Step failt)** — identisch auf dem `hermes`- **und** dem Default-`claude`-Pfad.
**Regression** gegenüber dem Parent, der direkt `steps.claude.outcome` / `steps.claude.outputs.session_id` las. Blast-Radius auf dem **Default-Pfad** (jeder Konsument der genullten Outputs):

- **Timeout → `ai:to-big-issue`** (`triage:390`, `implement:446`, `spec:414`): Gate `… outcome == 'cancelled'` wird nie wahr → überlaufende Issues bleiben still stehen.
- **Soft-Abort-Cap `ai:continued`** (`implement:399`, `spec:372`, `pr-review:365`, `pr-fixup:531`): Gate `… outcome == 'success'` tot → Continuation-Sicherung deaktiviert.
- **PR-Review Label-Post-Assertion** (Safe-Default `ai:needs-changes`, `pr-review:447`): tot → PRs können ohne Verdikt-Label bleiben.
- **Named-Session-Archiv** (`triage:373` u. a.): leere `session-id` → `--resume`-Kette bricht, jeder Lauf startet kalt.
- **Finaler Run-Summary** (`triage:417` u. a.): leeres `OUTCOME` fällt in den `else`-Zweig → **jeder erfolgreiche Lauf meldet sich selbst als `❌ …-Lauf gescheitert`**.
- **Cost-Summary** (`triage:356` u. a.): leeres `execution-file` (nicht fatal, `continue-on-error`).
  _Fehlerbild: Default-Claude-Lauf gelingt inhaltlich, meldet aber „gescheitert", speichert keine Session, flaggt kein Timeout — alles grün._

### C3 — `${{ secrets.* }}` in einer Composite-Action → Hermes-Pfad DOA

**`.github/actions/hermes-agent-action/action.yml:71, 76, 90`** (`secrets.ZAI_API_KEY`, `secrets.OPENROUTER_API_KEY`, `secrets.CLAUDE_CODE_OAUTH_TOKEN`).
Der `secrets`-Context ist **in Composite-Actions nicht verfügbar** — Secrets müssen als Inputs durchgereicht werden. Da GHA die `${{ }}` des gesamten `run:`-Skripts beim Dispatch auflöst, schlägt die Auswertung **unabhängig vom `case`-Zweig** fehl → der erste Step der Action failt auf **jeder** Hermes-Invocation.
Beleg aus demselben Commit: **`configure-ai-backend/action.yml` macht es korrekt** (Input `hermes-api-key` → `env:` → Bash `$HERMES_API_KEY`, nie `secrets.*`). Das Muster war dem Autor bekannt; die neue Action umgeht es. **Fix: Keys als Inputs deklarieren und via `env:` mappen.**
_(Severity-Dissens im Kreuzverhör: Ankläger stufte dies als „latent/unerreichbar" ein, weil nur die zai/openrouter/anthropic-`case`-Zweige betroffen scheinen; Verteidiger als „hart, jede Hermes-Invocation", weil die `${{ }}`-Auflösung skript-global beim Dispatch passiert. Der Verteidiger ist nach GHA-Semantik im Recht — siehe Open Question O1 zum exakten Fehlermodus.)_

---

## HIGH

### H1 — Default-Pfad-Umverdrahtung: `.outputs.outcome` statt built-in `.outcome`

**`claude-triage.yml:348` (+4 Spiegel).** Der Parent nutzte die **built-in Step-Conclusion** `steps.claude.outcome`; die Unify-Step liest `steps.<id>.outputs.outcome`. `anthropics/claude-code-action@v1.0.165` dokumentiert **keinen** `outputs.outcome` (die Conclusion ist `.outcome`). Selbst wenn C2 behoben würde, bliebe `outcome` für Claude leer. `.outputs.outcome ≠ .outcome`.

### H2 — Docker-Image `ghcr.io/nousresearch/hermes-agent:latest` unpinned (Konventions-Bruch)

**`hermes-agent-action/action.yml:160`.** Jede andere externe Referenz im Repo ist SHA-gepinnt mit Versionskommentar (`actions/checkout@9c091bb… # v7.0.0`, `anthropics/claude-code-action@558b1d6… # v1.0.165`, `create-github-app-token@bcd2ba4… # v3.2.0`). Das mutable `:latest` widerspricht direkt der eigenen Doku-Zeile der Action („Verwendet Docker für **deterministische** Ausführung") und ist ein Supply-Chain-Risiko. _Fehlerbild: Upstream-Push ändert Agent-Verhalten zwischen zwei sonst identischen Läufen._

### H3 — Hermes-`outcome`-Erkennung via `$?` ist unzuverlässig (latent)

**`hermes-agent-action/action.yml:166-175`.** `$?` bei `:175` reflektiert das vorangehende `echo …>>$GITHUB_OUTPUT` (immer 0), nicht `docker`. Der `outcome=failure`-Zweig ist unerreichbar.
Wichtige Korrektur zur ursprünglichen Architect-Hypothese (**Architect-Cross-Check**): GHAs Default-Shell ist `bash --noprofile --norc -eo pipefail {0}` — `pipefail`+`errexit` sind **an**. Ein Docker-Fehler propagiert also über `| tee` und `errexit` bricht den Step bereits bei `:166` ab, **bevor** die `$?`-Logik läuft. Netto: die `$?`-Logik ist kaputt-wie-geschrieben, aber heute durch `errexit` maskiert. _Exponiert sobald jemand `continue-on-error`/`set +e` ergänzt: ein gescheiterter Hermes-Lauf meldet `outcome=success`._

### H4 — Doku-Drift: `ai:use-hermes` nirgends dokumentiert (Single-Source-of-Truth verletzt)

Pre-Flight-Grep: `ai:use-zai` steht in **`AGENTS.md`** (Abschnitt „Optionales Backend", Z. 118-135) und **`.ai-knowledge/bare-mode.md`** (Z. 47, 164-216). `ai:use-hermes` steht **ausschließlich** in den `.github/`-Dateien — keine Prosa-Doku. Nach team7 ist eine stille Doku-/Mirror-Abweichung ein Critical-Kandidat; hier als High geführt, da der Backend-Mechanismus produktrelevant und öffentlich label-gesteuert ist. **AGENTS.md + bare-mode.md um den Hermes-Pfad ergänzen.**

---

## LOW

### L1 — `HERMES_EFFORT` gesetzt, nie konsumiert

**`claude-triage.yml:224/229/235`** schreiben `HERMES_EFFORT` nach `$GITHUB_ENV`, aber `hermes-agent-action` hat **keinen `effort`-Input** und der Docker-Aufruf übergibt nur `--bare --provider --model $COMBINED_ARGS` (kein `--effort`). Der intendierte `max`/`high`-Reasoning-Tier wird berechnet und verworfen. Der Claude-Pfad übergibt `--effort` korrekt.

### L2 — Script-Injection-Muster: `${{ inputs.* }}` direkt in `run:`-Shell

**`hermes-agent-action/action.yml:149`** `COMBINED_ARGS="${{ inputs.hermes_args }} ${{ inputs.resume_arg }}"`, `:155` unquoted `$COMBINED_ARGS`. Kanonisches GHA-Injection-Anti-Pattern (Compile-Time-Interpolation in Shell-Quelltext). Aktuell sind die injizierten Felder numerisch/intern (geringe Live-Ausnutzbarkeit), aber unsafe by construction. **Empfehlung: Inputs via `env:` reichen und `"$VAR"` referenzieren.**

### L3 — `--bare` doppelt auf dem Hermes-Pfad

`hermes_args` beginnt mit `--bare` (Workflow), die Action ergänzt `--bare` erneut (`action.yml:162`). Kosmetisch, aber Indiz für ungetesteten Pfad.

### L4 — `hermes-config`-Step ohne einheitliches `if:`-Gating

In `claude-triage.yml` läuft „Modell-Konfiguration für Hermes vorbereiten" ohne `if:`-Guard (auch bei `configured==false`), in spec/implement mit Preflight-Guard. Schreibt `HERMES_*` auch auf dem Claude-Pfad (unbenutzt, harmlos). Inkonsistenz.

---

## Open Questions / Needs Deeper Look

- **O1 (exakter Fehlermodus C2/C3):** Nicht lokal reproduzierbar ohne Scratch-Actions-Run. Offen bleibt, ob `Unrecognized named-value: 'AGENT_STEP'` / `'secrets'` ein **Parse-Zeit-Fehler** ist (der den **ganzen Workflow-Lauf** sofort scheitern lässt — dann sind alle 5 Workflows komplett tot) oder ein **Dispatch-/Step-Zeit-Fehler** (nur der Step failt, Nachfolge-Steps mit `if: always()` lesen leer) oder **stille Leerauflösung**. Das **Verdikt (kaputt) hängt nicht davon ab** — alle drei Lesarten sind fatal. Empfehlung: einen einzelnen Test-Trigger in einem Sandbox-Repo/Branch feuern und die Runner-Logs lesen.
- **O2 (Existenz der Hermes-Toolchain):** Unverifizierbar aus dem Repo — ob `ghcr.io/nousresearch/hermes-agent:latest` existiert und ob eine `hermes chat`-CLI die Claude-Code-Flags (`--bare --allowedTools --append-system-prompt --resume`) akzeptiert. Ebenso, ob `grep -oP 'session-[a-f0-9-]{36}'` (`action.yml:170`) reale Hermes-Ausgabe matcht. **Vor Einsatz gegen die echte Toolchain verifizieren.**
- **O3 (Modell-IDs):** `glm-4.7` (spec/implement) vs. `glm-5.1`/`glm-5.2` (triage) und `claude-sonnet-4-6`/`claude-opus-4-8` — teils vorbestehende Inkonsistenz, gegen die reale z.ai/Anthropic-Registry gegenprüfen.

---

## Verifiziert korrekt (verteidigt)

- `configure-ai-backend/action.yml`: Secret-Handling via Inputs→`env:`→Bash `$VAR` (Z. 34, 45-49, 69-82) — korrektes Composite-Muster.
- `env.HERMES_API_SERVER_KEY`-Verdrahtung **nicht** zirkulär: `configure-ai-backend` schreibt es vor dem Hermes-Step nach `$GITHUB_ENV`; `hermes_api_key: ${{ env.HERMES_API_SERVER_KEY || '' }}` ist befüllt.
- OAuth-Gating `claude_code_oauth_token: ${{ env.AI_BACKEND != 'zai' && secrets.CLAUDE_CODE_OAUTH_TOKEN || '' }}` — korrekte `!=`/truthy-Form, in einer Workflow-Datei (wo `secrets` gültig ist). Die 6 zugehörigen Tests bleiben grün.

---

## Empfohlene Reihenfolge zum Grün-Werden

1. **C2** fixen — dynamische Step-Wahl im **Expression-Layer** statt Bash: z. B.
   `execution_file: ${{ env.AI_BACKEND == 'hermes' && steps.hermes.outputs.execution_file || steps.claude.outputs.execution_file }}` (analog session_id); für **outcome** die built-in `.outcome` je Zweig verwenden (H1).
2. **C3** fixen — `secrets.*` in `hermes-agent-action` durch Inputs ersetzen (Muster von `configure-ai-backend`).
3. **C1** fixen — `ai-backend.test.ts:146`-Regex an die `case`-Form anpassen (oder Literal erhalten) und lokal grün ziehen.
4. **H2/H4** — Image SHA-pinnen; `ai:use-hermes` in AGENTS.md + bare-mode.md dokumentieren.
5. **O2** — Hermes-Toolchain real gegen einen Sandbox-Trigger verifizieren, bevor das Label produktiv gesetzt wird.

---

## Pädagoge-Zusammenfassung

_(vollständiger Report: `~/.claude/session-reports/2026-07-10.md`)_

- **Prozess:** Topologie-Gate korrekt gezogen → Kreuzverhör (2 unabhängige Reviewer, Opus) statt Solo-Selbstbehauptung. **Feedback-Loop nachgewiesen:** Der Ankläger korrigierte eine falsche Architect-Hypothese (`tee` maskiere Docker — tatsächlich `-eo pipefail` default), der Verteidiger lieferte die **Negativ-Kontrolle** (Parent 77/77, Testdatei byte-identisch) und den Severity-Dissens zu C3. Empirie-statt-Autorität eingehalten (Test real ausgeführt, nicht behauptet).
- **Pre-Flight-Grep-Artefakt:** vorhanden und ertragreich (fand H4-Doku-Drift + den Vertragstest, der C1 lieferte).
- **Dirty-State-Gate:** eingehalten (clean, kein Commit durch das Team).
- **Abweichungen:**

| Gate                              | Status        | Anmerkung                                                |
| --------------------------------- | ------------- | -------------------------------------------------------- |
| Architect-Hypothese `$?`/pipefail | ⚠️ korrigiert | Cross-Check fing den Fehlschluss vor der Eskalation (H3) |
| Exakter GHA-Fehlermodus C2/C3     | ⚠️ offen      | nur per Scratch-Actions-Run final klärbar (O1)           |

- **Aufwand gerechtfertigt:** Ja — Large/Hochrisiko-Topologie mit stillen Brüchen auf dem Default-Pfad; der Kreuzverhör-Overhead fand einen kompletten Default-Pfad-Bruch, der hinter grünen Steps verborgen war.

---

## Addendum — Feature „OpenRouter via Hermes" + Foundation-Fixes (Folgeauftrag)

Auf Wunsch („über hermes auch openrouter anbinden") wurde OpenRouter als drittes Opt-in-Backend
(`ai:use-openrouter`, Routing über `hermes-agent-action --provider openrouter`) verdrahtet — und da es
auf dem kaputten Hermes-Pfad aufsetzt, die Foundation-Findings **mitgefixt**. Empirisches Gate:
`ai-backend.test.ts` **77→103 Tests, 0 fail** (inkl. neuer C2-/C3-Regression-Guards + Negativ-Kontrolle);
zusätzlich `model-delegation` (42) + `pipeline-hardening` (39) grün. YAML aller 7 Dateien valide;
`bash -n` der Action sauber.

**Behoben:** C1 (Test an `case`-Form angepasst) · C2 (`steps[AGENT_STEP]` → Expression-Layer-Auswahl,
`.outcome` built-in) · C3 (`secrets.*` → Inputs in der Composite-Action) · H1 · H3 (`$?` → `PIPESTATUS`) ·
L2 (Injection → env) · H4 (Doku: AGENTS.md + bare-mode.md) · sowie zwei im finalen Adversarial-Review
gefundene Runtime-Bugs: **arg-shredding** (unquoted `$COMBINED_ARGS` → `xargs`-Array, ehrt Quotes,
lässt Backticks literal) und **Hard-Fail** (`exit $DOCKER_RC` entfernt → outcome-getrieben wie der
Claude-Pfad). LOW: OpenRouter-Label im Summary korrigiert.

**Gap-Offenlegung (Ehrlichkeit):** Das Erst-Review lief NUR `ai-backend.test.ts` und unterzählte damit —
der Commit brach auch `model-delegation.test.ts` (4) und `pipeline-hardening.test.ts` (1). Beide sind
jetzt grün (Negativ-Kontrolle: gegen die committeten Testversionen rot). Prozess-Notiz: ein
Workflow-Subagent editierte diese zwei Testdateien außerhalb seines Ein-Datei-Scopes — die Edits waren
legitim/nötig und wurden behalten, der Scope-Übergriff ist hier vermerkt.

**Weiterhin offen (nicht lokal verifizierbar — ehrlich als offen deklariert):**

- **Secret:** `OPENROUTER_API_KEY` muss als Repo-Secret hinterlegt werden (fehlt es bei gesetztem Label,
  bricht der Preflight deterministisch mit `::error` ab).
- **O2 (unverändert kritisch):** Existenz von `ghcr.io/nousresearch/hermes-agent:latest` und ob
  `hermes chat --provider openrouter --bare --allowedTools …` real existiert/diese Flags akzeptiert —
  der GANZE Hermes-/OpenRouter-Pfad hängt daran. Vor Produktiv-Einsatz gegen einen Sandbox-Trigger prüfen.
- **Modell-ID:** Default `anthropic/claude-sonnet-4.5` gegen den realen OpenRouter-Katalog verifizieren
  (TODO-Kommentare gesetzt).
- **H2:** Image bleibt `:latest` (kann ohne verifizierten Digest nicht gepinnt werden — TODO-Kommentar).
- Kein Commit durch das Team — Working-Tree bleibt zum Review beim User.

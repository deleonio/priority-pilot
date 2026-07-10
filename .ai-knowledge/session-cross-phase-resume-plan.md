# Plan: Selektives Cross-Phase Session-Resume (Issue-Namespace)

> Status: **UMGESETZT** (2026-07-09). Alle Änderungen implementiert und getestet.
>
> **Nachtrag 2026-07-10:** Das Speicher-Backend ist von Actions-Cache auf
> **Workflow-Artefakte** umgestellt (GitHubs Changelog 2026-06-26 „Read-only
> Actions cache for untrusted triggers" machte Cache-Saves aus den
> Issue-Workflows unmöglich: „cache write denied: token has no writable
> scopes"). Namensschema jetzt `claude-session-<issue|pr>-<N>-<phase>` (ein
> Artefakt pro Phase, „latest wins" statt immutabler Ein-Slot-Key). Die
> Cross-Phase-Fallback-Logik dieses Plans gilt unverändert; maßgeblich ist
> die Beschreibung in AGENTS.md („Named Session Resume").

## Context

Wunsch: Claude-Sessions über die Workflow-Pipeline hinweg cachen, per Issue-ID
labeln, und ein Folge-Workflow soll die Session der Vorphase per `--resume`
fortsetzen. Offene Frage war: ein gemeinsamer Cache oder per-Ticket-Cache?

**Recherche-Ergebnis: Das Session-Caching existiert bereits vollständig** und
ist **per-Ticket** aufgebaut (`.github/actions/session-restore`, `session-save`,
`session-lib.sh`), verdrahtet in alle vier LLM-Workflows:

- Cache-Keys sind bereits per-Ticket: `claude-session-issue-<N>` (Phasen
  `analyse`/`spec`/`impl`) und `claude-session-pr-<N>` (Phasen `review`/`fix`).
  Der Issue/PR-Split ist bewusst (Kreuzverhör-Finding M3).
- In jedem Cache-Eintrag liegt eine `sessions.json` mit einer `session_id`
  **pro Phase**; Restore spliced `--resume <id>` in `claude_args`.

**Die A/B-Frage ist damit beantwortet: per-Ticket (bereits umgesetzt) ist
richtig, nicht ein gemeinsamer Cache.** Ein einziger geteilter Key wäre
problematisch, weil `actions/cache`-Keys immutable sind (jeder Save müsste das
Archiv _aller_ Tickets löschen+neuschreiben → unbegrenztes Wachstum,
10-GB-Repo-Limit ist bereits ein Thema → `cache-cleanup.yml`), und weil die
Pipeline hochgradig nebenläufig läuft → ein geteilter Slot bedeutet garantiertes
gegenseitiges Clobbern. Per-Ticket gibt natürliche Lifecycle-Isolation.

**Die echte Lücke** zum beschriebenen Wunsch: Aktuell resumed jede Phase **nur
ihre eigene** frühere Session (Retries derselben Phase). Ein Folge-Workflow
(z. B. Spec nach Triage) startet eine **frische** Session — er setzt _nicht_ die
Vorphase fort. Dieser Plan schließt diese Lücke **selektiv und sicher**.

## Gewählter Ansatz (Entscheidungspunkte)

Selektives Cross-Phase-Resume **nur im Issue-Namespace**:

- `spec` resumed die `analyse`-Session, wenn `spec` noch keine eigene hat.
- `impl` resumed die `spec`-Session, wenn `impl` noch keine eigene hat.
- `review` bleibt **bewusst frisch** — resumed niemals `impl`
  (Kreuzverhör-Unabhängigkeit: das Review leitet sein Urteil eigenständig aus dem
  PR-Diff ab, nicht aus der Rationalisierung des Implementierers).
- Issue- und PR-Namespaces bleiben **getrennt** (keine Issue↔PR-Brücke).
- Per-Ticket-Cache-Keys bleiben **unverändert**.

> Diese Punkte waren die offenen Design-Fragen. Falls stattdessen "voll
> cross-phase" (auch Review resumed Impl) oder eine Issue→PR-Brücke gewünscht
> ist, ändert sich der Plan substanziell (siehe "Warum nicht ..." unten).

## Zentrale Erkenntnis: kein `session-save`-Change nötig

Die bestehende Archiv-Struktur löst die Resume-ID-Kollision bereits, weil
`session-save` **strikt unter der eigenen Phase** schreibt:

- Kopierziel: `"$archive_dir/$PHASE/$SESSION_ID.jsonl"` (eigenes Phasen-Verzeichnis)
- sessions.json: `jq '.[$phase] = {session_id, updated_at}'` (nur eigener Key)

Wenn `spec` die `analyse`-ID `X` fallback-resumed:

- **Fall A** (`--resume` behält dieselbe ID): Save schreibt
  `archive/spec/X.jsonl` (kombiniertes analyse+spec-Transkript) — `archive/analyse/X.jsonl`
  bleibt unberührt. `sessions.json` hat dann `.analyse` **und** `.spec` = `X`,
  harmlos, da jeder Restore genau einen Phasen-Key + sein eigenes Phasen-Verzeichnis liest.
- **Fall B** (`--resume` forkt neue ID `Y`): Save schreibt `archive/spec/Y.jsonl`,
  `analyse` komplett unberührt — noch sauberer.

In **beiden** Fällen wird das Vorgänger-Transkript nie überschrieben. Diese
Isolation ist tragend und implizit — deshalb sichert sie ein Test ab (s. u.),
damit ein späterer Edit an `session-save` sie nicht versehentlich bricht.

## Umzusetzende Änderungen

### 1. `.github/actions/session-restore/action.yml` (einzige funktionale Änderung)

**Neuer optionaler Input** `fallback-phase` (nach dem `id-type`-Input, ~Zeile 21):

```yaml
fallback-phase:
  description: >-
    Optional: Vorgaenger-Phase, deren Session als FALLBACK wiederhergestellt wird, wenn die
    eigene Phase (`phase`) noch keine eigene gespeicherte Session hat (erster Lauf). Nur im
    issue-Namensraum (spec->analyse, impl->spec). Leer (Default) = kein Fallback (Verhalten wie
    bisher). Review bleibt bewusst OHNE Fallback (Kreuzverhoer-Unabhaengigkeit).
  required: false
  default: ''
```

**Neuer Output** `restored-from` (nach `restored`, ~Zeile 32) für Logs/Tests:

```yaml
restored-from:
  description: 'Phasenname, aus dem tatsaechlich wiederhergestellt wurde (eigene ODER fallback-phase); leer bei Miss'
  value: ${{ steps.restore.outputs.restored-from }}
```

**Neues Env** im Restore-Step (nach `ID_TYPE:`, ~Zeile 52):
`FALLBACK_PHASE: ${{ inputs.fallback-phase }}`

**Restore-Body umbauen** (aktuell Zeilen 54–93) auf eine Zwei-Versuch-Logik mit
einer `try_phase()`-Hilfsfunktion, die **niemals exit**, nur `return 1`:

1. `miss()` bleibt, ergänzt um `echo "restored-from="`.
2. `try_phase "<phase>"`: liest `.[phase].session_id` aus `sessions.json`,
   validiert UUID, prüft `<archive>/<phase>/<id>.jsonl` non-empty; bei Erfolg
   setzt es `RESOLVED_PHASE/RESOLVED_ID/RESOLVED_FILE` und `return 0`, sonst `return 1`.
3. Auswahl: **immer zuerst** die eigene Phase
   (`try_phase "$PHASE"`); nur wenn die leer ist **und** `FALLBACK_PHASE`
   gesetzt, `try_phase "$FALLBACK_PHASE"`; sonst `miss`.
4. Kopieren/Outputs nutzen `RESOLVED_*` statt der bisherigen Einzel-Variablen;
   `resume-arg=--resume $RESOLVED_ID`, plus `restored-from=$RESOLVED_PHASE`.

Voll fail-open: jeder Fehlerpfad mündet in `miss` (exit 0); `try_phase` bricht nie
ab, ein Fallback-Miss führt nur zu frischem Start. UUID- und Non-Empty-Guard
gelten für eigene **und** Fallback-ID. Der Restore-Step behält in den Workflows
`continue-on-error: true`.

### 2. `.github/workflows/claude-spec.yml`

Im Step `Session-Archiv wiederherstellen (Phase spec)` unter `with:` **eine Zeile**
ergänzen: `fallback-phase: analyse`.

### 3. `.github/workflows/claude-implement.yml`

Im Step `Session-Archiv wiederherstellen (Phase impl)` unter `with:` **eine Zeile**
ergänzen: `fallback-phase: spec`.

> Single-Hop bewusst (kein `impl → spec → analyse`): im Same-ID-Fall trägt das
> gespeicherte `spec`-Transkript den `analyse`-Kontext bereits in sich.

### Unverändert

`session-lib.sh`, `session-save/action.yml`, `claude-triage.yml`,
`claude-pr-review.yml`, `claude-pr-fixup.yml` — keine Änderung.

### 4. Neuer Test `.github/workflows/session-fallback.test.ts`

Statische Contract-Tests (Konvention des Repos; CI globt
`.github/workflows/*.test.ts` via `pnpm dlx tsx --test`, ci.yml ~Z. 103 — neue
Datei wird automatisch erfasst). Assertions:

1. `session-restore/action.yml` deklariert `fallback-phase:` mit `default: ''`.
2. Zwei-Versuch-Logik vorhanden + fail-open: enthält `try_phase`, versucht
   `"$PHASE"` vor `"$FALLBACK_PHASE"`, jeder Zweig mündet in `miss` (leeres
   `resume-arg=` + `exit 0`).
3. Mapping korrekt: `claude-spec.yml`-Restore-Block matcht `phase: spec` **und**
   `fallback-phase: analyse`; `claude-implement.yml` matcht `phase: impl` **und**
   `fallback-phase: spec`.
4. Negativ-Kontrollen (Kreuzverhör-Unabhängigkeit + kein Bridge):
   `claude-triage.yml`, `claude-pr-review.yml`, `claude-pr-fixup.yml`
   Restore-Blöcke enthalten **kein** `fallback-phase:`.
5. Save-Isolation-Invariante: `session-save/action.yml` schreibt weiterhin nur den
   eigenen Phasen-Key (`'.[$phase] = {session_id: $sid, updated_at: $ts}'`) und
   referenziert **keine** `fallback`-Variable — sperrt die tragende
   "Save überschreibt Vorgänger nie"-Eigenschaft gegen Regressionen.

Scoping wie in `pipeline-hardening.test.ts`: den `with:`-Subblock eines Steps
slicen (von `name: Session-Archiv wiederherstellen (Phase spec)` bis zum nächsten
`- name:`), nicht den ersten globalen Treffer matchen.

## Risiken / Trade-offs

- **Wiederkehrende Kosten**: `spec`/`impl` erben ab jetzt per Default den
  Vorgänger-Kontext (nicht mehr nur bei Retries). Da `analyse` auf Opus
  `--effort max` läuft und der Prompt-Cache modell-spezifisch ist, wird das
  geerbte Transkript beim ersten `spec`-Turn (Sonnet) voll zu Input-Token-Preis
  neu gelesen. Bewusst akzeptiert (entspricht dem Wunsch); der materiellste
  Trade-off. Der Spec-Prompt re-verankert ohnehin auf den Issue-Body-Block als
  Quelle der Wahrheit.
- **Modellwechsel in resumter Session** (Opus→Sonnet): funktional sicher —
  Transkript ist modell-agnostische Nachrichtenliste, `--model` überschreibt.
- **Shared-ID in Fall A** (`.analyse` und `.spec` = `X`): bewiesen harmlos —
  dokumentiert, damit es nicht "wegoptimiert" wird.

## Warum nicht voll cross-phase / warum keine Issue↔PR-Brücke

- **Kein voll cross-phase**: `review` muss frisch bleiben, damit das Kreuzverhör
  sein Urteil unabhängig aus dem PR-Diff ableitet statt die Session des
  Implementierers fortzusetzen. Die Kette stoppt bewusst vor Review.
- **Keine Issue↔PR-Brücke**: Cache-Keys/Archive sind per `id-type` getrennt
  (`claude-session-issue-<N>` vs `-pr-<N>`, Finding M3). Issue-Nr. `N` und PR-Nr.
  `N` sind unabhängige IDs; ein Bridge könnte eine fremde Konversation resumen
  und untergräbt dieselbe Frische-Logik wie bei Review.

## Verifikation (End-to-End)

1. **Tests lokal**: `pnpm dlx tsx@4.22.4 --test .github/workflows/session-fallback.test.ts`
   (bzw. der ganze `*.test.ts`-Glob) — alle grün.
2. **YAML-Sanity**: Restore-Action mit gesetztem/leerem `fallback-phase` durch
   einen `act`- oder Scratch-Issue-Lauf; im Actions-Log erscheint bei Erst-`spec`
   die Notice `Fallback auf Vorgaenger-Phase 'analyse'` und
   `restored-from=analyse`; bei Retry `restored-from=spec`.
3. **Empirisch (informativ, kein Gate)**: an einem Scratch-Issue prüfen, ob
   `claude-code-action --resume` dieselbe ID zurückgibt (Fall A) oder forkt
   (Fall B). Das Design ist unter beiden sicher.
4. **Isolation**: nach einem Fallback-Lauf verifizieren, dass
   `archive/analyse/<id>.jsonl` byte-identisch geblieben ist.

## Optionaler Follow-up (nicht Teil des Minimal-Sets)

Restore-Body in eine `restore_session()`-Funktion in `session-lib.sh` extrahieren
(Parität mit den bestehenden Helfern), dann echte Behavioral-Tests (bats/node) mit
Fixture-Archiv: (a) eigene Phase present → resumt eigene; (b) eigene absent +
Fallback present → `restored-from=analyse`, `analyse/<id>.jsonl` unverändert;
(c) beide absent → leere Outputs.

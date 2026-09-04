# Kosten-Optimierung der KI-Pipeline — Session-Report 2026-08-26

> `pi --session 01a03b68-9415-7ed5-b330-f3820c6736b2`

Session-Fenster: 2026-08-26, ca. 01:00–04:30 Uhr. Referenzlauf: Ticket #1034 → PR #1035
(PWA-Update-/Offline-Hinweis: mobile Bedienbarkeit + beschreibende Texte), gemergt und dokumentiert.

## Wo wir angefangen haben

Auslöser war die Kosten-Baseline (72 versiegelte Tickets, 2026-08-19 bis 08-25):

| Kennzahl     | Wert                                                 |
| ------------ | ---------------------------------------------------- |
| Summe        | $141.56 über 363 Läufe, 2.218 Turns                  |
| Ø pro Run    | $0.39 / 1,577 Mio Tokens (1,566 Mio in, 11 Tsd. out) |
| Ø pro Ticket | ~$2–12, teuerste: #1020 mit $22.43                   |
| Dominanz     | review + fixup = 58 % der Gesamtkosten               |

Vergleich mit lokalem Prompting (215 k Tokens für 2 Sessions) ergab das 7,3-fache an Input
pro CI-Run. Die zentralen Fragen: Wo geht das Geld hin, und welche Hebel senken es nachhaltig?

Erste Diagnose der Session (teilweise später korrigiert, s. „Fehlerlehre"):

1. `--autocompact` wurde in CI **nie** übergeben — Compaction war trotz `settings.json` tot.
2. Der Triage-Prompt lag als 29-KB-Heredoc inline im Workflow.
3. Memory-Kontext bis 48 KB je Phase im Prompt.

## Was wir optimiert haben

Chronologisch, mit Commit-Hash. Alle Änderungen sind auf `main` gemergt.

### 1. Auto-Compact-Fix (`5b70ceb0`)

`setup-claude` übergibt jetzt standardmäßig `--autocompact auto`; ein expliziter
`compact-tokens`-Input überschreibt. Zuvor: kein Flag, kein Compacting — die
settings.json-Defaults (`autoCompactThreshold: 0.65`) wurden in CI nie wirksam.

### 2. Prompt-Umzug: CI.md → `.github/prompts/` (`22e96ac6`, `fe8cf49a`)

Alle sechs Phasen-Prompts (triage, ux, spec, implement, fixup, review, documenter) liegen
kanonisch in `.github/prompts/*.md`. Begründung: SKILL.md ist GitHub-unabhängige Methode —
lädt man den Skill, zog Claude Code sonst die CI.md als Skill-Inhalt statt SKILL.md.
Struktur jetzt:

| Ablage                      | Inhalt                                           |
| --------------------------- | ------------------------------------------------ |
| `.claude/skills/*/SKILL.md` | Methode (Haltung, Schritte), keine CI-Referenzen |
| `.github/prompts/*.md`      | operative CI-Prompts, verweisen auf SKILL.md     |

Folge-Fixes im selben Zug: `cron.audit.prompt.yml` prüft die neuen Pfade, `FIXUP.md`
mit umgezogen, Doku (ci-architecture.md, ADR-0005, tdd-strategy.md) und Workflow-Kommentare
angepasst.

### 3. Output-Disziplin über alle Phasen (`0a6334e0`, `daaafed1`)

Ausgangsbeobachtung #1032: Bot-Kommentar wiederholte den Body-Block, zwei Title-Edits
in 5 Sekunden (ASCII-Nachbesserung eines Umlauts). Prompt-Regeln jetzt je Phase:

- **Kein Ping-Kommentar** — Body-Block/PR + Labels sind die Kommunikation.
- **Uneindeutigkeit vor der Arbeit klären**: Triage prüft als ersten Schritt, ob die
  Aufgabe eindeutig ist; wenn nicht → `needs-human` + genau EIN
  `ai-triage-decision`-Kommentar mit allen gesammelten Fragen. Kein Doppel-Mechanismus,
  keine verstreuten Rückfragen.
- Title: nur bei inhaltlichem Fehler, ein Edit.
- Review: 🟢-Bestätigung auf 1–2 Sätze begrenzt.
- Gegenreview-Erkenntnisse eingearbeitet: Ampel-🔴-Regel aus Schritt 2 der Implement
  bleibt unberührt (mein erster Entwurf widersprach ihr und behauptete einen nicht
  existierenden Workflow-Stopp); Fixup dokumentiert Unrelated-CI in seinem EIGENEN
  Sammelkommentar, nicht im `ai-review`-Kommentar des Reviews.

### 4. Effort-Level je Phase (`8bcc1ad2`)

`setup-claude` erhält einen `effort`-Input (`--effort`, validiert, fail-closed), weil
Extended Thinking als Output-Preis zählt und `alwaysThinkingEnabled: true` global galt —
der mechanische Documenter denkte auf Triage-Niveau.

| Phase      | Modell | Effort |
| ---------- | ------ | ------ |
| analyse    | opus   | high   |
| ux         | haiku  | low    |
| spec       | sonnet | medium |
| implement  | opus   | high   |
| fixup      | sonnet | medium |
| review     | opus   | high   |
| documenter | haiku  | low    |

### 5. Memory-Deckel (`e4658f33`)

`render-memory-context.sh`: Gesamt-Deckel 48 k → 20 k Zeichen, Einzel-Deckel 12 k → 8 k.
Kontext-Hygiene; der Kostenhebel ist klein (Cache-Reads sind rabattiert).

### 6. Messinfrastruktur: Block-Aufschlüsselung (`babcc5a0`, `0a1181f3`, `cc1961a8`)

- `cost-from-transcript.ts` gibt zusätzlich `inputTokens`, `cacheCreationTokens`,
  `cacheReadTokens` und USD je Block aus.
- `record-cost` zeigt in der Job-Summary die Token-Herkunft und Kosten pro Block.
- `tokens-report.ts` (Kosten-Übersicht): Phasen-Tabelle mit Input/Cache-Write/Cache-Read
  getrennt, Block-Verteilungstabelle, Mermaid-Trend-Diagramm (Ø je Run pro Tag) plus
  Phasen-Mittel je Tag.
- Bugfix `3dde3ecb`: `$$` in der Summary-Zeile expandierte zur Shell-PID.

### 7. Nebenbei gefixt

- `ac6dda8b`: Typografische Anführungszeichen im Review-Skill-Frontmatter wiederhergestellt
  (ASCII-`"` brach den YAML-String → Extension-Load-Fehler).
- `9aaf2372`: AGENTS.md-Kernregel „ASCII in maschinen-gelesenen Feldern" + zwei
  MEMORY.md-Learnings (YAML-Quotes, Sonderzeichen-Regel).

## Fehlerlehre: was wir in dieser Session falsch lagen

1. **„Output dominiert mit 79 %"** — gerechnet mit $75/M (Preis eines fremden Modells).
   Die repo-eigene Preisliste (opus-5: $5/$25, sonnet-5: $3/$15) sagt: Cache-Read dominiert
   mit ~50 %, Output liegt bei 25–30 %. Korrektur geschah nach Sichtbarwerden der
   Block-Aufschlüsselung (#1034).
2. **„Effort-Level drosselt den Output"** — Output blieb über alle Phasen und Stufen
   konstant bei 17–21 k. Vermutlich ist der Output Tool-Nutzung + Artefakte, kein Thinking;
   das Flag greift nicht, wo wir es erwarteten. Aufwand war klein, Schaden null — aber die
   Erwartung war falsch.
3. **Prompt-Kürzung spart kaum** — der gekürzte Triage-Prompt senkte Cache-Reads, die
   90 % Rabatt haben. Der scheinbare Effekt von #1031 → #1033 ($1.27 → $1.03) war v. a.
   Verhaltensdisziplin (kein Kommentar, kein Title-Edits), nicht Prompt-Größe.
4. **Prompt-Umzug erzeugte 5 Folgefehler** (tote Audit-Pfade, vergessenes FIXUP.md,
   Doku-Leichen) — gefunden erst im eigenen Kreuzverhör. Lehre: Umbenennen/Ouziehen von
   referenzierten Dateien immer mit repo-weiter Referenzsuche abschließen.

## Der Referenzlauf im Detail

Ticket #1034 („UX/UI – Update Message mobile Styling"), Triage-Start 02:14, Documenter-Ende
02:54 — **40 Minuten Pipeline-Gesamtlaufzeit**, eine Fixup-Runde.

| Phase                | Run                                                                                | Dauer     | Modell    | Cache-Read | Output      | Kosten    | Kostenanteil |
| -------------------- | ---------------------------------------------------------------------------------- | --------- | --------- | ---------- | ----------- | --------- | ------------ |
| analyse              | [32921962980](https://github.com/deleonio/priority-pilot/actions/runs/32921962980) | 5:10      | opus-5    | 1,58 M     | 19,3 k      | $1.62     | 23 %         |
| ux                   | [32922280936](https://github.com/deleonio/priority-pilot/actions/runs/32922280936) | 4:23      | haiku-4.5 | 0,64 M     | 17,2 k      | $0.21     | 3 %          |
| spec                 | [32922549212](https://github.com/deleonio/priority-pilot/actions/runs/32922549212) | 6:12      | sonnet-5  | 2,02 M     | 19,4 k      | $1.20     | 17 %         |
| implement            | [32922919038](https://github.com/deleonio/priority-pilot/actions/runs/32922919038) | 9:32      | sonnet-5  | 3,46 M     | 18,0 k      | $1.62     | 23 %         |
| review (Kreuzverhör) | [32923519820](https://github.com/deleonio/priority-pilot/actions/runs/32923519820) | 4:53      | sonnet-5  | 2,06 M     | 20,8 k      | $1.22     | 17 %         |
| fixup                | [32923814562](https://github.com/deleonio/priority-pilot/actions/runs/32923814562) | 6:37      | sonnet-5  | 1,36 M     | 6,9 k       | $0.69     | 10 %         |
| review (Nachweis)    | [32924204337](https://github.com/deleonio/priority-pilot/actions/runs/32924204337) | 2:05      | sonnet-5  | 0,64 M     | 6,2 k       | $0.46     | 6 %          |
| documenter           | [32924336203](https://github.com/deleonio/priority-pilot/actions/runs/32924336203) | 1:45      | haiku-4.5 | 0,33 M     | 4,9 k       | $0.10     | 1 %          |
| **Summe**            |                                                                                    | **40:37** |           | **12,1 M** | **112,7 k** | **$7.12** | 100 %        |

Block-Verteilung über alle Phasen: Cache-Read ≈ 50–64 % je Phase, Cache-Write ≈ 20 %,
Output ≈ 15–30 %, echter Input < 0,1 % (88 Tokens im Maximalfall — der Agent arbeitet
praktisch vollständig aus dem Cache).

### Qualitative Ergebnisse

- **Eine Fixup-Runde** statt historisch 2–10: Der Erst-Review fand genau ein echtes Finding
  (Mobile-First-Verstoß, `max-width` statt `min-width`-Kaskade in `app.css:1577`),
  der Fixup behob es in einem Commit, der Nachweis prüfte nur das Delta.
- **Fixup-Nachweis zahlt sich nachweislich aus**: Re-Review −62 % Kosten, −69 % Cache-Read
  gegenüber dem Erst-Review — genau das Diff-Scoping des Skills.
- **Keine Bot-Kommentar-Pings**, keine Title-Bastelei, `ai-review`-Sammelkommentar sauber
  konsolidiert (Finding → Behobene-Tabelle → reviewed).
- **Ticket-Gesamtkosten $7.12 vs. Baseline-Ø ~$12+** — rund 40 % darunter. Vorsicht bei
  n=1 und einem kleinen UI-Ticket; der Trend muss sich bestätigen.

## Effektive TODOS für die nächste Session

Priorisiert nach Kostenhebel-Größe (Datenlage: Referenzlauf + Baseline).

1. **Turns/Kontextgröße senken — der Haupthebel.** Cache-Read dominiert jede Phase
   (12,1 M im Referenzlauf, 502 M in der Baseline). Hebel konkret:
   - Triage: Recherche-Fanout per Subagent (haiku) konsequent einfordern statt
     Selbst-Lesen im opus-Elternkontext (Regel existiert im Prompt, wird offenbar
     wenig genutzt — prüfen anhand der Turns: analyse brauchte 7+ Turns).
   - Implement (3,46 M Cache-Read, größter Einzeltreiber): prüfen, ob GATE-Ausgaben
     (pnpm test etc.) und Datei-Re-Reads den Kontext treiben; ggf. Output-Kappung
     der Kommandos im Prompt verlangen.
2. **Review-/Fixup-Schleifen weiter reduzieren** (58 % der Baseline-Kosten). Der
   Nachweis-Modus wirkt; der nächste Hebel ist bessere ERST-Umsetzung: Triage-Routing
   (haiku/sonnet/opus) auf Qualität prüfen — falsch geroutete Tickets erzeugen die
   teuren Schleifen.
3. **Effort-Flag-Wirkung verifizieren oder entfernen.** Output blieb konstant —
   entweder greift `--effort` bei diesen Modellen nicht (dann Aufräumen) oder der Output
   ist Tool/Artefakt-lastig (dann zählt das Flag für Thinking und wirkt nur marginal).
   Test: ein identisches Ticket mit/ohne Flag, Output vergleichen.
4. **Trend-Diagramm mit 3–5 weiteren Tickets befüllen** und `kosten-uebersicht`
   triggern. Entscheidungskriterium: Ø/Ticket dauerhaft <$9? Dann Ziel erreicht und
   Hebel 1 nur noch bei Ausreißern anwenden.
5. **Cache-Read-Ausreißer beobachten**: Phasen mit >3 M Cache-Read (implement) auf
   Turns verdächtigen; falls Turns >15, Prompt-Deckel „max. N Schritte, dann Fixup
   wiederholen" erwägen (Soft-Deadline greift nur zeitlich).
6. **Kleinigkeit**: `cost=0`-Fremdtarif-Zeile in der Summary kann entfallen, wenn
   Provider=claude — reine Kosmetik der Job-Summary.

## Verwandte Dateien

- `.github/actions/setup-claude/action.yml` — effort/compact-Inputs
- `.github/prompts/*.md` — alle Phasen-Prompts
- `.github/scripts/cost-from-transcript.ts`, `tokens-report.ts`, `cost-aggregate.ts` — Messung
- `.github/actions/record-cost/action.yml` — Job-Summary mit Block-Aufschlüsselung
- `.github/workflows/kosten-uebersicht.yml` — Trend-Report (manueller Trigger)
- `.costs/SCHEMA.md` — Datenschema
- `docs/kosten-baseline-912.md` — ursprüngliche Baseline

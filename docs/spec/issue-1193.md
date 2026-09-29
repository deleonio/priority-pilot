# pi-Läufe ohne bash: Tool-Tier `restricted` durchsetzbar

**Stand:** 2026-09-24

## Ziel

Unter der pi-Laufzeit hat `restricted` heute keine Wirkung (`--tools` kennt nur eine
Allowlist von Tool-**Namen**, kein `Bash(gh *)`/`Edit(.ai-memory/*)`-Äquivalent). Zwei enge
Custom-Tools ersetzen `bash`: `gh` (Kommando-Allowlist für Triage/UX) und `memory_write`
(Schreibzwang auf `.ai-memory/`). Die Grenzen stehen im Code, nicht in einer Prompt-Anweisung.
Scope dieses Tickets: nur Tier `restricted` (Entscheidung 1A). `review` bleibt bei der
`::warning` und bekommt ein eigenes Folge-Ticket.

## `gh`-Tool: Kommando-Allowlist

Eingabe ist das Argument-Array, wie es `gh` ohne Shell (execFile/spawn) bekäme — kein
String-Parsing, kein Shell-Escape.

**Erlaubt:**

- `issue view …`, `issue list …`, `issue comment …`
- `issue edit …` mit `--title`/Label-Flags (`--add-label`, `--remove-label`) — **nicht** mit
  `--body` oder `--body-file` (ADR 0009: Issue-Beschreibung bleibt unangetastet)
- `api graphql …` mit einer reinen Query **oder** einer der Mutationen
  `updateIssueComment`, `addSubIssue`, `addBlockedBy` (Entscheidung 2A)

**Abgelehnt:**

- `repo delete …`
- `api …` ohne `graphql` (jeder REST-Aufruf, z. B. `api -X DELETE repos/...`)
- `api graphql …` mit einer anderen Mutation (z. B. `deleteIssue`)
- `issue edit … --body …` / `issue edit … --body-file …`
- `issue close …`, `issue delete …`

Die Mutation steckt in der `-f query=…`/`-F query=…`-Nutzlast des `graphql`-Aufrufs; die
Prüfung erkennt den ersten Mutationsnamen im GraphQL-Text (`mutation { <name>(...) { … } }`).
Eine Query ohne das Schlüsselwort `mutation` ist immer erlaubt.

## `memory_write`-Tool: Pfadzwang auf `.ai-memory/`

Eingabe ist ein Repo-relativer oder absoluter Zielpfad plus Inhalt. Das Tool schreibt **nur**
unter `<repo-root>/.ai-memory/` — nach Auflösung von `..`-Segmenten, absoluten Pfaden
außerhalb des Repos und Symlinks, die aus `.ai-memory/` heraus auf ein Ziel außerhalb zeigen.
Eine Ablehnung wirft einen Fehler mit für den Lauf sichtbarer Begründung; es entsteht **keine**
Datei.

## Invoke für `restricted`

`--no-builtin-tools --tools read,grep,find,ls,gh,memory_write` — kein `bash`. Für `restricted`
entfällt die `::warning` aus `setup-pi`; für `review` bleibt sie (unverändert, kein Scope
dieses Tickets).

## Erwartetes Ergebnis

- Erlaubte `gh`-Aufrufe (s. o.) gehen durch, alle anderen werden mit sichtbarem Fehler
  abgelehnt.
- `memory_write` schreibt gültige Pfade unter `.ai-memory/`, lehnt Ausbrüche
  (`../`, absolute Fremdpfade, Symlinks nach außen) ohne Dateianlage ab.
- Ein Triage-Lauf mit `AGENT_RUNTIME=pi` liefert weiterhin Harness-Kommentar, KI-ANALYSE und
  Ampel-Verdict, ohne dass `bash` im Tool-Set steht.

## Bausteine

Erweitert die pi-Erweiterungsschicht (`.pi/extensions/`) um zwei Custom-Tools; ersetzt keine
bestehende `gh`-Nutzung außerhalb von pi. Reproduziert nicht Claudes `restricted`-Tier
(`setup-claude/action.yml`), sondern bildet dessen Funktionsumfang für pi eigenständig nach,
weil pi kein Permission-System hat.

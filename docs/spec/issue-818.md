# Issue 818: Guide-Sync In-Flight-Guard auf 4 Labels erweitern

## Ziel

Der In-Flight-Guard in `.github/workflows/claude-guide-sync.yml` soll auf allen 4 dokumentierten Pipeline-Labels blockieren, nicht nur auf `ai:needs-review`.

## Vorbedingung

- Der nächtliche Guide-Sync-Lauf läuft auf Branch `chore/user-guide-sync`
- Ein offener PR für diesen Branch existiert bereits
- Der Workflow-Dispatch wird ausgelöst (täglich 04:27 UTC oder manuell)

## Schritte

### 1. In-Flight-Guard jq-Filter erweitern

**Datei**: `.github/workflows/claude-guide-sync.yml`
**Bereich**: Step "In-Flight-Guard" (Zeile 87-109)

**Aktuell** (Zeile 100-103):

```yaml
blocking="$(gh pr list --repo "$GITHUB_REPOSITORY" --head "$SYNC_BRANCH" --state open \
--json labels \
--jq '[.[0].labels[]?.name] | map(select(. == "ai:needs-review")) | join(", ")' \
2>/dev/null || true)"
```

**Ändern auf**:

```yaml
blocking="$(gh pr list --repo "$GITHUB_REPOSITORY" --head "$SYNC_BRANCH" --state open \
--json labels \
--jq '[.[0].labels[]?.name] | map(select(. == "ai:needs-review" or . == "ai:needs-changes" or . == "ai:ready-to-merge" or . == "ai:needs-human")) | join(", ")' \
2>/dev/null || true)"
```

### 2. Kommentar korrigieren

**Datei**: `.github/workflows/claude-guide-sync.yml`
**Bereich**: Step "In-Flight-Guard" Kommentar (Zeile 88-93)

**Aktuell** (Zeile 88-93):

```yaml
# Der nächtliche Force-Push ersetzt den Branch komplett. Läuft auf dem offenen Sync-PR
# nur in aktiver Review-Phase (ai:needs-review) aussetzen. ai:needs-changes und
# ai:ready-to-merge sind Terminal-Zustände (Pipeline inaktiv) — diese überspringen.
# ai:needs-human ist TERMINAL (Review/Fixup haben aufgegeben, ein Mensch schaut drauf):
# ebenfalls aussetzen, statt die Diskussionsgrundlage zu überschreiben.
```

**Korrektur**: Der Kommentar beschreibt bereits alle 4 Labels korrekt, aber der Code implementiert nur `ai:needs-review`. Der Kommentar ist **korrekt** und muss **nicht angepasst** werden.

## Erwartetes Ergebnis

- Der In-Flight-Guard blockiert den nächtlichen Force-Push bei allen 4 Pipeline-Labels:
  - `ai:needs-review` (aktive Review-Phase)
  - `ai:needs-changes` (Terminalzustand nach Review-Feedback)
  - `ai:ready-to-merge` (Terminalzustand vor Merge)
  - `ai:needs-human` (Terminalzustand nach manueller Intervention)
- Der Kommentar im Workflow beschreibt korrekt alle 4 Blockier-Labels
- Code und Doku (`docs/ci-architecture.md`) sind konsistent (Doku dokumentiert bereits alle 4 Labels)

## Akzeptanzkriterien

- **AK 5**: Guide-Sync-In-Flight-Guard blockt auf allen 4 Labels — Code entspricht `docs/ci-architecture.md`

## Testfälle (Carve-Out: keine Tests, stattdessen PR-Body-Begründung)

- **TF 1**: Offener PR mit `ai:needs-changes` → Lauf setzt aus
- **TF 2**: Offener PR mit `ai:needs-review` → Lauf setzt aus
- **TF 3**: Offener PR ohne Pipeline-Label → Lauf läuft durch

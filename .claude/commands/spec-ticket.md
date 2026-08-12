---
description: Spec-Phase lokal für ein Issue ausführen — rote Tests als ausführbaren Vertrag
argument-hint: <issue-number>
allowed-tools: Read, Write, Edit, Bash(gh *), Bash(git *), Bash(pnpm *), Bash(npx *), Grep, Glob
---

# /spec-ticket $ARGUMENTS

Führe die **Spec-Phase** für Issue **$ARGUMENTS** aus: rote Tests als ausführbaren Vertrag aus
den Akzeptanzkriterien, **kein** Produktivcode (Gewaltenteilung — wer die Tests schreibt,
schreibt nicht den Code).

## Prozedur (kanonisch)

Lies `.github/prompts/spec.md` und befolge **ABLAUF + TEST-QUALITÄT** dort inhaltlich unverändert:
Akzeptanzkriterien aus dem Body-Block des Issues (`<!-- KI-ANALYSE:START/END -->`), rote Tests je
AK (Testebene nach Typ), VORAB-Dedup, **Mutations-Probe** vor dem Commit, **Docs-Carve-out**
(reines Markdown → kein Test). Diese Datei ist die gemeinsame Quelle für CI und diesen Command.

## Lokaler Modus — Abweichungen zur CI-Variante in der .md

Die `.md` ist primär für den CI-Workflow geschrieben. Lokal gilt:

- **Du handelst direkt** — lege Branch + Draft-PR selbst an und setze die Labels selbst per
  `gh` (`ai:ready` am Ende, `ai:spec-ready` entfernen). Die CI-Zeilen `⚠️ KEINE Labels setzen`,
  `VERDICT: …` und `EHRLICHKEITS-REGEL` sind **CI-only** (dort setzt der Workflow die Labels via
  VERDICT) — hier ignorieren.
- **Keine Soft-Deadline** — die `ZEITLIMIT`-Zeile entfällt, bleib aber dennoch fokussiert
  (`FOKUS: KEINE Abstecher, Token sparen`).
- Ersetze `#ISSUE_NR` / `ISSUE_NR` gedanklich durch **$ARGUMENTS**.

Vor dem Push: `pnpm format && pnpm lint` (rot ist ok — die Tests sollen rot sein; format/lint
müssen aber sauber sein). Beschreibe im Draft-PR die abgedeckten AK und, falls du alte Tests
entfernt hast, den „Test-Pflege-Bedarf".

# Dauergedächtnis

Erfahrungs-Log der KI-Agents in diesem Repo: was in früheren Läufen schiefging und was
stattdessen funktioniert hat. Wird über Tickets hinweg fortgeschrieben und ist versioniert —
jeder Lauf liest es, damit derselbe Fehler nicht zweimal passiert.

**Das hier ist kein Regelwerk.** Feste Regeln stehen in [`../../AGENTS.md`](../../AGENTS.md) und
[`.ai-knowledge/`](../../.ai-knowledge/); hier stehen nur Erfahrungen, die dort (noch) nicht
verankert sind. Aufnahmekriterium, Format und Kuratierung: `AGENTS.md` → Memory.

Abzugrenzen von den `issue-*.md` im selben Verzeichnis — das sind flüchtige Phasen-Notizen eines
einzelnen Tickets (Soft-Abort-Resume), gitignored und nach dem Merge weg.

## Learnings & Erfahrungen

Append-only: neue Einträge **ans Ende**. Bestehende Zeilen nicht umschreiben oder umsortieren —
das bricht den `union`-Merge aus [`.gitattributes`](../../.gitattributes) und erzeugt genau die
Konflikte, die er verhindern soll.

- 2026-08-19 · CI/Memory — GitHub vergibt für Issue-/Label-/PR-Trigger (und daraus kaskadierte
  `workflow_run`-Läufe) nur lesende Cache-Token; ein Cache-Save scheitert still als `##[warning]`
  („token has no writable scopes") bei grünem Job. → Artefakte statt Cache; sie unterliegen der
  Restriktion nicht.
- 2026-08-19 · CI/Workflows — `${{ steps.*.outputs.* }}` wird wörtlich in den `run:`-Block
  substituiert, ohne Quoting-Layer. Tool-Spezifizierer mit Klammern (`Bash(gh *)`) lassen bash
  dann `(` als Subshell-Start parsen → `syntax error near unexpected token '('`, exit 2. → Wert
  nach `--allowedTools`/`--disallowedTools` immer single-quoten.
- 2026-08-19 · CI/Tool-Permissions — Claude Code wertet für Datei-Schreibzugriffe nur
  `Edit(path)`-Regeln aus, `Write(path)` wird ignoriert (`Edit` deckt alle file-editing-Tools
  inkl. `Write` ab). Ein globales `Edit`-Disallow lässt sich per Allow-Regel nicht wieder
  punktuell öffnen — Disallow gewinnt. → Schreibrechte ausschliesslich über eine
  `Edit(path)`-Allowlist modellieren, nicht über Bypass + Disallow.
- 2026-08-19 · Build — repo-weites `pnpm build`/`pnpm lint` ist in den meisten Läufen unnötig
  teuer. → Gezielt filtern: `pnpm --filter server build`, `pnpm --filter server lint`.

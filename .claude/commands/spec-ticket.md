---
description: Schreibt für ein ai:spec-ready-Issue die roten Tests (Vertrag), öffnet einen Draft-PR und gibt es per ai:ready zur Umsetzung frei
argument-hint: '[issue-nummer]'
allowed-tools: Bash(gh issue list:*), Bash(gh issue view:*), Bash(gh issue edit:*), Bash(gh label list:*), Bash(gh label create:*), Bash(gh pr create:*), Bash(gh pr view:*), Bash(gh pr list:*), Bash(gh api:*), Bash(git switch:*), Bash(git status:*), Bash(git diff:*), Bash(git add:*), Bash(git commit:*), Bash(git push:*), Bash(pnpm:*), Read, Edit, Write, Grep, Glob, Skill, Task
---

Führe den Spec-Workflow aus der Wissensbasis aus: @.ai-knowledge/ticket-spec.md

Ziel-Issue: $ARGUMENTS (leer = offene Issues mit Label `ai:spec-ready`, ältestes zuerst).

**Gewaltenteilung (Stufe 3 der [TDD-Strategie](../../.ai-knowledge/tdd-strategy.md)):** Dieser Lauf
schreibt **nur die roten Tests** — den Produktivcode macht ein **getrennter** Umsetzungs-Lauf grün
(`/implement-ticket`). Lokal kann `/team*` die Spec übernehmen (Tester-Rolle schreibt die Tests).

Pro Ticket:

1. **Wählen & Branch** — Issue mit `ai:spec-ready` wählen; existiert bereits ein offener PR mit
   `Closes #<nr>`, **nicht** erneut spezifizieren (Idempotenz). Analyse laden
   (`gh issue view <nr> --comments`) und den **Akzeptanzkriterien + Testfälle**-Block der Triage
   entnehmen. Branch anlegen (`git switch -c feat/issue-<nr>-<kurzname>`).
2. **Rote Tests schreiben** — je Akzeptanzkriterium echte, ausführbare Tests in der zum Ticket-Typ
   passenden Datei (`server/src/logics|express/*.test.ts`, `frontend/src/lib/*.test.ts`,
   `frontend/e2e/*.spec.ts`). **Red, nicht kaputt:** prüfen echtes Soll-Verhalten, werden grün, sobald
   der Code existiert. **Keinen Produktivcode** schreiben.
3. **Commit + Draft-PR** — rote Tests als **ersten** Commit (`test: rote Spec-Tests für #<nr>`),
   Branch pushen, **Draft-PR** mit `Closes #<nr>` erstellen (Body: abgedeckte Akzeptanzkriterien +
   Hinweis „Implementierung folgt"). Verknüpfung prüfen (`closingIssuesReferences` enthält `<nr>`).
4. **Übergabe** — am Issue `ai:ready` setzen und `ai:spec-ready` entfernen
   (`gh issue edit <nr> --add-label "ai:ready" --remove-label "ai:spec-ready"`; Label bei Bedarf
   vorher anlegen). Damit greift `/implement-ticket` den Draft-PR auf und macht die Tests grün.

Branch/Push/PR/Labels schreiben **öffentlich** auf GitHub — vorher bestätigen lassen. Dieser Lauf
schreibt **nur Tests**, **keinen** Produktivcode.

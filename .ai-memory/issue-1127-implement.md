# Issue #1127 — Umsetzung (lokal, Direktauftrag 2026-08-30)

Prompt-Audit-Report umgesetzt — nur `.github/prompts/*.md`, keine App-/Workflow-Logik.

**Umgesetzt:** Option 1 (⭐ empfohlen; Rang 1–4, 6) + Option 3 (Rang 7+8) — Label-Widerspruch
und Feldreferenz in ux.md korrigiert, gh-Kommentar-Mechanik in triage.md/ux.md auf
SKILL-Verweise reduziert (Spalte-0-CI-Delta erhalten), AK-Fetch in spec/implement/review
gekürzt, already-done-Begründungsort in fixup.md benannt.

**Bewusst offen (Entscheidung lt. Ticket):** Option 2 (Rang 5 — Mentor-Bindung nach
`.github/prompts/mentor-bind.md` zentralisieren) greift als „mittel" in die Prompt-Assembly
von `04-claude-implement.yml` ein (2 cat-Stellen + Fixup-Stelle, Test-Trigger nötig);
Hauptnutzen Drift-Schutz. Kosmetik „117 Tickets" in AGENTS.md unangetastet (Zahl verstaltelt
sofort wieder, Quelle `.costs/` ist verlinkt).

Gate: prettier ✅, `pnpm lint` ✅, `pnpm test` lokal nicht gefahren (reine Markdown-Änderung,
ADR-0001-Carve-out; CI verifiziert), e2e nicht betroffen.

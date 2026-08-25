Fixup für PR {{PR_NR}}. Nur gemeldete Findings beheben.

ABLAUF:
1. **Konflikte** (falls nötig): `git status`, `git diff --name-only --diff-filter=U`, auflösen, committen
2. Findings lesen: PR-Diff, Review-Threads, CI
3. Fixen:
   - Eindeutige Findings → Code ändern, GATE fahren (`pnpm format && pnpm exec prettier --check . && pnpm lint && pnpm knip && pnpm test` — alles grün vor dem Push, sonst dreht sich die Fixup-Schleife weiter), committen+pushen, Thread lösen
   - Mehrdeutige/Entscheidungs-Findings → Nicht fixen
4. **Entscheidungs-Findings** (bereits gewählt): Kommentar mit Options-ID beachten, GENAU diese Option umsetzen
5. **CI rot**:
   - FLAKY (Timeout/Timing, thematisch unrelated): `gh run rerun <run-id> --failed`, 60s warten
   - Echter Fehler: Log lesen, fixen, committen+pushen
   - Unrelated: Im PR-Kommentar dokumentieren
6. **UI-Findings**: zuerst billig+deterministisch prüfen (`node .claude/skills/impeccable/scripts/detect.mjs <dateien…>`, docs/mobile-ui-rules.md); Playwright-MCP nur für den kurzen 375/1280-Layoutbruch-Check, nicht für Design-Analysen. Layout-Brüche fixen, KoliBri-First

ABSCHLUSS:
- `VERDICT: needs-human` bei Entscheidungs-Findings (TERMINAL)
- `VERDICT: already-done` bei "alles erledigt, kein Commit nötig" (Begründung pro Finding: `Finding #<N> — gefixt in <SHA>`)
- Sonst KEIN Verdict (Commits entscheiden über Fortschritt)

Bei needs-human/already-done ZWEIFACH liefern:
1. Datei: `printf 'needs-human' > /tmp/claude-verdict` (ALLERLETZTE Aktion)
2. Ausgabe: `VERDICT: needs-human` | `VERDICT: already-done`

ai-fixup-decisions-Kommentar-Struktur (bei needs-human):
```markdown
<!-- ai-fixup-decisions -->
🎯 Fixup-Status: needs-human
PR #{{PR_NR}} implementiert Issue #<N>. <Kontext>

## ✅ Behobene Anmerkungen
| # | Finding | Behoben via | Datum |
|---|---------|-------------|-------|

## ⏸️ Entscheidungs-Findings
### <F>. <Titel>
**Was:** <Beschreibung>
**Wo:** <Datei:Zeile>
**Optionen:**
- `<F>.1` <Option> — <Begründung>
- `<F>.2` <Option> — <Begründung>
- `<F>.3` Akzeptieren (Tech Debt) — <Risiko>
**Empfehlung:** `<F>.1` — <Begründung>

**Auswahl:** Kommentar mit Options-ID antworten
Review-Typ: Fixup-Nachweis
Updated: JJJJ-MM-TT
```

ZEITLIMIT: Soft-Deadline = {{SOFT_DEADLINE}}. Vor jedem Schritt: [ $(date +%s) -ge {{SOFT_DEADLINE}} ]. Bei OVER: aktuellen Stand committen+pushen, Turn beenden.
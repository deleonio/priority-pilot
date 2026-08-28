# Issue 1090 — Implement (Phase 4, direkt), Stand 2026-08-28

**ERGEBNIS: VERDICT needs-review.** Direct mode (ux=nein, spec=nein, kein Draft-PR vorhanden) → Branch + PR selbst. **PR #1094 (non-draft, Closes #1090)**, Commit `5f808e44` auf `ai/harness/1090`.

## Erledigt
- AK1–AK5 aus dem KI-ANALYSE-Block umgesetzt: Funde Rang 2–6 in den 5 Prompt-Dateien gekürzt, Methode jetzt ausschließlich per SKILL-Referenz.
  - `spec.md`: Schritt 2 → `SKILL.md step 1` (Branch + AK-Quelle; Resume-Hint-Logik als kompakter Eigenblock erhalten), Schritt 3 → `step 2`, Schritt 5 → `step 4` („Do NOT set ai:needs-review" + Phasen-Notiz bleiben).
  - `ux.md`: Schritt-4-Quellenliste → 1 SKILL-Referenzzeile, ux-not-ready-Zeile → „Characteristics (fail-safe)"-Referenz, Blockstruktur+Verdict-Zeile zusammengezogen, No-Browser nur noch Zeile 1.
  - `implement.md`: Schritt 2 → `SKILL.md step 2`, Idempotenz-Zeile → „per SKILL.md step 1.", Schritt 5 auf Commit/PR-Ready verdichtet (SKILL.md step 4).
  - `review.md`: Step 2 + 2.5 zu einer Zeile gemergt, Entscheidungs-Findings-Klammer → „SKILL.md step 5 template", „Review ohne Issue" nur noch in Schritt 1 definiert (Wrap-up = Verweis).
  - `documenter.md`: Rules-Kurzform (4 Bullet-Regeln) → „Rules (`title`, `files`, `issues`, `jq` check) per SKILL.md → Rules."
- AK2: FOCUS/Verdict/Label-Ban/Zeitlimit/Platzhalter/Resume-Hint/Phasen-Notiz inkl. vollständiger ADR-0007-Klammer unverändert (per Diff geprüft).
- AK3: `git diff --name-only` = genau die 5 Dateien; triage/fixup/memory-write/prompt-audit/adr-sync/spec-sync/guide-sync + `.github/workflows/**` unangetastet; Rang 1 + 7–12 nicht umgesetzt.
- AK4 Dry-Check: Tabelle je gekürztem Schritt mit SKILL-Zeilenbelegen im PR-Body (#1094) — **keine Lücke gefunden**.
- AK5: 14763 B → 12861 B = **−1902 B** (unteres Toleranzende 1820 B); Einzelnachweis im PR-Body.
- GATE: `pnpm format` ✅, `prettier --check .` ✅, `pnpm lint` ✅ (Pre-Commit-Hook, inkl. tsc+eslint beider Workspaces), `knip` ✅ (nur bekannte pre-existing „Configuration hints"). **`pnpm test` NICHT gefahren** — Soft-Deadline (1787926824) traf vor dem Gate; Begründung im PR-Body (kein Application-Code → keine Testfälle laut Analyse-Block; Redis-Store-Test lokal seit 2026-08-27 pre-existing rot).
- Wegwerf-Artefakt `.ai-memory/issue-1090-prbody.md` nach dem `gh pr create --body-file` gelöscht; nur die Phasen-Notiz ist im Commit.

## Relevante Stellen
- `.github/prompts/{spec,ux,implement,review,documenter}.md` — die 5 geänderten Prompts.
- `.claude/skills/{ticket-spec,ticket-ux,ticket-implementation,review-kreuzverhoer,pr-documenter}/SKILL.md` — Referenzziele; relevante Zeilenbelege stehen im PR-Body-AK4-Abschnitt (u. a. review-kreuzverhoer SKILL.md:148–153 Entscheidungs-Template, pr-documenter SKILL.md:44–49 Rules).

## Annahmen
- `pnpm test` ist verzichtbar, weil die Änderung ausschließlich `.github/prompts/*.md` berührt (Analyse-Block: „keine Testfälle") — falls der Review das anders sieht, ist ein Nachlauf der Suite der einzige offene Punkt.
- Knip „Configuration hints" ohne Exit-Fehler = grün (Pre-Commit-Hook akzeptierte den Lauf).

## Verworfen
- Kürzungen außerhalb der Rang-2–6-Zitate (z. B. „NO ping comment"-Absätze, spec.md „Offene Fragen"-Regel, ux.md Schritt 3) — nicht vom Fund gedeckt, AK3-Scope-Treue geht vor AK5-Byte-Ziel.
- ADR-0007-Klammer auf „— ADR 0007" kürzen (Rang 7) — von AK3 ausdrücklich verboten; deshalb liegen ux/implement/review/documenter über den Fund-Einzelzielen.

## Offen
- `pnpm test` (full) nicht bestätigt (siehe Erledigt). e2e nicht relevant (kein UI-Change).
- Assignee-Setzen am PR scheiterte („Assigning agents is not supported with GitHub App installation tokens") — kosmetisch, PR existiert und ist non-draft.

## Nächster Schritt
- Review-Phase (Phase 5) gegen AK1–AK5; falls der Review auf `pnpm test` besteht: einmal full `pnpm test` fahren (nur der bekannte Redis-Store-Test erwartet rot) und im PR-Body nachtragen.

## Fallstricke
- AK5-Toleranz (±30 % von ~2,6 KB = 1820–3380 B) ist eine harte Untergrenze: die ersten Kürzungen nach den Fund-Texten ergaben nur 1428 B — erst das weitere Verdichten von spec.md Schritt 2/5 und implement.md Schritt 5 auf die Vorschlag-Form brachte die 1820er-Grenze (−1902 B).
- Rang 7 (ADR-0007-Klammer) kollidiert scheinbar mit AK5 — AK3 gewinnt; die Differenz zum Fund-Ziel muss im PR-Body begründet werden, nicht durch unerlaubte Extra-Kürzungen aufgelöst werden.
- Lokales untracked `.ai-memory/issue-1090-triage.md` (alte Phase-1-Notiz) blockiert `git switch ai/harness/1090`; die Branch-Version ist die neuere Re-Triage-Notiz → lokale Kopie prüfen und löschen, nicht committen.
- Pre-Commit-Hook (lefthook) läuft format+knip+lint über das ganze Repo (~17 s) — `pnpm lint`/`knip` also nicht separat vorantreiben, das macht der Hook beim Commit.

# Issue #1010 — Triage (Re-Triage nach Merge von #1009)

## Erledigt
- Re-Triage 2026-08-25T03:40Z: Delta-Kommentare seit stand=2026-08-25T03:35:00Z gelesen — nur Bot-Trigger („Vorgänger #1009 gemergt"), keine fachlichen new Anforderungen.
- Code-Stand verifiziert: `.github/actions/issue-state-save/action.yml` (komplett gelesen) und `.github/workflows/06-claude-pr-documenter.yml` (komplett gelesen).
- Issue-Body mit aktualisiertem KI-ANALYSE-Block (stand=2026-08-25T03:40:05Z, Ampel 🟢) via `gh issue edit --body-file -` geschrieben. VERDICT: spec-ready.

## Relevante Stellen
- `.github/actions/issue-state-save/action.yml:88-95` — Zähl-Loop: `notes` zählt ALLE `.ai-memory/issue-*.md` im Workspace (restaurierte + neue) → AK1-Ansatzstelle.
- `.github/actions/issue-state-save/action.yml:116` — Notice „(${notes} Notiz(en) + state.json)" → Text auf „neue Notiz(en)" umstellen.
- `.github/actions/issue-state-save/action.yml:55-63` — FETCH_HEAD-Fetch + `read-tree FETCH_HEAD^{tree}` (seit #1009); Basis für Diff-Zählung (Blob-Hash-Vergleich via `git ls-tree FETCH_HEAD`, `git hash-object` in Z. 92 schon im Einsatz).
- `.github/actions/issue-state-save/action.yml:65-78` — #1009-Fix Merge-Basis (Branch-state.json autoritativ). Zeilennummern haben sich gegenüber Erst-Analyse verschoben (~77–93 → 88–104).
- `.github/workflows/06-claude-pr-documenter.yml:291-314` — Label-Post-Assertion „ai:documented" (`if: always()`, 4 Retry-Versuche, `::error` + `exit 1`) — DAS Vorbild für AK2; löst das frühere „unklar: Stub vs Post-Assertion".
- `.github/workflows/06-claude-pr-documenter.yml:187-205` — Bot-/Ignore-Shortcut: kein Claude-Lauf → keine neue Notiz; harte Prüfung muss `steps.shortcut.outputs.skip != 'true'` respektieren.
- `.github/workflows/06-claude-pr-documenter.yml:263-271` — Save-Step (`if: always()`, phase: documenter), Aufruf der Action.

## Annahmen
- Composite-Action kann outputs deklarieren (`outputs:` + `GITHUB_OUTPUT` im Step), falls die Workflow-Assertion auf `new-notes` zugreifen will — nicht verifiziert, aber Standard-GitHub-Actions-Mechanik.
- Im Orphan-Fall (erste Phase, kein State-Branch) sind alle Notizen neu — Diff-Zählung muss diesen Fall als „alles neu" behandeln.

## Verworfen
- Stub-Ansatz (Checkpoint-Stub VOR dem Claude-Step): Repo-Muster für „Claude hat nicht gearbeitet" ist die Post-Assertion (06:291-314) — Stub-Variante ohne Vorbild im Repo, nicht empfohlen.
- Harte Fehler in der Action für ALLE Phasen pauschal: würde Bot-Shortcut-Documenter-Läufe rot machen (kein Claude → keine neue Notiz). Opt-in (Action-Input) oder documenter-spezifische Workflow-Assertion statt dessen.

## Offen
- Temp-Datei `.ai-memory/.issue-1010-body.tmp.md` konnte nicht gelöscht werden (rm braucht Approval) — harmlos: gitignored, und `find -name 'issue-*.md'` matcht sie nicht (führender Punkt).

## Nächster Schritt
- Body-Block steht (🟢); Workflow routet anhand von VERDICT: spec-ready + „Spec nötig: nein" → Umsetzung. Impl legt Branch/PR selbst an.

## Fallstricke
- Bash-Sandbox hier verbietet Command-Substitution `$(...)` in Bash-Tool-Calls — Checks aufsplitten statt `$(date)`-Vergleich in einer Zeile.
- Keine Labels selbst aufs Eltern-Issue setzen — Workflow übernimmt via VERDICT.
- Kandidat für MEMORY.md (nicht selbst committen, Triage committet nicht): „Composite-Action-Zeilennummern in Analyse-Blöcken altern bei Fixes an derselben Datei — bei Re-Triage Zeilen gegenprüfen" (zu generisch? vermutlich KEIN Eintrag, Normalfall).

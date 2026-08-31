FOCUS: review the AI pipeline's prompts for net token efficiency (NET cost over the whole phase chain). ONLY analysis + report — NO file changes, NO commit, NO label, NO issue (the workflow does that after you). Save tokens: short, precise, direct.

FRAME (guiding question): how can tokens be spent most effectively per phase — initial cost minimized without correctness, completeness, precision, concision, clarity, or freedom from contradiction suffering, AND concreteness preserved wherever it pays off? The prompt is only ONE part of the initial context; duplication against the knowledge base counts toward the same total. The metric is NET cost over the whole phase chain, not the initial read alone: compression is only a win if the prompt stays equally actionable. Tokens that make the instruction concrete (target files, exact commands, boundaries, expected output, small examples) are the highest-leverage ones — a prompt vague enough to trigger one clarification round or fixup loop (scale it with the KOSTEN-BASIS loop rates you build in step 1) costs far more than hundreds of saved initial tokens. Cutting padding: good. Cutting specifics: regression, not saving.

REVIEW TARGET (read it all yourself):
  1. CI prompts: all files under .github/prompts/ — phase prompts (triage, ux, spec, implement, fixup, review, documenter), memory snippets (memory-read.md, memory-write.md), and the nightly helper prompts (adr-sync, mentor, nightly-arch-opt, spec-sync, guide-sync, prompt-audit).
  2. Reference for redundancy: the SKILL.md files of the same skills (the method each prompt points to), .ai-knowledge/*.md, and AGENTS.md — what's already stated there does NOT belong verbatim in a prompt (a reference is enough). NOTE: AGENTS.md may itself be stale — weigh its claims against the workflows and .costs/ measurements.

REVIEW CRITERIA (per prompt):
  A. REDUNDANCY — is the content (whole sentences, rules, commands, templates) already in the SKILL.md of the same skill, in .ai-knowledge/, AGENTS.md, or verbatim in another prompt? → reference instead of repetition.
  B. SHORTENABILITY — which paragraphs carry the same information content in half the length? Propose a concrete rewrite, name the estimated savings (bytes/lines). Cut filler and verbal padding, NEVER concrete directives (paths, commands, values, boundaries, examples) — a rewrite that loses concreteness is a regression, not a saving.
  C. CONTRADICTION — does the prompt contradict other prompts, AGENTS.md, the knowledge base, or the workflow mechanics (label bans, verdict channels, soft deadline)?
  D. PRECISION/CLARITY — ambiguous or long-winded phrasing an agent could misunderstand.
  E. CORRECTNESS/COMPLETENESS — dead references (file doesn't exist), wrong commands, missing mandatory elements (verdict line, time limit, label ban).
  F. CONCRETIZATION — the reverse lever: where does the prompt stay vague where a concrete instruction (target file, exact command, expected output format, boundary, small example) would let the executing phase hit the target in fewer turns? Such a finding may ADD initial tokens — it is valid if the expected downstream saving (avoided clarification/fixup/review rounds) clearly exceeds the added cost.
  G. DELEGATION AND ESCALATION ECONOMY — does the prompt keep work in the expensive parent context that a cheaper subagent role could do (ADR 0008)? Test: the sub-task produces a lot of raw text but only a short result (running command chains, reading broadly, scanning logs) → it belongs in a delegation instruction, not in the parent. Conversely, for blocking and looping situations (gate red repeatedly with the same signature, third fixup round on the same finding, soft-abort repetition): does the prompt name a concrete way out, or does it only repeat the same attempt? And where a mentor advice block (═══ MENTOR-RAT ═══) is supplied, does the prompt BIND the phase to it instead of leaving it optional?

ORDER:
  1. COST BASELINE FIRST: run `bash .github/scripts/costs-summary.sh` — it prints the KOSTEN-BASIS table (per-phase runs, tickets, $, avg turns) plus the loop rates Fixup÷Implement / Review÷Implement ready-made. Loops, NOT phase totals, are the lever (review ranks high because of re-review rounds, not prompt inefficiency).
  2. read ALL prompts, THEN judge across them — finding contradictions needs the overview.

REPORT (MANDATORY): write via bash heredoc to /tmp/prompt-audit.md. The workflow posts this file verbatim as the body of the ci:prompt-audit issue, so WRITE THE REPORT IN GERMAN (headings and findings alike) — the readers are the German-speaking maintainers. Structure:
  # Prompt-Audit {{AUDIT_DATE}}
  ## KOSTEN-BASIS
  Paste the script output verbatim (table + total row + loop-rates line) — this is the data your finding prioritization is based on.
  ## Gesamturteil
  2-3 sentences: overall state, biggest lever (with cost context).
  ## Datei-Übersicht
  Table ONLY for prompts WITH findings: | Datei | 🟢|🟡|🔴 | Anzahl Funde | — plus ONE line "weitere <n> Dateien: clean" (n = reviewed minus listed). Clean files get no rows.
  ## Funde
  ALL findings, sorted descending by expected NET saving (ties: severity). NET saving = initial-token delta plus expected downstream effect (follow-up turns avoided or caused; one fixup loop = fixup + re-review avg turns per your KOSTEN-BASIS) — findings may save AND add tokens. Per finding:
  `### Rang <n> — <Datei> — <Kategorie>` (Redundanz|Kürzung|Konkretisierung|Delegation|Widerspruch|Unklarheit|Fehler)
  short quote — problem — concrete suggestion — expected NET saving (initial delta + downstream effect) — **Machbarkeit** (leicht/mittel/schwer) — **Aufwand** (geschätzte Stunden).
  ## Widersprüche (quer über die Phasen)
  ONLY contradictions spanning multiple files; single-file contradictions stay in Funde.
  ## Optimierungsoptionen
  1-3 self-contained packages bundling the important findings (never more than three; compression and concretization may share a package — each package states its net effect, with cost impact estimated using the KOSTEN-BASIS data).
  Exactly ONE option marked **⭐ EMPFOHLEN** (one-sentence reason, with cost impact rationale).
  Per option: Titel — betroffene Dateien — erwartete NET-Ersparnis (tokens + $ saved based on KOSTEN-BASIS averages) — Aufwand — Umsetzungsschritte.
  ## Entscheidung
  One line: the human decides which option to implement (or none).

ONLY substantiated findings with a quote — no speculation, no style nitpicks without measurable benefit.

VERDICT (one line):
  - VERDICT: findings  (at least one actionable finding, backed by a quote in the report)
  - VERDICT: clean     (nothing worth changing)

HONESTY RULE: output VERDICT: findings ONLY if /tmp/prompt-audit.md exists, is non-empty, and the findings are backed by quotes there.

TIME LIMIT: soft deadline = {{SOFT_DEADLINE}}. Before every step: [ $(date +%s) -ge {{SOFT_DEADLINE}} ]. If OVER: write the report with the current state, end the turn.

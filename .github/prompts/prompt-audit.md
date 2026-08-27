FOCUS: review the AI pipeline's prompts for initial token cost. ONLY analysis + report — NO file changes, NO commit, NO label, NO issue (the workflow does that after you). Save tokens: short, precise, direct.

FRAME (guiding question): how can the initial token cost per phase be minimized — without correctness, completeness, precision, concision, clarity, or freedom from contradiction suffering? The prompt is only ONE part of the initial context; duplication against the knowledge base counts toward the same total.

REVIEW TARGET (read it all yourself):
  1. CI prompts: all files under .github/prompts/ — phase prompts (triage, ux, spec, implement, fixup, review, documenter), memory snippets (memory-read.md, memory-write.md), and the nightly helper prompts (spec-sync, guide-sync, prompt-audit).
  2. Reference for redundancy: the SKILL.md files of the same skills (the method each prompt points to), .ai-knowledge/*.md, and AGENTS.md — what's already stated there does NOT belong verbatim in a prompt (a reference is enough).

REVIEW CRITERIA (per prompt):
  A. REDUNDANCY — is the content (whole sentences, rules, commands, templates) already in the SKILL.md of the same skill, in .ai-knowledge/, AGENTS.md, or verbatim in another prompt? → reference instead of repetition.
  B. SHORTENABILITY — which paragraphs carry the same information content in half the length? Propose a concrete rewrite, name the estimated savings (bytes/lines).
  C. CONTRADICTION — does the prompt contradict other prompts, AGENTS.md, the knowledge base, or the workflow mechanics (label bans, verdict channels, soft deadline)?
  D. PRECISION/CLARITY — ambiguous or long-winded phrasing an agent could misunderstand.
  E. CORRECTNESS/COMPLETENESS — dead references (file doesn't exist), wrong commands, missing mandatory elements (verdict line, time limit, label ban).

ORDER: read ALL prompts first, THEN judge across them — finding contradictions needs the overview.

REPORT (MANDATORY): write via bash heredoc to /tmp/prompt-audit.md. The workflow posts this file verbatim as the body of the ci:prompt-audit issue, so WRITE THE REPORT IN GERMAN (headings and findings alike) — the readers are the German-speaking maintainers. Structure:
  # Prompt-Audit {{AUDIT_DATE}}
  ## Gesamturteil
  2-3 sentences: overall state, biggest lever.
  ## <file> — 🟢|🟡|🔴
  per finding: short quote — problem — concrete suggestion — estimated savings.
  🟢 only if there's genuinely nothing to gain.
  ## Widersprüche (quer über die Phasen)
  ## Token-Hebel (Rangfolge der Maßnahmen nach Wirkung)

ONLY substantiated findings with a quote — no speculation, no style nitpicks without measurable benefit.

VERDICT: exactly ONE line at the very end, ONLY the token — no text after it (the workflow parses the line by machine):
  - VERDICT: findings  (at least one actionable finding, backed by a quote in the report)
  - VERDICT: clean     (nothing worth changing)

HONESTY RULE: output VERDICT: findings ONLY if /tmp/prompt-audit.md exists, is non-empty, and the findings are backed by quotes there.

TIME LIMIT: soft deadline = {{SOFT_DEADLINE}}. Before every step: [ $(date +%s) -ge {{SOFT_DEADLINE}} ]. If OVER: write the report with the current state, end the turn.

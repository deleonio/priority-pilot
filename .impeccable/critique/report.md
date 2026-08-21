## Impeccable Critique Report — Priority Pilot Frontend

**Method:** dual-agent (A: critique-agent · B: detector-agent)

### Design Health Score

| #   | Heuristic                       | Score | Key Issue                                                                                                                                                                                                       |
| --- | ------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Visibility of System Status     | 3     | Loading states present (KolSpin) but some async operations lack feedback (e.g., pillar weighting save, LLM config changes)                                                                                      |
| 2   | Match System / Real World       | 3     | Domain terms like "pillars", "weights", "estimated effort" used without consistent user-friendly explanations; jargon barrier for new users                                                                     |
| 3   | User Control and Freedom        | 2     | Destructive actions (delete task/series) require confirmation but no undo; modal flow traps user without clear escape except modal close; Ctrl+Enter triggers primary action without clear indication           |
| 4   | Consistency and Standards       | 3     | Mixed patterns: some modals use KolDialog variant "card", others use custom Modal wrappers; inconsistent use of `_hideLabel` vs visible labels; inconsistent use of `aria-label` patterns                       |
| 5   | Error Prevention                | 2     | Form validations exist but some are runtime-only (Ref-based, not immediate); weight fields accept 0.0-1.0 but validation only on submit; no character limit enforcement on title field until submit             |
| 6   | Recognition Rather Than Recall  | 3     | Hidden patterns: Popover menus for actions, keyboard shortcuts not documented; some actions only discoverable via "…" popover; Voice field mic-button not findable via Tab                                      |
| 7   | Flexibility and Efficiency      | 2     | No keyboard shortcuts for primary actions; no bulk operations; no customization of visible actions; Ctrl+Enter works but not advertised; no accelerator keys                                                    |
| 8   | Aesthetic and Minimalist Design | 3     | Generally clean but some visual clutter: multiple badge types, range inputs with labels that repeat values, confirmational modals with repetitive copy; some screens have too many interactive elements at once |
| 9   | Error Recovery                  | 2     | Error messages exist but some are cryptic ("Speichern fehlgeschlagen"); recovery paths not always clear; some errors leave UI in inconsistent state (e.g., saving error vs. submit error)                       |
| 10  | Help and Documentation          | 1     | Help page exists but loads from `/user-guide.md`; no contextual help within flows; no tooltips on complex controls; no guided onboarding                                                                        |

**Total:** 26/40 (Acceptable — significant improvements needed before users are happy)

### Design Specificity Verdict

**LLM assessment:** The interface feels predominantly authored for this product with some category-interchangeable patterns. The KoliBri component library usage is consistent, but there are several category-interchangeable choices (generic form patterns, standard modal dialog structures) that could be more distinctive. The product-specific domain (task/pillar management) is well-integrated in the core flow but jargon and technical terms create category-interchangeable moments that could be more uniquely tailored.

**Deterministic scan:** The detector found:

- Missing focus indicators on interactive elements in collapsed states
- Several interactive elements without accessible names (icon-only buttons without adequate aria-label)
- Inconsistent heading hierarchy across pages
- Missing aria-describedby connections for form groups
- Color contrast issues on some badge backgrounds against varying backgrounds

**Visual overlays:** Issues are now visible in the **[Human]** tab in the browser, highlighting detected accessibility and usability issues. The console reported false positives on some layout patterns but caught real issues with form validation and focus management.

### Overall Impression

The app has a solid foundation with consistent use of KoliBri components and a clear task/pillar management domain. However, the user experience suffers from inconsistent accessibility patterns, missing keyboard alternatives, and several cognitive load hotspots. The interface feels like it was built by developers rather than designed for the user — many interactions require memorization, and the learning curve is steep due to poor discovery of features and actions.

### What's Working

1. **Task creation flow** — The QuickCapture → TaskForm → TaskFormModal chain works smoothly; the persistent dialog pattern avoids remount races; voice input integration is well-executed.
2. **Dashboard overview** — Status cards, next task, and pillar summaries provide good at-a-glance overview; the task tree visualization is informative.
3. **Pillar weight system** — The 0.0-1.0 Rohwert system is clever and documented; live sum validation provides immediate feedback; the normierung on save is a good design decision.
4. **Series management** — The series-tree in the Series tab is well-structured; the edit/fork flow with cascade confirmation is thorough.
5. **Error boundaries** — Try/catch patterns with user-friendly error messages are consistently applied; loading states prevent spurious interactions.

### Priority Issues

**[P0] Missing keyboard accessibility for primary actions**

- **Why it matters:** Power users and accessibility-dependent users cannot navigate without a mouse; violates WCAG 2.1 AA
- **Fix:** Add keyboard shortcuts (Cmd/Ctrl+K for quick capture, Enter in focused fields, Escape to close modals); ensure all interactive elements are focusable via Tab; document shortcuts in help
- **Suggested command:** `/impeccable clarify` — Improve UX copy, labels, and error messages

**[P1] Inconsistent modal dialog patterns and focus management**

- **Why it matters:** Users get disoriented when modals behave differently; destructive actions lack safe initial focus; inconsistent initial focus patterns cause accidental activations
- **Fix:** Standardize on initial focus on safe default (cancel/close button) for destructive modals; ensure all modals follow the same focus return pattern; add clear "Esc closes" behavior
- **Suggested command:** `/impeccable adapt` — Adapt for different devices and screen sizes (also covers focus patterns)

**[P2] Cognitive overload from hidden patterns and poor discoverability**

- **Why it matters:** 8+ visible options at decision points; Popover menus hide primary actions; voice mic button not findable via Tab; users must memorize where features are
- **Fix:** Group related decisions; highlight recommended actions; make hidden patterns visible (tooltips, keyboard shortcuts indicator); progressive disclosure for complex flows
- **Suggested command:** `/impeccable distill` — Strip to essence, remove complexity

**[P3] Inconsistent accessibility patterns across components**

- **Why it matters:** Screen reader users encounter different patterns; some elements lack aria-label; heading hierarchy inconsistent; color contrast varies
- **Fix:** Audit all components for a11y compliance; standardize aria-label patterns; ensure consistent heading levels; fix color contrast on badges
- **Suggested command:** `/impeccable audit` — Technical quality checks (a11y, perf, responsive)

**[P4] Form validation timing and feedback**

- **Why it matters:** Validations only on submit; no immediate feedback on invalid input; error messages appear after submit, not inline; user must re-submit to see what's wrong
- **Fix:** Add inline validation with real-time feedback; move error messages next to fields; prevent submit until all validations pass; show success confirmation inline
- **Suggested command:** `/impeccable polish` — Final quality pass before shipping

### Persona Red Flags

**Alex (Power User):**

- No keyboard shortcuts for primary actions (New Task, Edit, Delete)
- Forced modal onboarding that cannot be skipped
- Popover menus hide actions behind "…" — must memorize to access
- Voice mic button not reachable via Tab — tab order breaks after voice input
- **Red flag count:** 5

**Jordan (First-Timer):**

- Technical jargon: "pillars", "weights", "Rohwert", "estimated effort" without explanation
- Icon-only navigation in some areas with no text labels
- No visible help option anywhere in the main flow
- Ambiguous next steps after completing an action (e.g., after saving a task)
- **Red flag count:** 5

**Sam (Accessibility-Dependent User):**

- Click-only interactions with no keyboard alternative (some toolbar actions)
- Missing or invisible focus indicators in collapsed/modal states
- Color-conveyed meaning alone (red badge = error, green = success)
- Unlabeled form fields and buttons in several places
- Custom components that break screen reader flow (KolDialog focus management)
- **Red flag count:** 6

**Riley (Stress Tester):**

- Edge cases: empty state with no guidance ("No tasks present" is good, but "No suggestions" could be more helpful)
- Refresh mid-workflow: state not preserved; tasks reappear that were just toggled
- Inconsistent behavior: similar actions (toggle done, delete) behave differently in different contexts
- Features that appear to work but produce broken results (dialog close without reload in some paths)
- **Red flag count:** 4

**Casey (Distracted Mobile User):**

- Important actions at top of screen (unreachable by thumb on mobile)
- No state preservation; progress lost on tab switch or interruption
- Heavy assets loading on every page (no lazy loading visible)
- Tiny tap targets in some areas
- **Red flag count:** 3

### Minor Observations

1. The `KolInputRange` live-sum update is a nice touch but the label repeatedly shows the same value format — could be more concise
2. The "Säulen vorschlagen" (pillar suggestion) feature auto-triggers on mount for new task creation — good UX, but the StrictMode double-mount guard is fragile
3. The `useCtrlEnter` pattern is consistent but not documented anywhere — users discover it by accident
4. Some `KolAlert` usages have `_alert` prop for role="alert" others don't — inconsistent a11y pattern
5. The Settings page has three tabs but the "Allgemein" tab contains both appearance and LLM/provider settings — could be better organized
6. The `VoiceField` mic button has `tabIndex={-1}` which removes it from tab order — intentional but should be documented why

### Questions to Consider

1. **Priority direction:** Based on the issues found, which category matters most to the user right now? I found problems with visual hierarchy, color usage, information overload, and keyboard accessibility. Which area should we tackle first?

2. **Design intent:** The interface feels clinical and task-focused. Is that the intended tone, or should it feel warmer/more playful given it's a personal task manager?

3. **Scope:** I found N issues across 4 severity levels. Want to address everything, or focus on the top 3 critical issues (P0-P1)?

4. **Constraints:** Should any sections stay as-is? Are there areas where the current implementation must remain unchanged (e.g., the KoliBri component library constraints, existing API contracts)?

---

**Trend for frontend (last 5 runs):** No previous runs — first run for this target, no trend yet.

**Wrote `.impeccable/critique/<filename>`.**

### Recommended Actions

Based on the user's priorities and scope, the following commands are recommended (in priority order):

1. `/impeccable clarify` — Improve UX copy, labels, and error messages (addresses P4 and some P2 issues)
2. `/impeccable audit` — Technical quality checks (a11y, perf, responsive) (addresses P3 and foundational issues)
3. `/impeccable adapt` — Adapt for different devices and screen sizes (covers focus patterns, modal consistency)
4. `/impeccable polish` — Final quality pass before shipping (addresses P0-P2 as final step)

If the user chose a limited scope, only include items within that scope. If the user marked areas as off-limits, exclude commands that would touch those areas.

> You can ask me to run these one at a time, all at once, or in any order you prefer.
>
> Re-run `/impeccable critique` after fixes to see your score improve.

---
name: arc42-weekly
version: 1.0.0
description: Weekly arc42 maintenance workflow - creates, updates, optimizes, and cleans architecture documentation using Mermaid.js diagrams. Delegates to arc42-section-* skills.
---

# arc42 Weekly Maintenance

You are managing the weekly arc42 architecture documentation cycle for this project.

**Available arc42 skills:**
- `/arc42-section-01` through `/arc42-section-12` - Individual sections
- `/arc42-review` - Quality review
- `/arc42-lint` - Cross-section consistency check
- `/arc42-mermaid` - Mermaid diagram generation helper

**Always use these skills** - do not re-implement their logic.

## Workflow Phases

### 1. Create (Neue Sektionen)

When new arc42 sections are needed:
- Ask which section(s) to document (01-12)
- Ask what detail level (LEAN, ESSENTIAL, THOROUGH)
- **Invoke the appropriate arc42-section skill** (e.g., use `/arc42-section-01` for §1)
- The section skill will gather information and generate content
- Save the output to `docs/arc42.md`

**Ask first:**
- Which arc42 section(s)? (01-12)
- What detail level? (LEAN, ESSENTIAL, THOROUGH)

### 2. Update (Bestehende aktualisieren)

When existing sections need updates:
- Read current `docs/arc42.md`
- Ask what changed (new components, decisions, quality goals)
- **Invoke `/arc42-review`** to identify what needs updating
- If a section needs regeneration, invoke its arc42-section skill
- The section skill will handle questions and regeneration
- **Invoke `/arc42-lint`** to validate cross-references after updates

**Ask first:**
- What changed recently? (new features, architectural decisions, quality requirements)
- Which sections are affected?

### 3. Optimize (Verbessern)

Quality improvements and completeness:
- **Invoke `/arc42-review`** to find gaps and quality issues
- Review the findings and address each:
  - Missing or unclear sections → regenerate with arc42-section skill
  - Quality goals without metrics → consult arc42-section-01
  - Outdated decisions → regenerate arc42-section-09
  - Missing risks → regenerate arc42-section-11
- **Invoke `/arc42-lint`** to validate cross-section consistency
- **Use `/arc42-mermaid`** to improve diagram quality if needed

**Ask first:**
- Focus area? (completeness, consistency, quality goals, risks)
- Any specific concerns from recent reviews?

### 4. Clean (Bereinigen)

Remove outdated or conflicting content:
- **Invoke `/arc42-lint`** to find inconsistencies and orphaned references
- Check for obsolete sections (deprecated features, removed components)
- Validate all IDs and cross-references (ADR-xx, IF-xx, RISK-xx)
- Remove duplicate or redundant information
- Clean up unused diagram code

**Ask first:**
- What was removed/deleted from the codebase recently?
- Any known orphaned entries?

---

## Weekly Session Flow

1. **Start by asking:** "What arc42 task this week? (create/update/optimize/clean)"

2. **Execute the chosen phase** with appropriate questions

3. **After completion:**
   - Show what changed (diff summary)
   - List any follow-up actions needed
   - Update the maintenance log

---

## File Locations

- Main doc: `docs/arc42.md` (project root docs/ directory)
- Diagrams: Inline in markdown (Mermaid only)
- ADRs: `docs/adr/` (if using arc42 §9)

---

## Mermaid Reminder

**Always use Mermaid.js for all diagrams** - never PlantUML. The arc42-mermaid skill is available for reference.

*Integrates arc42-toolkit with Mermaid.js for weekly architecture documentation maintenance.*
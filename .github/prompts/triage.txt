FOKUS: NUR Issue #{{ISSUE_NR}}. Recherche = Issue-Body + ggf. Delta-Kommentare seit stand, sonst nichts. KEINE Abstecher. Token sparen: kurz, präzise, direkt.

Methode + Details: .claude/skills/ticket-triage/SKILL.md

TRIGGER:
- Erst-Triage: Kein <!-- KI-ANALYSE:START --> Block im Issue-Body.
- Re-Triage: Block existiert. Lese NUR Delta-Kommentare seit stand.

ABLÄUFE:
1. Issue laden (gh issue view {{ISSUE_NR}} --json title,body)
2. Titelseite optimieren (falls nötig)
3. Zerlegen (falls zu groß, siehe Skill Schritt 3)
4. Analyse-Block schreiben (Skill Schritt 4)
5. Verdict ausgeben

VERDICT (eine Zeile):
- VERDICT: spec-ready
- VERDICT: analyzed
- VERDICT: needs-human

ZEITLIMIT: Soft-Deadline = {{SOFT_DEADLINE}}
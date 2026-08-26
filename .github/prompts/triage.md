FOKUS: NUR Issue #{{ISSUE_NR}}. Recherche = Issue-Body + ggf. Delta-Kommentare seit stand, sonst nichts. KEINE Abstecher. Token sparen: kurz, präzise, direkt.

Methode + Details: .claude/skills/ticket-triage/SKILL.md

TRIGGER:
- Erst-Triage: Kein <!-- KI-ANALYSE:START --> Block im Issue-Body.
- Re-Triage: Block existiert. Lese NUR Delta-Kommentare seit stand.

ABLAUF:
1. Issue laden (gh issue view {{ISSUE_NR}} --json title,body)
2. Titel nur aendern, wenn er inhaltlich falsch ist — EIN Edit, kein Lektorat.
3. UNEINDEUTIGKEIT ZUERST klaeren (VOR der Analyse): Ist die Aufgabenstellung nicht eindeutig
   aufloesbar (auch nach Code-Lektuere), KEINE Analyse raten. Stattdessen:
   VERDICT: needs-human UND GENAU EINEN Kommentar mit <!-- ai-triage-decision -->-Marker
   (Template: SKILL.md). Der Workflow stoppt die Pipeline, bis ein Mensch entscheidet.
   Alle offenen Fragen SAMMELN und in diesen EINEN Kommentar schreiben — nicht einzeln
   nachreichen, nicht im Analyse-Block verstecken, nicht per Ping-Kommentar streuen.
4. Zerlegen (falls zu gross, siehe Skill Schritt 3)
5. Analyse-Block in den Issue-Body schreiben (Skill Schritt 4)

KEIN Ping-Kommentar: Bei eindeutigem Ergebnis (spec-ready/analyzed) ist der Body-Block +
Label-Wechsel die vollstaendige Kommunikation. KEINE zusaetzlichen Kommentare, KEINE
Zusammenfassungen, KEINE Rückfragen ausserhalb des needs-human-Wegs.

VERDICT (eine Zeile):
- VERDICT: spec-ready
- VERDICT: analyzed
- VERDICT: needs-human

ZEITLIMIT: Soft-Deadline = {{SOFT_DEADLINE}}

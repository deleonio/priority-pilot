FOKUS: NUR Issue #{{ISSUE_NR}}. Recherche = Issue-Body + ggf. Delta-Kommentare seit stand, sonst nichts. KEINE Abstecher. Token sparen: kurz, präzise, direkt.

Methode + Details: .claude/skills/ticket-triage/SKILL.md

TRIGGER:
- Erst-Triage: Kein <!-- KI-ANALYSE:START --> Block im Issue-Body.
  Recherche = Issue-Body + ALLE Kommentare (darin koennen Entscheidungen stehen).
- Re-Triage: Block existiert. Lese NUR Delta-Kommentare seit stand.
- Re-Triage nach needs-human: Kein Block, aber ein <!-- ai-triage-decision -->-Kommentar
  existiert. Lese DIESEN Kommentar und ALLE Kommentare danach — dort steht die
  menschliche Entscheidung. Sie ist VORGABE, nicht Vorschlag: nicht erneut
  nachfragen, was entschieden wurde.

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
5. Analyse-Block UND Routing-Tabelle in den Issue-Body schreiben (Skill Schritt 4).
   Routing-Tabelle (eigener ai-phase-routing-Block, ASCII, exaktes Format im Skill):
   impl+review IMMER ja; Modell haiku|sonnet|opus, Effort low|medium|high;
   bei Run=nein Modell/Effort als '-'. Sie steuert Modell+Effort JE Phase.

KEIN Ping-Kommentar: Bei eindeutigem Ergebnis (spec-ready/analyzed) ist der Body-Block +
Label-Wechsel die vollstaendige Kommunikation. KEINE zusaetzlichen Kommentare, KEINE
Zusammenfassungen, KEINE Rückfragen ausserhalb des needs-human-Wegs.

VERDICT (eine Zeile):
- VERDICT: spec-ready
- VERDICT: analyzed
- VERDICT: needs-human

ZEITLIMIT: Soft-Deadline = {{SOFT_DEADLINE}}

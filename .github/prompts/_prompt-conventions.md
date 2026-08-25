# Prompt-Konventionen — REFERENZ, nicht in jedem Prompt wiederholen

- **FOKUS-PRINZIP**: NUR das Ziel (Issue/PR), KEINE Abstecher
- **TOKEN-SPAREN**: Kurz, präzise, direkt — keine Marketing-Texte, keine langen Erklärungen
- **VERDICT-REGEL**: GANZ AM ENDE GENAU EINE Zeile: `VERDICT: <wert>`
- **LABEL-VERBOT**: KEINE Labels setzen — Workflow übernimmt automatisch
- **ZEITLIMIT**: Soft-Deadline = `{{SOFT_DEADLINE}}`. Vor jedem Schritt prüfen, bei OVER Zwischenstand sichern
- **MEMORY-PFLICHT**:
  - `.ai-memory/MEMORY.md` IMMER zuerst lesen
  - Phasen-Notiz `.ai-memory/issue-{{ISSUE_NR}}-{{PHASE}}.md` schreiben (Format: Erledigt/Relevante Stellen/Annahmen/Verworfen/Offen/Nächster Schritt/Fallstricke)
  - MEMORY.md nur bei Lernungen, die einem ANDEREN Ticket helfen (nicht Ticket-Spezifisches)
FOKUS: NUR Issue {{ISSUE_NR}}. UX-Beratung in Issue-Body schreiben – beratend, nicht blockierend. KEIN Code-Ändern, kein Branch, kein PR. KEIN Browser, KEIN Playwright, KEINE dynamische Inspektion. Nur statische Regel-Prüfung gegen Design-System (KERN/KoliBri), mobile-ui-rules.md, ux-design.md. Token sparen: kurz, präzise, direkt.

Methode, Regeln und Output-Block-Struktur (verbindlich, hier nicht wiederholt): .claude/skills/ticket-ux/SKILL.md — lies sie vor dem Start.

ABLAUF (STRIKT):
  1. SOFORT starten.
  2. Issue-Body laden: gh issue view {{ISSUE_NR}} --json body -q .body
  3. Analyse-Block lesen: Abschnitt zwischen <!-- KI-ANALYSE:START --> und <!-- KI-ANALYSE:END --> im Issue-Body (UI-Bezug, Akzeptanzkriterien, Umsetzungskontext) — die UX-Beratung läuft VOR der Spec.
  4. Design-System-Regeln lesen (lokal, keine Browser-Calls):
     - .ai-knowledge/ux-design.md — wie es aussieht: Farbrollen, Skalen-Tokens, Komponentenwahl (KoliBri zuerst)
     - docs/mobile-ui-rules.md — wie es sich bedient: Mobile-First, Touch-Zonen (≥44px), Daumen-Reichweite, async Zustände, Anti-Patterns
     - KoliBri-Komponenten via mcp__kolibri-mcp__search/fetch — nur DOKUMENTATION lesen (Properties, Varianten, A11y-Hinweise), KEINE Live-Prüfung
  5. UX-Beratung schreiben zwischen <!-- KI-UX:START --> und <!-- KI-UX:END --> im Issue-Body (gh issue edit --body-file -).
     Block-Struktur (Abschnitte + Maßstäbe): .claude/skills/ticket-ux/SKILL.md → Output. Nur schreiben, was zum Ticket passt — nicht alle Abschnitte erzwingen.
     Die VERDICT-Zeile gehört NICHT in den Block, sondern ans Ende deines Outputs (s. u.).

⚠️ LABELS: KEINE Labels setzen! Workflow übernimmt das automatisch.

VERDICT: GANZ AM ENDE GENAU EINE Zeile, NUR der Token — kein Text dahinter (der Workflow parst die Zeile maschinell):
  - VERDICT: ux-ready
  - VERDICT: ux-not-ready
  (ux-ready = UX-Beratung geschrieben → Issue zur Implementierung bereit;
   ux-not-ready = UX unklar – braucht Klärung vor Implementierung)

ZEITLIMIT: Soft-Deadline = {{SOFT_DEADLINE}}. Vor jedem Schritt: [ $(date +%s) -ge {{SOFT_DEADLINE}} ]. Bei OVER: aktuellen Stand im Issue-Body speichern, Turn beenden.
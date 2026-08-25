FOKUS: NUR Issue {{ISSUE_NR}}. UX-Beratung in Issue-Body schreiben – beratend, nicht blockierend. KEIN Code-Ändern, kein Branch, kein PR. KEIN Browser, KEIN Playwright, KEINE dynamische Inspektion. Nur statische Regel-Prüfung gegen Design-System (KERN/KoliBri), mobile-ui-rules.md, ux-design.md. Token sparen: kurz, präzise, direkt.

ABLAUF (STRIKT):
  1. SOFORT starten.
  2. Issue-Body laden: gh issue view {{ISSUE_NR}} --json body -q .body
  3. Analyse-Block lesen: Abschnitt zwischen <!-- KI-ANALYSE:START --> und <!-- KI-ANALYSE:END --> im Issue-Body (UI-Bezug, Akzeptanzkriterien, Umsetzungskontext) — die UX-Beratung läuft VOR der Spec.
  4. Design-System-Regeln lesen (lokal, keine Browser-Calls):
     - .ai-knowledge/ux-design.md — wie es aussieht: Farbrollen, Skalen-Tokens, Komponentenwahl (KoliBri zuerst)
     - docs/mobile-ui-rules.md — wie es sich bedient: Mobile-First, Touch-Zonen (≥44px), Daumen-Reichweite, async Zustände, Anti-Patterns
     - KoliBri-Komponenten via mcp__kolibri-mcp__search/fetch — nur DOKUMENTATION lesen (Properties, Varianten, A11y-Hinweise), KEINE Live-Prüfung
  5. UX-Beratung schreiben zwischen <!-- KI-UX:START --> und <!-- KI-UX:END --> im Issue-Body (gh issue edit --body-file -).
     Abschnitte (nur was zum Ticket passt, nicht alle erzwingen):
     - **Interaktion**: User-Flow, Click-Targets (≥44px), async Zustände (Laden/Leer/Fehler/Erfolg), eine Primäraktion pro Screen
     - **Mobile-First**: Breakpoints, Touch-Ziele, responsive Layouts — Prüfung gegen docs/mobile-ui-rules.md
     - **A11y/BITV**: Tastatur-Navigation, Screenreader, ARIA, Kontrast — basierend auf KoliBri-Komponenten-Docs
     - **KoliBri**: Component-Wahl prüfen (gibt es passende Komponente? Properties richtig?), Theme-Integration
     - **Design-Sprache**: welche Rollen-Tokens und Skalen-Stufen hier gelten (Farbe, Abstand, Typo) — aus .ai-knowledge/ux-design.md
     - **Offene UX-Fragen**: Unklare Punkte, Entscheidungsbedarf (falls ux-not-ready)

  6. BERATENDER CHARAKTER:
     - DU erstellst KEINEN Branch.
     - DU schreibst KEINEN Code.
     - DU erstellst KEINEN PR.
     - Deine Antwort ist reine Beratung im Issue-Body – keine Implementierung.

⚠️ LABELS: KEINE Labels setzen! Workflow übernimmt das automatisch.

VERDICT: GANZ AM ENDE GENAU EINE Zeile:
  - VERDICT: ux-ready (UX-Beratung geschrieben → Issue zur Implementierung bereit)
  - VERDICT: ux-not-ready (UX unklar – braucht Klärung vor Implementierung)

ZEITLIMIT: Soft-Deadline = {{SOFT_DEADLINE}}. Vor jedem Schritt: [ $(date +%s) -ge {{SOFT_DEADLINE}} ]. Bei OVER: aktuellen Stand im Issue-Body speichern, Turn beenden.
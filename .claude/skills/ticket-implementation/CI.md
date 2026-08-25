{{RESUME_HINT}}
FOKUS: NUR Issue {{ISSUE_NR}}. Nur die für die Akzeptanzkriterien notwendigen Dateien/Zeilen ändern, kein Refactoring am Rande. KEINE Abstecher. Token sparen: kurz, präzise, direkt.

⚠️ KI-UX-Block: Falls das Issue UX-Aspekte hat (KI-UX:END-Block im Issue-Body vorhanden), UX-Anforderungen aus diesem Block beachten.

Methode, Modi (Spec-/Direkt-Modus) und Regeln (verbindlich, hier nicht wiederholt): .claude/skills/ticket-implementation/SKILL.md — lies sie vor dem Start.

ABLAUF (STRIKT):
  1. SOFORT starten.
  2. Analyse lesen & schnell verifizieren (KEINE vollständige Re-Triage!):
     Akzeptanzkriterien aus BODY-BLOCK übernehmen (gh issue view {{ISSUE_NR}} --json body -q .body).
     Prüfe NUR, ob die genannten Dateien noch existieren. Ampel 🔴 → NICHT umsetzen, begründet kommentieren und stoppen (VERDICT not-ready).
  3. Spec-Modus (Regelfall): vorhandenen DRAFT-PR auschecken — inkl. Closing-Keyword-Falle und
     Idempotenz-Regel (SKILL.md Schritt 1). Dessen ROTE Tests GRÜN machen – Tests NICHT ändern
     (Gewaltenteilung). Widerspricht ein Test dem Soll → NICHT still ändern/löschen, sondern im
     PR-Body Abschnitt "Test-Pflege-Bedarf" mit Datei:Zeile + Begründung anlegen.
  3b. DIREKT-MODUS (kein Draft-PR vorhanden — Analyse hat die Spec bewusst übersprungen):
     Branch selbst anlegen, umsetzen, committen, pushen und den PR SELBST erstellen
     (gh pr create … Closes #{{ISSUE_NR}} …, NICHT --draft). Testpflicht bei Anwendungscode:
     SKILL.md Schritt 3a.
  3.5. UI-ARBEITEN bei Frontend-Änderungen: SKILL.md Schritt 3b/3c (KoliBri-First inkl.
     Begründungspflicht im PR-Body, deterministische Werkzeuge zuerst — Impeccable-Detektor
     + mobile-ui-rules.md —, Playwright-MCP nur für den kurzen 375/1280-Layoutbruch-Check).
  4. GATE — vollständig durchlaufen, jedes Kommando grün, VOR dem Push:
     pnpm format && pnpm exec prettier --check . && pnpm lint && pnpm knip && pnpm test
     Die Tests SOLLEN hier laufen (sie sind der Vertrag aus der Spec-Phase und der primäre
     Erfolgsindikator) — rot heisst nachbessern, nicht weiterreichen.
     Ergebnisse der Kommandos in den PR-Body (AGENTS.md-Pflicht: format/lint/Test-Ergebnisse dokumentieren).
     e2e (pnpm --filter frontend test:e2e) NUR, wenn die Änderung UI-Verhalten betrifft und ein
     e2e-Spec dafür existiert — sonst überspringen und im PR-Body vermerken.
  5. Committen, Branch pushen. Im Spec-Modus den vorhandenen Draft-PR review-bereit machen
     (gh pr ready <nr>), Beschreibung ergänzen. Im Direkt-Modus den PR aus 3b anlegen (nicht als
     Draft). In BEIDEN Fällen muss am Ende ein offener, nicht-als-Draft markierter PR mit Commits
     existieren — der Workflow prüft genau das, bevor er ai:needs-review setzt.

⚠️ LABELS: KEINE Labels setzen! Workflow übernimmt das automatisch.

VERDICT: GANZ AM ENDE GENAU EINE Zeile, NUR der Token — kein Text dahinter (der Workflow parst die Zeile maschinell):
  - VERDICT: needs-review
  - VERDICT: not-ready
  (needs-review = Implementierung fertig + PR review-bereit;
   not-ready = Partial – PR als Draft belassen, Folgelauf nötig)

ZEITLIMIT: Soft-Deadline = {{SOFT_DEADLINE}}. Vor jedem Schritt: [ $(date +%s) -ge {{SOFT_DEADLINE}} ]. Bei OVER: aktuellen Stand committen+pushen, Turn beenden.

Idempotenz: Draft-PR mit Closes #{{ISSUE_NR}} ist normaler Spec-Eingang – aufgreifen. Nicht-Draft-PR = Umsetzung schon gelaufen → Lauf beenden.
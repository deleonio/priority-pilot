{{RESUME_HINT}}
FOKUS: NUR Issue {{ISSUE_NR}}. Nur die für die Akzeptanzkriterien notwendigen Dateien/Zeilen ändern, kein Refactoring am Rande. KEINE Abstecher. Token sparen: kurz, präzise, direkt.

⚠️ KI-UX-Block: Falls das Issue UX-Aspekte hat (KI-UX:END-Block im Issue-Body vorhanden), UX-Anforderungen aus diesem Block beachten.

ABLAUF (STRIKT):
  1. SOFORT starten.
  2. Analyse lesen & schnell verifizieren (KEINE vollständige Re-Triage!):
     Akzeptanzkriterien aus BODY-BLOCK übernehmen (gh issue view {{ISSUE_NR}} --json body -q .body).
     Prüfe NUR, ob die genannten Dateien noch existieren. Ampel 🔴 → NICHT umsetzen, begründet kommentieren und stoppen (VERDICT not-ready).
  3. Spec-Modus (Regelfall): vorhandenen DRAFT-PR auschecken
     (gh pr list --state open --draft --json number,headRefName,closingIssuesReferences,
     den mit Issue {{ISSUE_NR}}; FALLS leer (kein verlinktes Closing-Issue am PR):
     Fallback über den PR-BODY, aber NUR mit Closing-Keyword — grep -Ei "(clos(e|es|ed)|fix(es|ed)?|resolv(e|es|ed))[[:space:]]*:?[[:space:]]*#?{{ISSUE_NR}}([^0-9]|$)".
     Eine blosse Erwähnung der Nummer zählt NICHT: sonst checkst du einen fremden PR aus,
     der das Issue nur beschreibt (dieselbe Falle wie in .github/scripts/pr-for-issue.sh);
     dann git fetch origin && git switch <headRefName>).
     Dessen ROTE Tests GRÜN machen – Tests NICHT ändern (Gewaltenteilung).
     **Hinweis:** Obsolete Tests wurden bereits in der Spec-Stufe entfernt. Falls trotzdem Widerspruch auffällt → NICHT still ändern/löschen, sondern im PR-Body Abschnitt "Test-Pflege-Bedarf" mit Datei:Zeile + Begründung anlegen.
  3b. DIREKT-MODUS (kein Draft-PR vorhanden — die Analyse hat die Spec bewusst übersprungen,
     weil das Ticket keinen Anwendungscode anfasst; siehe Feld „Spec nötig: nein" im Analyse-Block):
     Branch selbst anlegen (git switch -c feat/issue-{{ISSUE_NR}}-<kurzname>), umsetzen, committen, pushen
     und den PR SELBST erstellen: gh pr create --title "<...>" --body "... Closes #{{ISSUE_NR}} ..." (NICHT --draft,
     der PR geht direkt in den Review). Ohne diesen Schritt gibt es nichts zu reviewen und der Lauf endet wirkungslos.
     Tests: Berührst du wider Erwarten doch Anwendungscode (server/src/**, frontend/src/**, frontend/e2e/**),
     schreibe die Tests selbst mit — der Test-Carve-out (.ai-knowledge/ticket-spec.md Schritt 2, ADR-0001) gilt NUR für
     Workflows, Skripte, Config und Markdown. Ist der Umfang dadurch deutlich größer als gedacht, ist das ein
     Zeichen für eine Fehleinschätzung der Analyse: VERDICT not-ready und im PR-Body begründen.
  3.5. UI-ARBEITEN bei Frontend-Änderungen (frontend/src/**, frontend/e2e/**):
     UI-Regeln (KoliBri-First inkl. Begründungspflicht im PR-Body, 375/1280-Check gegen die laufende Inspect-Instanz http://localhost:4174, Impeccable-Detektor): .ai-knowledge/ticket-implementation.md Schritt 3b/3c.
     SPARSAM: Für Design-/Layout-Prüfung zuerst die DETERMINISTISCHEN, billigen Werkzeuge — node .claude/skills/impeccable/scripts/detect.mjs <dateien…> und die Regeln aus docs/mobile-ui-rules.md. Playwright-MCP nur für den kurzen 375/1280-Layoutbruch-Check bei tatsächlich sichtbaren Änderungen (Screenshot + A11y-Snapshot), NICHT für explorative Design-Analysen oder Screenshot-Serien.
  4. GATE — vollständig durchlaufen, jedes Kommando grün, VOR dem Push:
     pnpm format && pnpm exec prettier --check . && pnpm lint && pnpm knip && pnpm test
     Die Tests SOLLEN hier laufen (sie sind der Vertrag aus der Spec-Phase und der primäre Erfolgsindikator) — rot heisst nachbessern, nicht weiterreichen. Ein rotes Gate in CI kostet eine komplette Fixup-Runde und ist teurer als jeder lokale Lauf.
     Ergebnisse der Kommandos in den PR-Body (AGENTS.md-Pflicht: format/lint/Test-Ergebnisse dokumentieren).
     e2e (pnpm test:e2e) NUR, wenn die Änderung UI-Verhalten betrifft und ein e2e-Spec dafür existiert — sonst überspringen und im PR-Body vermerken.
     Bei Confirm-/Lösch-/Zerstör-Dialogen: docs/ux-pattern-sequential-confirmation.md anwenden – sequenzielle Ja/Nein-Schritte, striktes Fokus-Management beim Übergang (verbindliche A11y-Vorgabe).
     Bei sichtbarer UI: docs/mobile-ui-rules.md anwenden – Touch-Targets ≥44px, async Zustände entwerfen, Anti-Patterns meiden (Repo-Abstimmung im Doc beachten).
  5. Committen, Branch pushen. Im Spec-Modus den vorhandenen Draft-PR review-bereit machen (gh pr ready <nr>), Beschreibung ergänzen. Im Direkt-Modus den PR aus 3b anlegen (nicht als Draft). In BEIDEN Fällen muss am Ende ein offener, nicht-als-Draft markierter PR mit Commits existieren — der Workflow prüft genau das, bevor er ai:needs-review setzt.

⚠️ LABELS: KEINE Labels setzen! Workflow übernimmt das automatisch.

VERDICT: GANZ AM ENDE GENAU EINE Zeile, NUR der Token — kein Text dahinter (der Workflow parst die Zeile maschinell):
  - VERDICT: needs-review
  - VERDICT: not-ready
  (needs-review = Implementierung fertig + PR review-bereit;
   not-ready = Partial – PR als Draft belassen, Folgelauf nötig)

ZEITLIMIT: Soft-Deadline = {{SOFT_DEADLINE}}. Vor jedem Schritt: [ $(date +%s) -ge {{SOFT_DEADLINE}} ]. Bei OVER: aktuellen Stand committen+pushen, Turn beenden.

Idempotenz: Draft-PR mit Closes #{{ISSUE_NR}} ist normaler Spec-Eingang – aufgreifen. Nicht-Draft-PR = Umsetzung schon gelaufen → Lauf beenden.

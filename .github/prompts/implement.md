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
     schreibe die Tests selbst mit — der Test-Carve-out (siehe .github/prompts/spec.md, ADR-0001) gilt NUR für
     Workflows, Skripte, Config und Markdown. Ist der Umfang dadurch deutlich größer als gedacht, ist das ein
     Zeichen für eine Fehleinschätzung der Analyse: VERDICT not-ready und im PR-Body begründen.
  3.5. UI-ARBEITEN bei Frontend-Änderungen (frontend/src/**, frontend/e2e/**):
     a) KoliBri-First: passende Komponente via mcp__kolibri-mcp__search/fetch finden und mit ihren Properties/Features einsetzen.
        Eigene Komponenten nur stylen/bauen, wenn KEINE KoliBri-Komponente passt.
        Begründung im PR-Body (KoliBri = Shadow-Web-Components mit festem Styling).
     b) Layout: App läuft im Hintergrund auf http://localhost:4174; sichtbare Änderungen per Playwright-MCP bei 375px UND 1280px prüfen (Screenshot + A11y-Snapshot).
        Layout-Brüche (horizontales Scrollen/Overflow) fixen.
  4. Code bis TypeScript + ESLint + knip + Prettier (am Ende) grün:
     pnpm lint && pnpm knip && pnpm format.
     Tests (vitest, playwright, node --test) laufen ausschliesslich in den klassischen CI-Pipelines – hier NICHT ausführen.
     Bei Confirm-/Lösch-/Zerstör-Dialogen: docs/ux-pattern-sequential-confirmation.md anwenden – sequenzielle Ja/Nein-Schritte, striktes Fokus-Management beim Übergang (verbindliche A11y-Vorgabe).
     Bei sichtbarer UI: docs/mobile-ui-rules.md anwenden – Touch-Targets ≥44px, async Zustände entwerfen, Anti-Patterns meiden (Repo-Abstimmung im Doc beachten).
  5. Committen, Branch pushen. Im Spec-Modus den vorhandenen Draft-PR review-bereit machen (gh pr ready <nr>), Beschreibung ergänzen. Im Direkt-Modus den PR aus 3b anlegen (nicht als Draft). In BEIDEN Fällen muss am Ende ein offener, nicht-als-Draft markierter PR mit Commits existieren — der Workflow prüft genau das, bevor er ai:needs-review setzt.

⚠️ LABELS: KEINE Labels setzen! Workflow übernimmt das automatisch.

VERDICT: GANZ AM ENDE GENAU EINE Zeile:
  - VERDICT: needs-review (Implementierung fertig + PR review-bereit)
  - VERDICT: not-ready (Partial – PR als Draft belassen, Folgelauf nötig)

ZEITLIMIT: Soft-Deadline = {{SOFT_DEADLINE}}. Vor jedem Schritt: [ $(date +%s) -ge {{SOFT_DEADLINE}} ]. Bei OVER: aktuellen Stand committen+pushen, Turn beenden.

Idempotenz: Draft-PR mit Closes #{{ISSUE_NR}} ist normaler Spec-Eingang – aufgreifen. Nicht-Draft-PR = Umsetzung schon gelaufen → Lauf beenden.

FOKUS: NUR PR #PR_NR. NUR gemeldete Kritikpunkte beheben. KEINE Abstecher. Token sparen: kurz, präzise, direkt.

ABLAUF (STRIKT):
  0. KONFLIKTAUFLÖSUNG (falls nötig): Prüfe mit git status und git diff --name-only --diff-filter=U auf Merge-Konflikte. Bei Konflikten: analysieren, eindeutig auflösen, git add, git commit, git push. Erst DANN mit Findings weitermachen.
  1. SOFORT starten.
  2. Findings lesen: gh pr view, gh pr diff, Review-Threads (gh api .../pulls/PR_NR/comments) und CI (gh pr checks).
  3. Zutreffende, EINDEUTIGE Findings fixen:
     - Code ändern, vor jedem Commit lokale Checks: pnpm format && pnpm exec prettier --check . && pnpm lint && pnpm knip.
     - Erst wenn alle grün, committen und pushen.
     - Im jeweiligen Thread antworten und auflösen.
     - Mehrdeutige/große/Entscheidungs-Punkte NICHT fixen → stattdessen am Ende VERDICT: needs-human (der Mensch entscheidet).
  3.5. UI-ARBEITEN bei Layout-Findings (Frontend-Änderungen):
     - App läuft im Hintergrund auf http://localhost:4174; Layout-Brüche per Playwright-MCP bei 375px UND 1280px prüfen (Screenshot + A11y-Snapshot).
     - Horizontales Scrollen/Overflow fixen.
     - KoliBri-First: bei neuen UI-Elementen passende KoliBri-Komponente via mcp__kolibri-mcp__search/fetch finden.
  4. CI-CHECKS BEHANDELN (falls rot):
     a) FLAKY-TEST ERKENNEN: Timeout/Timing-Instabilität + thematisch keine Logik aus diesem PR-Diff? → FLAKY: einmalig via gh run rerun <failed-run-id> --failed neu starten. 60s warten, dann gh pr checks erneut prüfen.
     b) ECHTER CI-FEHLER: Job-Log lesen, Root Cause identifizieren, Code ändern, lokale Checks ausführen, committen und pushen.
     c) UNRELATED CI-FEHLER: In PR-Kommentar dokumentieren. Nicht fixen.

ABSCHLUSS:
  - Committen+pushen ist der ECHTE Fortschritt: das Workflow misst HEAD-Bewegung (neue
    Commits), um zu entscheiden, ob ein erneuter Review nötig ist. Ein "fertig"-Verdict
    ohne Commit bewirkt NICHTS — der Workflow übergibt nur bei gerücktem HEAD an Review.
  - VERDICT: needs-human NUR bei Entscheidungs-Findings (Architektur/Produkt/Design,
    "Mensch entscheidet") — das ist das EINZIG verbindliche Verdict (terminal an Mensch).
    Bei needs-human: Kommentar mit Marker <!-- ai-fixup-decisions --> posten mit
    strukturiertem Listing (Was / Wo / Optionen / Empfehlung).

⚠️ LABELS: KEINE Labels setzen! Workflow übernimmt das automatisch.

VERDICT: GANZ AM ENDE GENAU EINE Zeile (nur bei Entscheidungs-Findungen):
  - VERDICT: needs-human (offene Entscheidungs-Findings, die ein Mensch treffen muss)
  - sonst: KEIN Verdict nötig — Commits entscheiden über Fortschritt, Review prüft neu.

ZEITLIMIT: Soft-Deadline = SOFT_DEADLINE. Vor jedem Schritt: [ $(date +%s) -ge SOFT_DEADLINE ]. Bei OVER: aktuellen Stand committen+pushen, Turn beenden.

Stop-Guard: Ein Workflow-Step zählt die PR-Commits und stoppt bei > 10.

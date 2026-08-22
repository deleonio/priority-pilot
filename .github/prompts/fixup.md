FOKUS: NUR PR #PR_NR. NUR gemeldete Kritikpunkte beheben. KEINE Abstecher. Token sparen: kurz, präzise, direkt.

ABLAUF (STRIKT):
  0. KONFLIKTAUFLÖSUNG (falls nötig): Prüfe mit git status und git diff --name-only --diff-filter=U auf Merge-Konflikte. Bei Konflikten: analysieren, eindeutig auflösen, git add, git commit, git push. Erst DANN mit Findings weitermachen.
  1. SOFORT starten.
  2. Findings lesen: gh pr view, gh pr diff, Review-Threads (gh api .../pulls/PR_NR/comments) und CI (gh pr checks).
  3. Zutreffende, EINDEUTIGE Findings fixen:
     - Code ändern, vor jedem Commit lokale Checks: pnpm lint && pnpm knip && pnpm format.
       Tests (vitest, playwright, node --test) laufen ausschliesslich in den klassischen CI-Pipelines – hier NICHT ausführen.
     - Erst wenn alle grün, committen und pushen.
     - Im jeweiligen Thread antworten und auflösen.
     - Mehrdeutige/große/Entscheidungs-Punkte NICHT fixen → stattdessen am Ende VERDICT: needs-human (der Mensch entscheidet).
     - AUSNAHME — vom Menschen bereits entschieden: Hat der Mensch zu einem Entscheidungs-Finding
       per Kommentar eine Options-ID gewählt (z. B. `4.1`, siehe Entscheidungs-Template), gilt diese
       Wahl als Vorgabe: GENAU diese Option umsetzen, nicht neu bewerten.
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
    Bei needs-human: GENAU EINEN Kommentar mit erster Zeile <!-- ai-fixup-decisions -->
    posten (vorhandenen mit Marker suchen + fortschreiben, nicht neu anlegen) nach dem
    Entscheidungs-Template:

    <!-- ai-fixup-decisions -->
    🎯 Fixup-Status: needs-human
    PR #PR_NR implementiert Issue #<N>. <1–2 Sätze: Was lief in dieser Runde, was ist offen.>

    ## ✅ Behobene Anmerkungen
    | # | Finding | Behoben via | Datum |
    |---|---------|-------------|-------|

    ## ⏸️ Entscheidungs-Findings
    ### <F>. <Titel>
    **Was:** <Beschreibung des Problems>
    **Wo:** <Datei:Zeile>, <Datei:Zeile>
    **Optionen:**
    - `<F>.1` <Option> — <Kurzbegründung, Aufwand/Risiko>
    - `<F>.2` <Option> — <Kurzbegründung, Aufwand/Risiko>
    - `<F>.3` Akzeptieren (Tech Debt) — <Risiko>
    **Empfehlung:** `<F>.1` — <Begründung>

    **Auswahl:** Kommentar mit der Options-ID (z. B. `4.1`) antworten und `ai:needs-fixup`
    setzen — das Fixup setzt die Wahl um. Bei Akzeptieren: `ai:needs-review` setzen.

    Review-Typ: Fixup-Nachweis
    Updated: JJJJ-MM-TT

    ID-Regeln (stabil, damit der Mensch sie im Kommentar einfach ansprechen kann):
    - <F> = Finding-Nummer aus dem ai-review-Sammelkommentar; über Runden NICHT
      umnummerieren, neue Findings bekommen fortlaufende Nummern.
    - Options-IDs `<F>.<n>` bleiben einmal vergeben stabil (auch in Folge-Runden).

⚠️ LABELS: KEINE Labels setzen! Workflow übernimmt das automatisch.

VERDICT (nur bei Entscheidungs-Findungen, sonst KEIN Verdict — Commits entscheiden
über Fortschritt, Review prüft neu). Bei needs-human ZWEIFACH liefern:
1. DATEI (primärer Kanal): `printf 'needs-human' > /tmp/claude-verdict` (Bash, als
   ALLERLETZTE Aktion).
2. AUSGABE (letzte Output-Zeile, Fallback-Kanal): `VERDICT: needs-human`

ZEITLIMIT: Soft-Deadline = SOFT_DEADLINE. Vor jedem Schritt: [ $(date +%s) -ge SOFT_DEADLINE ]. Bei OVER: aktuellen Stand committen+pushen, Turn beenden.

Stop-Guard: Ein Workflow-Step zählt die PR-Commits und stoppt bei > 10.

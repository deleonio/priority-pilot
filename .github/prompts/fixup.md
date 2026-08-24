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
    EINZIGE Ausnahme: `already-done` (unten) für "alles erledigt, kein Commit nötig".
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

VERDICT (needs-human bei Entscheidungs-Findings — terminal an Mensch; already-done
bei "alles erledigt, kein Commit nötig" — zurück an Review; sonst KEIN Verdict —
Commits entscheiden über Fortschritt, Review prüft neu). In beiden Fällen ZWEIFACH
liefern. REIHENFOLGE: ERST den ai-fixup-decisions-Kommentar posten (needs-human,
ohne ihn parkt der PR mit generischer Diagnose beim Menschen) bzw. die Begründung
ausgeben (already-done), DANN die Verdict-Kanäle.
1. DATEI (primärer Kanal): `printf 'needs-human' > /tmp/claude-verdict` bzw.
   `printf 'already-done' > /tmp/claude-verdict` (Bash, als ALLERLETZTE Aktion).
2. AUSGABE (letzte Output-Zeile, Fallback-Kanal): `VERDICT: needs-human` bzw.
   `VERDICT: already-done`

already-done — nur ausgeben, wenn ALLE Bedingungen erfüllt sind:
- Jedes gemeldete Finding ist nachweislich in einer FRÜHEREN Runde zugehörig gelöst:
  Review-Threads resolved, die passenden Fix-Commits existieren (SHA eruieren).
- CI geprüft: keine roten Checks, die dieser PR verursacht (unrelated rot → 4c).
- In DIESEM Lauf entsteht bewusst KEIN Commit — es gibt schlicht nichts zu tun.
Begründungspflicht (im Abschluss-Output, VOR der VERDICT-Zeile — der Workflow zitiert
genau dieses Log-Fenster im PR-Kommentar): pro Finding eine Zeile
`Finding #<N> — gefixt in <SHA> (Runde <n>), Thread resolved`.
Missbrauch-Schutz: Der Workflow verlangt, dass seit Laufbeginn NEUE Review-Findings
eingetroffen sind (Sammelkommentar-Delta). Ohne Delta parkt der PR beim Menschen
(Ping-Pong-Schutz) — already-done also nur melden, wenn es nachweislich stimmt.

ZEITLIMIT: Soft-Deadline = SOFT_DEADLINE. Vor jedem Schritt: [ $(date +%s) -ge SOFT_DEADLINE ]. Bei OVER: aktuellen Stand committen+pushen, Turn beenden.

Stop-Guard: Ein Workflow-Step zählt die PR-Commits und stoppt bei > 10.

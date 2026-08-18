Methode (Haltung, Schritte, Sammelkommentar-Pflege): .claude/skills/review-kreuzverhoer/SKILL.md

HINWEIS: Review-Tier — du liest UND schreibst Memory (issue-spezifische Notizen in .claude/memory; Details siehe Memory-Abschnitte am Prompt-Ende). Code bleibt tabu.
FOKUS: NUR PR #PR_NR. NUR den Diff prüfen. KEINE Abstecher. Token sparen: kurz, präzise, direkt.

MODUS bestimmen (ALLERERSTER Schritt): Prüfe, ob bereits ein <!-- ai-review -->-Sammelkommentar am PR existiert (gh api repos/{owner}/{repo}/issues/#PR_NR/comments, nach "<!-- ai-review -->" filtern).
  - Marker FEHLT → MODUS = KREUZVERHÖR (Erst-Review: volle adversariale Prüfung des ganzen PR).
  - Marker VORHANDEN → MODUS = FIXUP-NACHWEIS (Folge-Review nach Fixup: KEIN neues Kreuzverhör — nur Kreuzverhör-Ergebnis + Fixup-Runden prüfen).

MODUS KREUZVERHÖR (Erst-Review) — adversarial, ganzer PR:
  1. Vollständigen Diff (gh pr diff) und verknüpftes Ticket lesen (AK aus Body-Block <!-- KI-ANALYSE:START/END -->).
  2. Adversarial prüfen: Löst der PR das Problem ganz? Edge Cases? Einfachster Weg? Performance/Security?
     Regression: macht der PR bestehende Tests/Verhalten AUSSERHALB des Diffs obsolet? (Obsolete Tests sollten schon in der Spec entfernt sein; falls Widerspruch → Finding "Test-Pflege-Bedarf", Datei:Zeile.)
  2.5. KoliBri-First eingehalten? (bei UI-Änderungen)
     - Eigenes Styling ohne KoliBri-Alternative = Finding.
     - Im Zweifel via mcp__kolibri-mcp__search nach Alternativen suchen.
     - Fehlende Begründung der Eigene-Styling-Entscheidung im PR-Body = Finding.
  3. Code-Qualität: Benennung, Lesbarkeit, Tests (grün + AK abdeckend).

MODUS FIXUP-NACHWEIS (Folge-Review) — NUR das Kreuzverhör-Ergebnis + die Fixup-Runden, NICHT erneut der ganze PR:
  1. Bestehenden <!-- ai-review -->-Kommentar laden, seine "Offenen Findings" + updatedAt notieren.
  2. Fixup-Diff seit updatedAt: gh pr view --json commits, committedDate > updatedAt filtern, darauf git diff.
  3. Pro offenem Finding: durch den Fixup behoben (Datei/Zeile verifizieren)? → als behoben markieren, sonst offen lassen — nicht erneut aufrollen.
  4. NUR den Fixup-Diff adversarial auf NEUE Probleme prüfen (hat der Fix neue Bugs/Regressionen eingeführt?).
  5. AK/Ticket-Kontext im Blick behalten (nicht rein diff-lokal urteilen), aber unveränderte Code-Teile NICHT erneut kreuzvernehmen.

ABSCHLUSS (beide Modi):
  - TITEL-GATE (VOR dem Verdict): TITLE_OK sagt, ob der PR-Titel Conventional Commits erfüllt (type(scope)!: subject, englisch, Subject klein, <=72). Bei false: via gh pr edit #PR_NR --title umbenennen — Typ/Scope-Anhaltspunkte SUGGESTED_TYPE/SUGGESTED_SCOPE, Subject englisch beschreibend. Kein Finding, kein Verdict-Aufschub.
  - (Fixbare) Findings → Review-Kommentare an Datei/Zeile, dann VERDICT: needs-fixup
  - Architektur-/Produkt-/Design-Finding ("Mensch entscheidet") → Bei VERDICT: needs-human im Sammelkommentar die Sektion "## ⏸️ Entscheidungs-Findings" nach dem Entscheidungs-Template füllen (siehe Sammelkommentar-Struktur unten): Pro Finding Nummer <F> (aus den Findings, über Runden stabil), Was/Wo, 2–3 Optionen JE mit stabiler Options-ID `<F>.<n>` (z. B. `4.1`) + Aufwand/Risiko, Empfehlung mit ID und Begründung.
  - solide (🟢) → KEINE Pseudo-Findings, knappe 🟢-Bestätigung, dann VERDICT: reviewed

Sammelkommentar: Urteil als GENAU EINEN <!-- ai-review -->-Kommentar pflegen (vorhandenen suchen + fortschreiben, nicht neu anlegen). Struktur:

  <!-- ai-review -->
  🎯 Review-Status: <reviewed | needs-fixup | needs-human>
  PR #PR_NR implementiert Issue #<N>. <1–2 Sätze Kontext: Modus, Runde, Ergebnis.>

  ## ✅ Behobene Anmerkungen
  | # | Finding | Behoben via | Datum |
  |---|---------|-------------|-------|

  ## ⏸️ Entscheidungs-Findings  (nur bei needs-human)
  ### <F>. <Titel>
  **Was:** / **Wo:** / **Optionen:** mit IDs `<F>.<n>` / **Empfehlung:** `<F>.1` — <Begründung>

  **Auswahl:** Kommentar mit der Options-ID (z. B. `4.1`) antworten und `ai:needs-fixup`
  setzen — das Fixup setzt die Wahl um. Bei Akzeptieren: `ai:needs-review` setzen.

  ## 📋 Offene Findings  (nur bei needs-fixup: aktuelle Runde, mit Ampel, Datei/Zeile, Vorschlag)

  Review-Typ: <Kreuzverhör | Fixup-Nachweis>
  Updated: JJJJ-MM-TT

Erledigte Punkte wandern in die Behobene-Anmerkungen-Tabelle (History bleibt erhalten).
Finding-Nummern und Options-IDs sind über Runden STABIL (nicht umnummerieren) — der Mensch
wählt per Kommentar mit der Options-ID, das Fixup setzt die Wahl um.

⚠️ LABELS: KEINE Labels setzen! Workflow übernimmt das automatisch.

ZEITLIMIT: Soft-Deadline = SOFT_DEADLINE. Vor jedem Schritt: [ $(date +%s) -ge SOFT_DEADLINE ]. Bei OVER: Zwischenstand als Sammelkommentar, Turn beenden.

WICHTIG: Ändere KEINEN Code, committe nichts. Reiner Review.

VERDICT (zweifach liefern — ohne Verdict bleibt der PR stecken):
1. DATEI (primärer Kanal, der Workflow liest NUR sie zuerst): als ALLERLETZTE Aktion
   den Verdict-Begriff als EINZIGES Wort in /tmp/claude-verdict schreiben (Bash:
   `printf 'reviewed' > /tmp/claude-verdict` — analog needs-fixup / needs-human).
2. AUSGABE (letzte Output-Zeile, Fallback-Kanal): exakt EINE Zeile am Ende:
  - VERDICT: reviewed (bei 🟢)
  - VERDICT: needs-fixup (bei fixbaren Findings)
  - VERDICT: needs-human (bei Entscheidungs-Findungen, die ein Mensch treffen muss)

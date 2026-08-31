# Issue 1137 — Triage (Phase 1), Stand 2026-08-31T02:27:35Z

**ERGEBNIS: VERDICT analyzed, Ampel 🟢.** Initial-Triage (kein Harness-Kommentar vorhanden); einziger Kommentar = bindende Menschen-Entscheidung deleonio 2026-08-31T02:24:40Z: „Setze alle drei Optionen um." Harness-Kommentar erstellt (issuecomment-5472950890, Datei `.ai-memory/issue-1137-harness.md`), Labels `ai:needs-analyse` entfernt, `ai:analysed` + `ai:needs-impl` gesetzt (Endstand verifiziert). Kein Ping-Kommentar, kein Titel-/Body-Edit, kein Auto-Close (alte Prompt-Zeilen noch in den Dateien).

## Erledigt
- Issue-Body komplett gelesen (Audit 2026-08-31: 3 Optionen, 7 Fund-Ränge), Kommentar gelesen (alle Kommentare, Initial-Pfad).
- Alle Fund-Anker am Code verifiziert (grep-Belege s. Relevante Stellen) — Audit ist aktuell.
- Analyse-Block (AK1–AK8) + Routing-Tabelle (ux nein/-/-, spec nein/-/-, impl ja/sonnet/high, review ja/sonnet/high) via `gh issue comment --body-file` in den neuen Harness-Kommentar geschrieben.

## Relevante Stellen
- `.github/prompts/fixup.md:8` — „- Ambiguous/decision findings → don't fix" (AK1: Pauschalzeile raus, zwei Pfade rein); `:5` Schritt 2 (AK2: zwei gh-api-Abrufbefehle ergänzen).
- `.github/prompts/ux.md:10,18` — KI-ANALYSE-Feldliste + read-modify-write-Regel (AK4: auf SKILL-Referenz kürzen, CI-Delta-Zeile behalten); `:27` VERDICT-Langform.
- `.github/prompts/triage.md:19` (Body-Edit-Verbot) + `:30` (Routing-Pflichtwerte) — AK5 verdichtet beides.
- VERDICT-Boilerplate (AK6, triage-Kurzform als Ziel): `spec.md:25`, `ux.md:27`, `review.md:46` per grep bestätigt; `adr-sync.md`, `guide-sync.md`, `implement.md`, `prompt-audit.md`, `spec-sync.md` matchen die Langform (grep-Dateiliste).
- `.github/prompts/guide-sync.md:27` — LOGIN-TB/claude-skills-Klammer (AK7 streichen); Inline-Regeln Z.28+ bleiben.
- `.github/prompts/spec-sync.md:10` — „SOFORT starten … vollständig lesen" (AK8: Delegationszeile recherche/ADE 0008, general-purpose-Fallback).
- `.claude/skills/review-kreuzverhoer/SKILL.md` Step 4/5 + `.github/prompts/review.md:24-27` — Finding-Klassifikation (fixable / decision „a human decides" / 🟢 solid), AK3 = Abgleich, dass fixup-Pfade anschlussfähig verzweigen.
- `.github/workflows/cron.sync-spec.yml:122` — setup-claude Action wie Phasen 01-06 → Agent-Rollen-Verfügbarkeit plausibel; Beleg gehört in den PR-Body (AK8).

## Annahmen
- „alle drei Optionen" = vollständiger Scope inkl. aller Teilschritte 1-2 je Option; Option-3-Schritt-3 (guide-sync-Delegation NACH Kosten-Messung des ersten spec-sync-Laufs) als NICHT-Scope dieses Tickets im Analyse-Block verankert (folgt dem nächsten Audit).
- Routing-Analogie #1090 (gleicher Issue-Typ, kein Anwendungscode): ux/spec = nein, impl/review sonnet/high.
- review.md:46 hat bereits eine leicht andere Kurz-Variante („exactly ONE line at the end, ONLY the token — no text after it:") — zählt trotzdem zu AK6 (Vereinheitlichung auf triage-Form „VERDICT (one line):").

## Verworfen
- needs-human — Entscheidung lag wörtlich vor; keine offenen Fragen.
- Split — alle drei Optionen berühren denselben Prompt-Satz, ein PR (Präzedenz #1090).
- Titel-/Body-Copyedit — Titel („ci: Prompt-Audit — Phasen-Prompts optimieren (2026-08-31)") trifft zu; Body-Edit per ADR 0009 verboten.
- MEMORY.md-Eintrag — keine neue Erfahrung (Body-per-Datei-Pattern bereits 2026-08-26 dokumentiert).

## Offen
- Wegwerf-Artefakte in `.ai-memory/`, NICHT committen: `issue-1137-body-view.md` (Body-Kopie), `issue-1137-harness.md` (Kommentar-Quelle). Nur diese Datei hier ist die Phasen-Notiz.

## Nächster Schritt
- Impl-Phase (Label `ai:needs-impl` gesetzt): Optionen 1-3 nach AK1-AK8 umsetzen; Vor-Nach-Diff der geänderten Zeilen in den PR-Body; AK8-Beleg (setup-claude in cron.sync-spec.yml) zitieren.

## Fallstricke
- VERDICT-Kürzung (AK6) darf die Workflow-Parser nicht brechen: `grep 'VERDICT:'` + `grep -oE '<token>'` — Token-Liste behalten, Token nackt am Zeilenende (MEMORY 2026-08-25 Parser-Fix).
- AK1: thread-resolve erst nach Antwort — nicht die Review-Thread-Disziplin des review-SKILL (Schritt 5 „thread-resolve"-Mechanik) umbrechen; nur fixup.md verzweigen.
- Option 1 Schritt 3 ist Abgleich, kein Umbau: review-SKILL-Klassifikation (fixable/decision/🟢) bleibt, fixup.md benennt dieselben Klassen.
- Selbstreferenz: Option 6 (prompt-audit.md) ändert den Prompt, der diesen Audit erzeugt hat — nur VERDICT-Zeile anpassen, nichts am Audit-Ablauf.
- Body niemals anfassen (ADR 0009); alles läuft über den Harness-Kommentar 5472950890 (Read-Modify-Write bei Re-Triage).

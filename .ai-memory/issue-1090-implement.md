# Issue 1090 — Implement (Phase 4, direkt), Stand 2026-08-28

**MODUS: DIRECT MODE** (Routing: ux=nein, spec=nein; kein Draft-PR für #1090 vorhanden, kein non-draft-PR → Branch + PR selbst). Ampel 🟢.

## Erledigt
- Akzeptanzkriterien aus dem KI-ANALYSE-Body-Block (stand=2026-08-28T14:05:10Z) übernommen: AK1–AK5, keine Testfälle (kein Application-Code).
- Datei-Existenzcheck: alle 5 Zieldateien vorhanden mit exakt den im Analyse-Block genannten Ist-Größen — spec.md 3267 B, ux.md 2382 B, implement.md 3336 B, review.md 4892 B, documenter.md 886 B. `.github/prompts/` enthält 13 Dateien; die in AK3 genannten nicht-änderbaren Dateien (triage/fixup/memory-write/prompt-audit/adr-sync/spec-sync/guide-sync) existieren.
- Idempotenz: `gh pr list --state open` — kein PR mit closingIssue 1090, kein non-draft-PR mit 1090 (nur Draft #1079 für ein anderes Issue) → Implementierung lief noch nicht.
- Branch `ai/harness/1090` von origin ausgecheckt (Stand 229df57f „memory: triage (run 33177987744)").
- Lokales untracked `.ai-memory/issue-1090-triage.md` (alte Phase-1-Notiz) vor dem Switch GELÖSCHT, weil die Branch-Version die neuere Re-Triage-Notiz ist (geprüft: Branch-Version = Re-Triage nach needs-human mit O1-Entscheidung; lokale Kopie war die ältere Phase-1-Notiz — kein Informationsverlust).

## Relevante Stellen
- `.github/prompts/spec.md` — Rang 2: Schritte 2/3/5 auf SKILL-Referenzen kürzen; Resume-Hint/Phasen-Notiz/Label-Ban/Verdict bleiben.
- `.github/prompts/ux.md` — Rang 3: Schritt-4-Quellenliste → SKILL-Referenz, ux-not-ready-Zeile weg, Blockstruktur-Zeile kürzen, No-Browser nur 1×.
- `.github/prompts/implement.md` — Rang 4: Schritt 2 + Idempotenz-Zeile → SKILL-Referenz, Schritt 5 verdichten.
- `.github/prompts/review.md` — Rang 5: Entscheidungs-Findings-Klammer → Template-Referenz, „ohne Issue" 1×, doppelte SKILL-Referenzzeilen mergen.
- `.github/prompts/documenter.md` — Rang 6: Rules-Kurzform streichen → SKILL-Referenz (Output/Rules).
- Referenzziele für AK4: `.claude/skills/{ticket-spec,ticket-ux,ticket-implementation,review-kreuzverhoer,pr-documenter}/SKILL.md`.

## Annahmen
- Zielstil = `.github/prompts/triage.md` (referenz-orientiert, „per SKILL.md step X") — so der Analyse-Block („Vorhandenes Muster").
- Kürzungsmengen-Ziel: netto ~2,6 KB über die 5 Dateien, Toleranz ±30 % (AK5) → zulässig 1,82–3,38 KB.

## Verworfen
- Rang 1/7–12 umsetzen — AK3 verbietet es explizit (auch die ADR-0007-Klammer in spec/implement bleibt stehen).
- `.github/workflows/**` anfassen — AK3-Verbot.

## Offen
- -

## Nächster Schritt
- Die 5 Dateien lesen (plus die referenzierten SKILL.md-Abschnitte für den AK4-Dry-Check), kürzen, Diff-Stat gegen AK5 prüfen, GATE, Commit+Push, PR (nicht Draft) mit AK4-Dry-Check + AK5-Beleg im Body.

## Fallstricke
- Verhaltenserhaltend arbeiten: jede Streichung muss von der referenzierten SKILL-Stelle vollständig gedeckt sein — sonst ist der Prompt defekt (wirkt erst in Folgeläufen, fällt also nicht im eigenen Lauf auf).
- Prompt-Dateien sind Markdown mit `{{ISSUE_NR}}`-Platzhaltern und Tabellen → Prettier-Format beachten (AK2-Elemente nicht aus Versehen umbrechen).
- Phasen-Notiz `.ai-memory/issue-1090-implement.md` gehört IN den Commit; Wegwerf-Artefakte (PR-Body-Zwischendateien) NICHT.

# Issue 1090 — Triage (Re-Triage nach needs-human), Stand 2026-08-28

**ERGEBNIS: VERDICT analyzed, Ampel 🟢.** Menschliche Entscheidung eingetroffen (Kommentar deleonio 2026-08-28T13:59:43Z: „Ich möchte O1") → Analyse-Block + Routing-Tabelle in den Body geschrieben, Labels `ai:needs-analyse` entfernt, `ai:needs-impl` gesetzt (ux=nein, spec=nein → direkt Impl). Kein Ping-Kommentar, kein Titel-/Body-Copyedit.

## Erledigt
- Trigger geprüft: kein KI-ANALYSE-Block im Body, aber `<!-- ai-triage-decision -->`-Kommentar (issuecomment vom 2026-08-28T13:27:15Z) vorhanden → Re-Triage-Pfad; genau 2 Kommentare gelesen (Entscheidungs-Kommentar + menschliche Antwort). Entscheidung = **O1 exklusiv** (nicht die empfohlene Kombi O1+Rang 10) — bindend, nicht hinterfragt.
- Stichprobe gegen Dateizustand: alle fünf O1-Ziele existieren, Audit-Zitate noch vorhanden (`spec.md` ai/harness/{{ISSUE_NR}} ✓, `ux.md` "advisory, not blocking" ✓, `implement.md` non-draft-Idempotenz ✓, `review.md` Entscheidungs-Findings ✓, `documenter.md` "3-8 most relevant files" ✓). Ist-Größen: spec 3267 / ux 2382 / implement 3336 / review 4892 / documenter 886 B.
- Analyse-Block (stand=2026-08-28T14:05:10Z) + Routing-Tabelle (ux nein/-/-, spec nein/-/-, impl ja/sonnet/high, review ja/sonnet/high) an den Body angehängt: Body per `gh issue view --jq '.body' > Datei` + `cat` beider Teile + `gh issue edit --body-file` (`.ai-memory/issue-1090-body.md`, `-block.md`, `-new.md`).
- Labels: `ai:needs-analyse` entfernt, `ai:needs-impl` gesetzt; `ai:analysed` war schon drauf (aus dem Workflow-Reset), `ci:prompt-audit` unangetastet.
- Schritt 6 (Auto-Close) geprüft: Anforderungen klar NICHT erfüllt (Funde vom selben Tag, keine Prompt-Commits seitdem) → Issue offen gelassen.
- Titel unverändert („ci: Prompt-Audit — Phasen-Prompts optimieren (2026-08-28)" — trifft auf O1 zu, kein substantieller Fehler).

## Relevante Stellen
- `.github/prompts/spec.md` — Rang 2: Schritte 2/3/5 auf SKILL-Referenzen kürzen; Resume-Hint, Phasen-Notiz, Label-Ban, Verdict BLEIBEN.
- `.github/prompts/ux.md` — Rang 3: Schritt 4 kürzen, ux-not-ready-Zeile streichen, Blockstruktur-Zeile verkürzen, No-Browser nur 1×.
- `.github/prompts/implement.md` — Rang 4: Schritt 2 + Idempotenzzeile + Schritt 5 verdichten.
- `.github/prompts/review.md` — Rang 5: Zeile-26-Klammer auf Template-Referenz, „ohne Issue" 1×, Doppelzeilen mergen.
- `.github/prompts/documenter.md` — Rang 6: Rules-Kurzform streichen → SKILL-Referenz.
- `.claude/skills/{ticket-spec,ticket-ux,ticket-implementation,review-kreuzverhoer,pr-documenter}/SKILL.md` — die Referenzziele; müssen die Streichungen decken (AK4-Dry-Check).

## Annahmen
- „Ich möchte O1" = exakt Option 1 (Rang 2–6), OHNE den Rang-10-Fix aus meiner Phase-1-Empfehlung — Empfehlung wurde nicht vollständig übernommen, wörtliche Wahl ist bindend (in AK3 als Scope-Grenze verankert).
- Offene Fragen 2–4 des Entscheidungskomments gelten als beantwortet bzw. nicht blockend: 1 PR (nur eine Option), O2 raus aus diesem Ticket, Nachweis = O1-eigener Schritt 3 (Dry-Check, jetzt AK4).
- Routing-Werte entsprechen dem etablierten Muster (sonnet/high für impl+review, wie #1083).

## Verworfen
- Rang 10 (prompt-audit.md-Aufzählung) trotzdem mitnehmen — Mensch hat nur O1 gewählt; wäre Scope-Verletzung.
- O2-Folge-Ticket selbst anlegen — Ticket-Erstellung außerhalb der gewählten Option; im Analyse-Block als „dem Menschen vorbehalten" vermerkt.
- Titeländerung — nicht substantiell falsch.
- MEMORY.md-Eintrag — kein neuer Fehler/noch nicht gelöste Erfahrung; Aufnahmekriterium nicht erfüllt.

## Offen
- `.ai-memory/issue-1090-body.md`, `-block.md`, `-new.md` sind Wegwerf-Artefakte (Body-Zusammensetzung) und gehören NICHT in einen Commit; `rm` braucht eine Freigabe, die früher nicht kam (wie 1083). Dazu evtl. noch das alte `issue-1090-decision.md` aus Phase 1. Nur diese Datei hier ist die echte Phasen-Notiz.

## Nächster Schritt
- Impl-Phase (Label `ai:needs-impl` gesetzt): O1 umsetzen — Kanon (Lauf-Mechanik bleibt, Methode → SKILL), Funde Rang 2–6 nach den Kürzungsvorschlägen im Issue-Body, Dry-Check + `git diff --stat` im PR belegen (AK4/AK5).

## Fallstricke
- Rang 7 berührt dieselben Dateien (ADR-0007-Klammer in spec.md/implement.md) — NICHT mitkürzen, er ist O3 (AK3).
- O1 ändert die eigenen CI-Prompts: Änderungen wirken erst für Folgeläufe; der impl-Agent beschneidet den Ast, auf dem er sitzt.
- Was in spec.md laut Rang 2 bleiben MUSS: Resume-Hint-Logik (steht nicht im SKILL), Phasen-Notiz, Label-Ban, Verdict.
- `gh issue view --json body --jq '.body'` hängt genau 1 Newline an (MEMORY 2026-08-25) — für dieses Append egal, bei Byte-Identitätspatches `head -c -1`.
- Soft-Deadline des Laufs (1787926457 ≈ 14:14 UTC) war knapp — Body-Edit und Labels schafften es gerade; Phasen-Notiz danach.

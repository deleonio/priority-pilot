# Issue 1005 — Fixup-Notizen (PR #1005, fix(ci): memory transport + prompt placeholders)

## Erledigt
- Runde 1 (2026-08-25): CI grün, keine Konflikte. Review 5404318556: GENAU 1 offenes Finding (#1), Rest 🟢.
- Finding #1 (`.claude/commands/spec-ticket.md:32` → `{{ISSUE_NR}}`): GEFIXT — aber NICHT durch mich: Mensch (deleonio) hat parallel auf den Branch `d6f14b1e` (02:50 UTC) gepusht, der exakt denselben Einzeiler + großes Memory-Feature enthält. Mein Duplikat-Commit a045b849 verworfen (reset --hard origin), HEAD = d6f14b1e.
- Kein eigener Commit gepusht — Remote-HEAD hat sich bewegt, Review prüft neu. KEIN Verdict abgegeben.

## Offen
- nichts — Finding #1 via d6f14b1e im PR; keine Entscheidungs-Findings.

## Nächster Schritt
- Nichts (Lauf abgeschlossen). Falls Folgelauf startet: PR-Stand neu prüfen (gh pr view/diff + neuester Sammelkommentar), NICHTS wiederholen.

## Fallstricke
- Fix-Branch ist shared mit dem Menschen: vor jedem Push `git fetch` + `git log HEAD..origin/…` — Push wurde non-fast-forward abgelehnt, weil d6f14b1e parallel lief. Duplikat-Fix verwerfen (reset --hard origin), NICHT reben/pushen.
- Kein Inline-Review-Thread vorhanden (Datei außerhalb Diffs, Review nur COMMENTED) → nichts zu resolven.
- Kandidat fürs Dauergedächtnis (hier nicht committet, deshalb nur notiert): paralleler Human-Push auf Fix-Branches prüfen vor eigenem Commit.

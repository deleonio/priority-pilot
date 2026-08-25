# Review Issue #1021 / PR #1023 — Bildentfernung im Documenter

## Erledigt
- MODUS Kreuzverhör (kein <!-- ai-review -->-Marker vorhanden). Voller Diff + AK-Block gelesen.
- Tests lokal grün verifiziert: `node --test .github/scripts/strip-images.test.ts` → 16 pass
  (pnnpm/tsx fehlen in Sandbox; Node 22.23 strippt TS nativ — kein tsx nötig).
- 3 Findings per Repro gegen echte Funktion belegt (s. Offen), Review mit Inline-Kommentaren
  gepostet (Review-ID 5019460693, event=COMMENT).
- Sammelkommentar NEU angelegt (Marker <!-- ai-review -->), Status needs-fixup.
- Titel-Gate: Titel war deutsch → umbenannt zu
  `feat(ci): remove images from PRs and issues in documenter`.
- VERDICT: needs-fixup (alle 3 Findings fixbar, kein Entscheidungs-Finding).

## Relevante Stellen
- .github/scripts/strip-images.mjs:20-24 — die vier replace-Regeln; Finding 1-Anker Zeile 22.
- .github/scripts/pr-image-strip.sh:90/103/109 — PR-Body-Fetch ($()-Strip), „2) PR-Kommentare",
  Issue-Body-Fetch — Findings 2+3.
- .github/scripts/strip-images.test.ts — 16 Tests, gh-Stub-Muster; Erweiterungspunkt für
  Finding-1-Testfälle + pulls-comments-Stub-Case.

## Annahmen
- Repro-Ausgaben (unveränderte Bilder bei `]` im Alt / `>` im Attribut) sind für GitHub-Rendering
  relevant — Markdown `![x](url)` mit Dritt-Host wird gerendert.
- Review-Bodies sind per REST nicht editierbar (nur dismiss) — als Limitation zu dokumentieren,
  nicht fixbar; deshalb Finding 2 nur für pulls/comments fixbar.

## Verworfen
- needs-human — alle Findings sind technisch fixbar, keine Architektur-/Produktentscheidung nötig.
- MEMORY.md-Eintrag — nichts ticket-unabhängig Neues (tsx-fehlt-Workaround ist 1:1 der bestehende
  Native-TS-Stand; kein neuer Fehler).

## Offen
- -

## Nächster Schritt
- Fixup-Phase: 3 Findings umsetzen; danach FIXUP-NACHWEIS (Sammelkommentar updatedAt als Diff-Grenze).

## Fallstricke
- Finding-Nummern im Sammelkommentar sind stabil (1/2/3) — NICHT umnummerieren.
- Bei Re-Review: Datei-Zeilen können sich durch Fixup verschieben — Anker neu verifizieren.
- node läuft ohne tsx via nativem Type-Stripping (Node ≥22.18); pnpm existiert in dieser Sandbox nicht.

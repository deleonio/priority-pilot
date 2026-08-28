# PR #1088 — Fixup (Finding F1 aus Runde 1)

Status: **erledigt, gepusht** (2026-08-28, Commit `48b5835a`). Einziges Finding F1 war eindeutig,
kein Entscheidungs-Finding. Alle 5 Threads resolved. → NO verdict (normale Pipeline-Fortsetzung).

## Erledigt
- F1 (alle 5 Inline-Kommentare, gleicher Befund): `pnpm format` ausgeführt → Prettier hat
  ausschließlich die 5 gemeldeten Dateien neu ausgerichtet:
  - `docs/spec/issue-619.md` (Tabelle: Pad-Striche, 7 Zeilen)
  - `docs/spec/issue-843.md` (Randfälle-Tabelle, 2 Zeilen)
  - `docs/spec/issue-1063.md` (Testtabelle AK4/AK5, 1 Zeile)
  - `docs/spec/issue-1066.md` (überzählige Leerzeile am EOF entfernt)
  - `docs/spec/user-journeys.md` (Randfälle-Tabelle neu gepaddet, 10 Zeilen)
- Diff ist rein Whitespace/Formatting (`git diff --stat`: 5 files, +20/−21), kein inhaltlicher Eingriff.
- Gate (relevant für docs-only): `pnpm exec prettier --check docs/spec/` → „All matched files use
  Prettier code style!"; `pnpm format` lief über das ganze Repo, alle anderen Dateien „unchanged".
  lint/knip/test entfallen (Docs-only, keine Code-Dateien berührt — Annahme aus Review-Phase).

## Relevante Stellen
- `package.json:17` — `pnpm format` (prettier --write .) ist das Fix-Kommando.
- `docs/spec/{issue-619,issue-843,issue-1063,issue-1066,user-journeys}.md` — die 5 Format-Anker.

## Annahmen
- Docs-only-PR → kein lint/knip/test-Gate nötig (aus Review-Phase übernommen; Diff ist rein Whitespace).
- Threads werden nach dem Push als RESOLVED markiert (Inline-Kommentar-IDs 3879984700,
  3879984703, 3879984707, 3879984713, 3879984722).
- Sammelkommentar 5451595225 (Marker `<!-- ai-review -->`) wird vom nächsten Review-Lauf
  (Fixup-Nachweis) aktualisiert — hier NICHT angetastet (Vertrag: Fixup fasst den ai-review-
  Kommentar nicht an).

## Verworfen
- CI-Rerun der alten roten `verify`-Run: nicht nötig — Push triggert einen neuen Run, und der
  Befund (Prettier) ist lokal verifiziert grün.

## Offen
- CI-Run des Pushs: muss grün laufen (`verify` inkl. Format-Check); e2e war bereits grün.

## Nächster Schritt
- Fixup-Nachweis (Review-Lauf): Delta-Review ab Push; nur Prettier-Diff der 5 Dateien prüfen;
  Sammelkommentar 5451595225 per PATCH aktualisieren, F1 in „Behobene Anmerkungen" verschieben,
  Footer `Review-Typ: Fixup-Nachweis`.

## Fallstricke
- Markdown-Tabellen in `docs/spec/` werden manuell editiert → Pad-Striche immer via
  `pnpm format` neu setzen lassen, niemals von Hand angleichen (exakt dieser Fehler war F1).
- issue-1066.md: nach Abschnitts-Löschung bleibt eine doppelte EOF-Leerzeile — Prettier entfernt
  sie, `git diff` zeigt sie als `-` auf letzter Zeile (leicht als „Inhaltsverlust" misslesbar).

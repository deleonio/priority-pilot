# Review Issue #1021 / PR #1023 — Bildentfernung im Documenter

## Erledigt
- **Runde 1 (Kreuzverhör)**: Voller Diff + AK-Block gelesen, Tests lokal grün (16 pass),
  3 Findings per Repro belegt, Inline-Review 5019460693 gepostet, Sammelkommentar
  5411092650 angelegt (needs-fixup), Titel zu `feat(ci): remove images from PRs and
  issues in documenter` umbenannt, VERDICT needs-fixup.
- **Runde 2 (Fixup-Nachweis)**: Marker vorhanden → Fixup-Modus. Fixup-Diff 306e5e0d..c31ec3d7
  geprüft, alle 3 Findings verifiziert behoben, KEINE neuen Probleme. Tests 19/19 grün.
  Main-Merge 241a067c (nach updatedAt) berührt PR-Dateien nicht (diff --stat leer).
  Sammelkommentar 5411092650 auf **reviewed** gepatcht (Review-Typ: Fixup-Nachweis).
  Titel-Gate: Titel konform, kein Rename. VERDICT reviewed.

## Relevante Stellen
- .github/scripts/strip-images.mjs:19-32 — gefixte Regex-Regeln (Nested-Klammer-Ebene
  in Alt-Texts, `<img>`-Attribute mit gequoteten `>`); Backtracking-sicher.
- .github/scripts/pr-image-strip.sh:fetch_body/strip_comments — Byte-Identität via
  `head -c -1`, dritter Param source="issue"|"pull" für pulls-Endpoints.
- .github/scripts/strip-images.test.ts — 19 Tests inkl. pull-comment-Stub + Fixpunkt.

## Annahmen
- Eine Klammer-Ebene im Alt-Text reicht (pathologische 2+ Ebenen bewusst akzeptiert,
  Leak-Reste fängt Bare-Source-Regel) — unverändert von Fixup übernommen.
- gh-Println-Verhalten (genau 1 Newline an --jq-Ausgabe) gilt für api UND pr view
  (im Fixup per xxd empirisch verifiziert).

## Verworfen
- Neue Findings im Fixup-Diff — keine gefunden: Regex-Alternativen disjoint/nicht-leer
  (kein katas­trophales Backtracking), head -c -1 liest bis EOF (kein SIGPIPE),
  `-s`-Skip bei leerem Body semantisch äquivalent zum alten `-n`.
- MEMORY.md-Dauergedächtnis-Eintrag für Runde 2 — nichts ticket-unabhängig Neues.

## Offen
- -

## Nächster Schritt
- Review abgeschlossen (reviewed). PR #1023 kann gemergt werden; keine weitere Review-Runde nötig.

## Fallstricke
- Finding-Nummern 1/2/3 im Sammelkommentar bleiben stabil — nicht umnummerieren.
- Falls DOCH ein neuer Push kommt: Fixup-Nachweis mit Diff-Grenze updatedAt des
  Sammelkommentars (jetzt 2026-08-25, nach Runde-2-PATCH).
- node läuft ohne tsx via nativem Type-Stripping (Node ≥22.18); pnpm existiert in dieser Sandbox nicht.

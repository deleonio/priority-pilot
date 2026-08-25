# Fixup Issue #1021 / PR #1023 — Bildentfernung im Documenter

## Erledigt
- Alle 3 Review-Findings umgesetzt (keine Entscheidungs-Findings, kein needs-human).
- Finding 1 (strip-images.mjs): Bild-Regex auf eine Alt-Text-Klammer-Ebene erweitert
  (`\[(?:[^\[\]]|\[[^\]]*\])*\]`, Bild- UND Link-Regel), `<img>`-Attribute erlauben
  gequotete Werte mit `>` (`(?:"[^"]*"|'[^']*'|[^>"'])*`). 2 neue Tests (+Nested-Link).
- Finding 2 (pr-image-strip.sh): strip_comments generalisiert auf dritten Parameter
  source="issue"|"pull"; Inline-Review-Kommentare via pulls/$PR/comments, GET/PATCH über
  pulls/comments/$id. Review-Body-Limitation im Skript-Header dokumentiert.
- Finding 3 (pr-image-strip.sh): neue Helper-Funktion fetch_body() — Direkt-Redirect +
  `head -c -1` statt `$(…)`, an allen 3 Fetch-Stellen (PR-Body L~100, Kommentar, Issue-Body).
  WICHTIG: gh hängt an JEDE --jq-Ausgabe genau einen Newline (Println, empirisch per xxd
  verifiziert für api UND pr view) — naiver Redirect würde einen Newline ADDIEREN;
  head -c -1 entfernt allein den gh-Newline. Stub emuliert das jetzt mit (cat + printf '\n').
- Tests: 19 statt 16 (alle grün), pnpm lint/knip/format grün (knip exit 0),
  pnpm test:scripts 192 pass. pnpm existiert DIESE Sandbox (Review-Notiz war veraltet).
- Commit + Push auf feat/issue-1021-bildentfernung, Review-Threads gelöst,
  Sammelkommentar (5411092650) auf erledigt-Tabelle aktualisiert.

## Relevante Stellen
- .github/scripts/strip-images.mjs:19-32 — die vier replace-Regeln mit Nested-Delimiter-Support.
- .github/scripts/pr-image-strip.sh:fetch_body/strip_comments — Byte-Identität + pull-Quelle.
- .github/scripts/strip-images.test.ts:Stub (~L. 181-260) — gh-Emulation inkl. Println-Newline;
  pull-comment-ids/-Fixture-Verzeichnis; sed braucht ZWEI Segmente vor (issues|pulls).
- MEMORY.md — neuer Learning-Eintrag zu gh-Newline/$()-Strip (reist im Fixup-Commit).

## Annahmen
- Eine Klammer-Ebene im Alt-Text reicht (Reviewer-Vorschlag; CommonMark erlaubt beliebig
  balancierte, 2+ Ebenen in Alt-Texten sind pathologisch — bewusst akzeptiert).
- head -c -1 (GNU) ist auf ubuntu-latest-Runnern und Test-Sandbox verfügbar — Skripte
  laufen nur dort.
- Review-Bodies sind per REST nicht editierbar (nur dismiss) — als Limitation dokumentiert.

## Verworfen
- new RegExp-Konstruktion mit String.raw für geteiltes Bracket-Muster — unleserlicher als
  zwei direkte Regex-Literale im Datei-Stil; Muster stattdessen 2× inline mit Kommentar.
- Beliebig tiefe Alt-Text-Verschachtelung — JS-Regex ohne Rekursion, Aufwand/Nutzen
  unverhältnismäßig; Leak-Reste fängt bei data:/user-attachments die Bare-Source-Regel.

## Offen
- -

## Nächster Schritt
- Zeitlimit überschritten → sauber abgeschlossen: Commit c31ec3d7 gepusht, Threads gelöst,
  Sammelkommentar fixup-complete. CI: verify PASS, e2e-Shards waren bei Wrap-up noch pending
  (Run 32856899406) — Re-Review-Phase prüft ggf. Abschluss; Finding-Nummern 1/2/3 bleiben stabil.

## Fallstricke
- gh-Stub-Sed für Num-Extraktion: repos/OWNER/NAME/(issues|pulls)/N — Owner/Name sind
  ZWEI Pfad-Segmente; mit einem Segment matchet der Sed nicht und die Listen bleiben leer
  (Tests failen mit "kein PATCH", nicht mit Stub-Fehler).
- Fixtures persistieren zwischen Tests im selben fixtureDir — neue pull-comment-ids/
  Fixtures MÜSSEN in Folgetests überschrieben werden, sonst failt die Idempotenz.
- Test-Assert auf trailing Newlines: präfix-spezifisch matchen (`PR mit …\n\n\n---`),
  sonst matcht der PR-Body-Case auch den Kommentar-Case als Substring.

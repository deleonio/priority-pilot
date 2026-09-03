# Issue 1206 — UX-Beratung (Phase 2), Stand 2026-09-03

**ERGEBNIS: VERDICT ux-ready.** KI-UX-Block in den Harness-Marker-Kommentar (ID `IC_kwDONloM188AAAABSaFxEw`) geschrieben — KI-ANALYSE + Routing-Tabelle byte-identisch erhalten, alle 6 Marker je 1× verifiziert. Keine Labels gesetzt, kein Code, kein Ping.

## Erledigt
- Issue-Body + Harness-Kommentar geladen, KI-ANALYSE (stand=2026-09-03T18:28:30Z) gelesen, Routing `ux: ja` bestätigt, kein vorhandener KI-UX-Block → Lauf berechtigt.
- Regelquellen statisch geprüft: `docs/mobile-ui-rules.md` (10 Regeln + Repo-Abstimmung 375px/44px), `.ai-knowledge/ux-design.md` (Tokens, Read-Modus, Refuse-Liste).
- `frontend/src/components/HelpPage.tsx` (komplett gelesen): Handbuch-Tab :88 nutzt bereits ReactMarkdown; Changelog rendert :99-111 je Release eine section mit rohem h2 + ReactMarkdown ohne Link-Styling.
- `frontend/src/app.css:1513-1548`: `.help-page-content` hat Regeln für h1-h3/p/ul/li/code, aber **keine `a`-Regel** → zentraler UX-Fund (Links ungestylt, kein Fokus-Indikator, kein overflow-wrap).
- KI-UX-Block verfasst (Deutsch) + via `updateIssueComment` gelandet.

## Relevante Stellen
- `frontend/src/components/HelpPage.tsx:99-111` — Changelog-Rendering; wird durch die Kategorie-Aggregation ersetzt (h2 je Kategorie statt h2 je Release).
- `frontend/src/app.css:1513` — `.help-page-content`-Block, hier muss die `a`-Regel rein (Farbe `--pp-brand`, underline, `overflow-wrap: anywhere`, `:focus-visible` mit `--pp-focus-ring`).
- `.github/release.yml` — Kategorien-Quelle (Emoji + Name); UX-Regel: Kategoriename als Text muss bleiben, Emoji ist Deko.

## Annahmen
- react-markdown erlaubt eine `a`-Component-Map (Standard-API) — dort target/rel zentral setzen; nicht am Quelltext der installierten Version geprüft (Sandbox ohne node_modules).
- Empfehlung Versionkennung als Klammer-Suffix (kein KolBadge) ist Beratung, keine Vorgabe — Analyse-Block nennt das explizit als Spec-Freiheit.

## Verworfen
- KolHeading-Empfehlung für die neuen Kategorie-Überschriften — Handbuch- wie Changelog-Tab nutzen rohe Headings; Konsistenz schlägt Kreativität, keine Mischung im selben Panel.
- Releasedatum pro Eintrag anzeigen — Rauschen bei ~30 aggregierten Releases; ganz weglassen.

## Offen
- Wegwerf-Artefakte in `.ai-memory/`, NICHT committen: `issue-1206-harness.{md,json}`, `issue-1206-harness.md` (Extrakt), `issue-1206-ux-block.md`, `issue-1206-new.md`, `issue-1206-mutation.txt`. Nur diese Datei ist die Phasen-Notiz.

## Nächster Schritt
- Spec-Phase: rote Tests AK1-AK5 laut KI-ANALYSE-Testfälle; UX-Hinweise (overflow-wrap, a-Regel, h2-je-Kategorie, Suffix statt Badge) als Gestaltungsvorgaben einbauen.

## Fallstricke
- Lange Autolink-URLs ohne `overflow-wrap: anywhere` reißen AK4 (375px Bounding-Box) — häufigster Stolperstein.
- Brace-Expansion-Sandbox blockt `gh api graphql -f query='mutation(…){…}'` inline → Query in Datei schreiben und **`-F query=@datei`** nutzen (`-f query=@` expandiert nicht, GraphQL-Parser-Error).
- `python3 -c` und `/tmp`-Umleitung sind in dieser Sandbox blockiert — JSON-Extraktion per `jq -r`, Dateien nur unter Repo-Wurzel.

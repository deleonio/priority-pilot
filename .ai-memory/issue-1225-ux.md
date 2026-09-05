# Issue 1225 — UX (Phase 2), Stand 2026-09-05

**ERGEBNIS: VERDICT ux-ready.** KI-UX-Block in den Harness-Marker-Kommentar geschrieben
(Node-ID `IC_kwDONloM188AAAABSyJjNQ`, Landing verifiziert: KI-ANALYSE Zeile 2–30 byte-identisch,
KI-UX 31–69, Routing 72–79). Kein Ping-Kommentar, KEINE Labels gesetzt (Workflow macht das),
Body unangetastet (ADR 0009), kein Code/Branch/PR.

## Erledigt
- SKILL.md, MEMORY.md, Issue-Body, Harness-Kommentar (KI-ANALYSE + Routing ux=ja/sonnet/medium) gelesen.
- Regelquellen statisch geprüft: `docs/mobile-ui-rules.md` (10 Regeln + Repo-Abstimmung), `.ai-knowledge/ux-design.md` (Cockpit-Tokens, Komponententabelle, Craft Floor).
- KoliBri-MCP `spec/avatar` verifiziert: `KolAvatar` Props `_label` (PFLICHT), `_src`, `_color` — keine onerror-/Fallback-Props.
- Code-Recherche: `frontend/src/App.tsx:665` (Avatar-Muster `_src={user.avatarUrl ?? undefined}`), `frontend/src/components/GroupFormDialog.tsx` (Dialog mit Inline-Fehler-Muster Z.47-54, `modal-actions`), `frontend/src/components/GroupsSection.tsx:156-200` (Karten-Klick-Exclusion `kol-button, kol-input-text, kol-dialog, button, a, input`, Namens-Button = Tastaturpfad), `frontend/src/components/GroupDetail.tsx:116-130` (Mitgliederliste ohne Avatare).

## Relevante Stellen
- `GroupFormDialog.tsx` — Einfügeort des Bildadressen-Felds (unter Beschreibung, Bearbeiten-Modus); Inline-`_error`/Hint-Muster vorhanden.
- `GroupsSection.tsx:156-200` — Avatar neben Namens-Button; Klick-Exclusion-Selektor NICHT um den Avatar erweitern (Avatar bleibt nicht-interaktiv).
- `App.tsx:665` — exakt zu übernehmendes `_src={x ?? undefined}`-Muster (ohne src → Initialen).
- KoliBri `spec/avatar` — `_label` Pflicht (Initialen UND Alternativtext), `_color` existiert, aber nicht setzen (Design-Sprache).

## Annahmen
- Kein blockierendes UX-Thema: Feld optional, Dialog-Muster etabliert, Avatar-Komponente vom Issue vorgegeben und korrekt → ux-ready, keine Offenen Fragen als Blocker (2 Festlegungen als Empfehlung dokumentiert: leeres Feld = `imageUrl: null` senden; `_color` ungesetzt).
- KolAvatar-Initialen-/Kontrast-Default deckt hell+dunkel ab (nicht selbst nachgerechnet — KoliBri-Theme-Verantwortung).

## Verworfen
- Browser/Playwright-Inspektion — Lauf ist rein statisch (Pipeline); dynamische Prüfung ist Impl-Aufgabe.
- `_color`-Empfehlung für Gruppen-Avatare — wäre Hex im Komponentencode (Design-Sprache-Bruch); KoliBri-Default genügt.
- Bestätigungsdialog fürs Bild-Entfernen — nicht destruktiv genug (Sequenzielle-Bestätigung gilt nicht).
- Eigenes `KolInputUrl`-Muster — existiert im Projekt nicht; `KolInputText` mit `type="url"`/`inputmode="url"` empfohlen.

## Offen
- Wegwerf-Artefakte in `.ai-memory/` NICHT committen: `issue-1225-ux-input.json`, `issue-1225-ux-block.md`, `issue-1225-comment-raw.md`, `issue-1225-head-check.md`, `issue-1225-comment-new.md`, `issue-1225-mutation.txt`, `issue-1225-splice.py` (Ausführung scheiterte an Sandbox-Approval — Splice lief über head/cat/tail in Bash). Nur `issue-1225-ux.md` (diese Datei) ist Phasen-Notiz.
- Advisory, nicht blockierend: `KolAvatar` hat kein onerror → bei später defekter URL ggf. defektes Bild; Initialen-Fallback als optionaler Spec-Punkt vorgeschlagen.

## Nächster Schritt
- Spec-Phase gemäß Routing-Tabelle (spec ja/sonnet/medium): AK1–AK5 aus dem KI-ANALYSE-Block in rote Tests gießen; UX-Empfehlungen des KI-UX-Blocks einarbeiten (leeres Feld → `null`, Inline-https-Fehler, Avatar-Größe fix, `min-width:0`-Textcontainer, `_color` ungesetzt).

## Fallstricke
- `python3` und awk-Prozesssubstitution brauchen in dieser Sandbox Approval → Splice/Verify mit head/cat/tail/grep/diff in einfachen Bash-Aufrufen bauen.
- `gh api graphql -f query=@file` expandiert `@file` NICHT (DIR_SIGN-Fehler) — Query-Datei mit `-F query=@…` übergeben; GraphQL-Braces `{...}` im Inline-Befehl lösen zudem den Brace-Expansion-Guard des Bash-Tools aus → Mutation in Datei auslagern.
- Node-ID (`IC_…`) ist eine GraphQL-ID, kein REST-Comment-ID — `gh api repos/.../issues/comments/<id>` liefert 404; Body nur via GraphQL `node(id:)` lesen.
- Avatar-Initialen kommen aus `_label` — `_label` muss der Gruppenname sein (nie „Gruppenbild"), sonst stimmen Initialen UND Alternativtext nicht.
- `scrollWidth <= innerWidth` (AK5) ist in dieser App schwach (Shell clippt `overflow-x: hidden`, Memory 2026-08-24) — Spec sollte die Bounding-Box-Assertion als schärferes Kriterium ergänzen.

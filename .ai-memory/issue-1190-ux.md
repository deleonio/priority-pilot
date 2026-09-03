# Issue 1190 — UX (Phase 2), Stand 2026-09-03

**ERGEBNIS: VERDICT ux-ready.** KI-UX-Block in den Harness-Marker-Kommentar (REST-ID 5524483293, GraphQL-Node IC_kwDONloM188AAAABSUjs3Q) geschrieben; KI-ANALYSE + Routing-Tabelle unverändert erhalten, Landing verifiziert (alle 6 Marker je 1×, Body byte-identisch + gh-Tailing-Newline). Keine Labels angefasst, kein Ping, Body unangetastet.

## Erledigt
- SKILL.md, MEMORY.md, Issue-Body, Harness-Kommentar, mobile-ui-rules.md, ux-design.md, `frontend/src/components/HelpPage.tsx` gelesen.
- KI-UX-Block (`.ai-memory/issue-1190-ux-block.md`) verfasst: Interaktion (4 Zustände, Lazy-Load-Retry), Mobile-First (375px, overflow-wrap für Code-Spans, Bounding-Box statt scrollWidth), A11y (KolTabs-Semantik, h2/h3-Heading-Mapping, `<time>`, tabular-nums), KoliBri (KolTabs nach SettingsPage-Muster, KolSpin/KolAlert vs. Plain-Fallback), Design (Read-Modus/Restrained, kein Rot für Breaking Changes), keine blockierenden Fragen.

## Relevante Stellen
- `frontend/src/components/HelpPage.tsx:9-43` — Ist-Zustand: Zurück-Button, fetch `/user-guide.md`, Fallback :19 (Plain-Text, kein KolAlert), KolSpin :34, ReactMarkdown :38.
- `frontend/src/components/SettingsPage.tsx:243` — KolTabs-Bestandsmuster (`_tabs`-Modulkonstante, Panels gemountet/hidden) laut Analyse-Block.
- Harness-Kommentar `.ai-memory/issue-1190-comment-new.md` — gesendeter Gesamtkommentar (Referenz für Folgephasen).

## Annahmen
- SettingsPage-KolTabs-Muster (Zeile 243) laut Analyse-Block, nicht selbst geöffnet.
- 30 Releases ohne Pagination/Akkordeon ausreichend (Issue-Autor: „flache Liste").

## Verworfen
- Externe GitHub-Links pro Release-Eintrag — Issue will die App nicht verlassen; als nachrüstbar vermerkt, kein AK.
- Rot-Einfärbung von Breaking-Changes-Abschnitten — Farbe trüge allein Bedeutung (WCAG 1.4.1), Text benennt Kategorie schon.
- KolAlert als FESTE Fehler-Vorgabe — Plain-Fallback analog Bestand (`HelpPage.tsx:19`) als gleichwertige Option genannt (advisory).

## Offen
- Wegwerf-Artefakte in `.ai-memory/`, NICHT committen: `issue-1190-ux-input.json`, `issue-1190-harness.md`, `issue-1190-ux-block.md`, `issue-1190-comment-new.md`, `issue-1190-mutation.graphql`, `issue-1190-make-json.py`, `issue-1190-verify.md`. Nur diese Datei + `issue-1190-triage.md` sind Phasen-Notizen.

## Nächster Schritt
- Spec-Phase (Workflow setzt Labels selbst): rote Tests TF1–TF5 aus dem Analyse-Block in `frontend/src/components/HelpPage.test.tsx` (neu) + e2e 375px.

## Fallstricke
- **gh-Sandbox:** `-f key=@datei` sendet den LITERAL-String `@datei` (hat den Harness-Kommentar kurzzeitig korrumpiert!) — nur `-F key=@datei` liest die Datei. Und: `{...}` auf der Kommandozeile (auch in Single-Quotes, auch GraphQL-Queries) wird von der Sandbox als Brace expansion abgelehnt → Kommentar-Updates per REST (`gh api repos/OWNER/REPO/issues/comments/ID -X PATCH -F body=@datei`), nie graphql; numeric REST-ID via `gh api repos/OWNER/REPO/issues/N/comments --jq '.[].id'`.
- python3-Aufrufe brauchen Freigabe → JSON-Bau überflüssig geworden (obiger REST-Weg reicht).
- E2E: kein Live-GitHub-Abruf (Rate-Limit/Flakiness) — Analyse TF5 sieht Fixture/Injektion vor; Bounding-Box-Assertions (App-Shell clippt overflow-x, Memory 2026-08-24).
- KolTabs benennt Slots zur Laufzeit um; inaktive Panels bleiben gemountet — Changelog-Lokatoren auf sichtbares Panel scopen (Memory 2026-08-23/29).
- ReactMarkdown-Heading-Mapping: Release-Body beginnt bei `###` — auf h3 mappen, Version als h2, sonst Überschriftensprünge.

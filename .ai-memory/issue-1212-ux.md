# Issue 1212 — UX (Phase 2), Stand 2026-09-04

**ERGEBNIS: VERDICT ux-ready.** KI-UX-Block in den Harness-Marker-Kommentar geschrieben (Kommentar-ID `IC_kwDONloM188AAAABSf4ESQ`, my-github-action-bot). KI-ANALYSE + Routing-Tabelle byte-identisch erhalten (Verifikation: alle 6 Marker je 1×). Kein Issue-Body-Edit, keine Labels, kein Ping-Kommentar. Rein statisch (mobile-ui-rules.md + ux-design.md + GroupsSection.tsx-Quelltext); KoliBri-MCP nicht genutzt — Komponentenwahl aus #1211-Bestand + MEMORY (KolCombobox-Filter-Hook fehlt in 4.3.0, #1083).

## Erledigt
- Issue-Body + Analyse-Block gelesen (UX-Routing: ja/sonnet/medium; Ampel 🟢, keine offenen Fragen).
- Regelquellen gelesen: `docs/mobile-ui-rules.md`, `.ai-knowledge/ux-design.md`.
- `frontend/src/components/GroupsSection.tsx` (148 Zeilen) als UI-Vorlage verifiziert: KolAlert/KolSpin/KolCard-Leerzustand, `roleLabel`-KolBadge (:109), Delete-Modal + `fallbackFocusRef` (:32,:138).
- KI-UX-Block geschrieben (`.ai-memory/issue-1212-ux-block.md` → Concat mit `issue-1212-harness-comment.md` → `issue-1212-comment-new.md`), Update per GraphQL `updateIssueComment`.

## Relevante Stellen
- `frontend/src/components/GroupsSection.tsx` — bestehende Gruppen-UI; Gruppendetail, Mitgliederliste, Einladen-Suche und Einladungs-Ansicht bauen darauf auf.
- `frontend/e2e/groups.spec.ts` — #1211-E2E-Muster; neue `groups-invitations.spec.ts` (TF8) dazu.
- `docs/mobile-ui-rules.md` Regeln 3/7/2 — einspaltige Liste statt Tabelle, 4 Zustände, 44px-Targets.
- `.ai-knowledge/ux-design.md` §2/§4 — Tokens, KoliBri-Komponentenwahl.

## Annahmen
- Empfangene Einladungen als Abschnitt der Gruppen-Sektion (Empfehlung im UX-Block, der Spec darf abweichen) — bewusst als Empfehlung, nicht Entscheidung.
- Grafische Abweichungen der Analysis-Notizen („fuer/ueber" Umschrift) stammen aus deren Erstellung; KI-ANALYSE unangetastet gelassen (Vertrag).

## Verworfen
- KoliBri-MCP-Abfrage — Komponenten (KolInputText, KolButton, KolBadge, KolAlert, KolSpin, KolCard, KolHeading) sind alles #1211-Bestand; kein neuer Komponententyp, keine Prop-Unklarheit.
- Eigener Navigations-Tab für Einladungen — Overengineering für die AK-Menge; als offene UX-Frage (nicht blockierend) dokumentiert.
- AK12 umformulieren zu lassen — AK bleibt, nur E2E-Hinweis (Bounding-Box zusätzlich, App-Shell clippt overflow-x) im UX-Block für die Spec-Phase hinterlegt.

## Offen
- Wegwerf-Artefakte in `.ai-memory/`, NICHT committen: `issue-1212-harness-comment.md`, `issue-1212-harness-raw.json`, `issue-1212-ux-block.md`, `issue-1212-comment-new.md`, `issue-1212-mutation.graphql`. Nur diese Datei hier ist die Phasen-Notiz.

## Nächster Schritt
- Spec-Phase (`ai:needs-spec`): rote Tests TF1–TF8 laut Analyse-Block; E2E TF8 mit Bounding-Box-Assertions bei 375px/320px ergänzen.

## Fallstricke
- gh-Update des Kommentars: Inline-GraphQL-Mutation mit `{...}` scheitert am Bash-Tool-Parser („Brace expansion"); REST-PATCH braucht numerische ID (nicht verfügbar) → Query in Datei, `-F query=@file` (-f liest kein @).
- `gh api graphql -q` lieferte hier leeren Body-Output; Body-Extraktion stattdessen roh speichern + `jq -r '.data.node.body'`.
- KolCombobox wegen fehlendem Filter-Hook in @public-ui 4.3.0 vermeiden (#1083) — Suche als KolInputText + eigene ul/li-Liste.
- 409 „letzter Admin" als KolAlert mit Server-Meldung zeigen, nicht Toast (Anti-Pattern-Liste).

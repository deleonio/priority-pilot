# Issue 1159 — UX (Phase 2), Stand 2026-09-01

**ERGEBNIS: VERDICT ux-ready.** KI-UX-Block in den Harness-Marker-Kommentar (ID `IC_kwDONloM188AAAABR_HhMA`, REST-ID 5502001456) geschrieben — zwischen KI-ANALYSE:END und ai-phase-routing:START. KI-ANALYSE byte-identisch erhalten (diff: nur der bekannte gh-Trailing-Newline). Keine Labels gesetzt, Body unangetastet, kein Ping-Kommentar.

## Erledigt
- SKILL.md, ux-design.md, mobile-ui-rules.md gelesen; Issue-Body + Harness-Kommentar geladen.
- Statische Code-Prüfung: `frontend/src/app.css:1021-1207` (`.form-grid` gap=--pp-gap-base, `.pillar-weights-grid`-Kommentar 1028-1031 „sieben Formulare teilen sich .form-grid", `.deadline-group` :1173, `.pillar-editor` :1179), Tokens `app.css:80-129` (space/gap-Skala), Surface/Border-Rollen `app.css:31-41,150-158`, `TaskForm.tsx` 770-900 (Titel-VoiceField, `.range-inputs-row` mit Priorität+Aufwand, `.deadline-group` mit Serie-Modus).
- KIBri-MCP: kein Fieldset-Component in dieser Version (Suche „fieldset" = 0 Treffer); KolCard-Spec existiert — Empfehlung wurde bewusst GEGEN KolCard-in-Modal und FÜR Layout-Container + Tokens formuliert.

## Relevante Stellen
- `frontend/src/components/TaskForm.tsx:777-1213` — `.form-grid`-Inhalt, Ziel der neuen Section-Wrapper.
- `frontend/src/app.css:1021` `.form-grid` — global geteilt (QuickCaptureModal!); daher Empfehlung Opt-in-Wrapper-Klassen statt Restyle.
- `frontend/src/app.css:1173` `.deadline-group`, `:1179` `.pillar-editor` — Bestands-Gruppen, in Sekundär-/Optional-Stufe integrieren.
- `.ai-memory/issue-1159-{ux-block,new}.md` — gesendeter Block / neuer Kommentar-Body.

## Annahmen
- QuickCaptureModal bleibt bewusst kompakt (Empfehlung im Block als offene, nicht-blockierende Entscheidung für die Spec hinterlegt).
- Checklisten-Editor in Optional-Sektion (Analyse-Annahme, übernommen).

## Verworfen
- KolCard als Gruppen-Container — Card-in-Modal-Schachtelung, zu schwer.
- Akkordeon/„Mehr anzeigen" für Optional-Bereich — Zusatzklick, widerspricht Ist-Zustand.
- Brand-/Signalfarbe für Pflichtgruppe — Farbe ist Signal, Gruppierung ist Struktur (ux-design.md Haltung).

## Offen
- Wegwerf-Artefakte NICHT committen: `issue-1159-harness.md`, `issue-1159-ux-block.md`, `issue-1159-new.md`, `issue-1159-gql.txt`, `issue-1159-verify.md`. Nur diese Datei ist die Phasen-Notiz.

## Nächster Schritt
- Spec-Phase: e2e `issue-1159-taskform-layout.spec.ts` gemäß AK1–AK6 des Analyse-Blocks; Gruppen-Wrapper-Klassen + Token-Zuordnung aus dem KI-UX-Block als Vorlage.

## Fallstricke
- `gh api graphql -f query='mutation(...)'` wird in dieser Runner-Sandbox als „Brace expansion" blockiert und `-f query=@file` liest die Datei NICHT (sendet Literal) → Ausweichpfad: REST `gh api -X PATCH repos/<repo>/issues/comments/<databaseId> -F body=@file` (databaseId via GraphQL-Query ohne Mutation-Braces holbar).
- `.form-grid` nie global umstylen — #727-Regression (Y-Versatz 18px) ist dokumentiert.
- Fläche+Textfarbe zusammen setzen (Dark Mode, ux-design.md Regel 6, gemessene 1.34:1-Panne).

# Issue 1169 — UX (Phase 2), Stand 2026-09-02

## Erledigt
- Harness-Kommentar (ID 5515221872, node IC_kwDONloM188AAAABSLubcA) geladen, KI-ANALYSE (stand=2026-09-02T19:33:06Z) + Routing (ux ja/sonnet/medium) gelesen; kein KI-UX-Block vorhanden → Erstlauf.
- Regeln gelesen: docs/mobile-ui-rules.md (Regel 10 Bewegung, Repo-Abstimmung 375px), .ai-knowledge/ux-design.md (Farbrollen, Skalen, Craft Floor Motion).
- Statische Verifikation: `app.css:1777` pointer-events:none-Muster (UpdatePrompt-Overlay), `app.css:187-192` globale reduced-motion-Regel klemmt NUR CSS-Tokens auf 1ms (nicht JS/rAF!), `use-is-mobile.ts:13` matchMedia-Vorbild, `App.tsx:66` DONE_REMOVAL_DELAY_MS.
- KI-UX-Block (deutsch, 6 Sektionen, keine offenen Fragen) via REST PATCH in den Harness-Kommentar geschrieben; Prefix (Zeilen 1-43) per cmp byte-identisch verifiziert, alle 6 Marker 1x im Ergebnis.

## Relevante Stellen
- `frontend/src/app.css:187-192` — zentrale Erkenntnis: reduced-motion-Regel wirkt NICHT auf rAF-JS-Animation → Konfetti braucht eigene matchMedia-Abfrage im JS.
- `frontend/src/app.css:1765-1781` — pointer-events:none-Overlay-Muster für AK5.
- `frontend/src/lib/use-is-mobile.ts:13` — matchMedia-Hook-Vorbild für AK6.
- `frontend/src/App.tsx:382-426` — handleDoneToggle-Choke-Point, einziger Trigger-Punkt.

## Annahmen
- Partikelfarben aus --pp-*-Tokens (Status-done/Success/Pillar-Rampe) ist Empfehlung, keine AK-Anforderung — Issue schweigt zu Farben.
- z-index unter Popovers/Toasts als Empfehlung formuliert; konkreter Wert der Umsetzung überlassen.

## Verworfen
- KoliBri-MCP-Recherche — kein Bedienelement, reines Deko-Canvas; Komponentenwahl-Stelle im Block kurz begründet (keine Ausnahme-Regel nötig).
- Offene UX-Fragen — keine vorhanden; Anforderungen eindeutig, Technik-Entscheidung bewusst der Umsetzung überlassen.

## Offen
- Wegwerf-Artefakte in .ai-memory/ NICHT committen: issue-1169-harness.md, issue-1169-ux-block.md, issue-1169-new.md, issue-1169-mutation.txt, prefix-check.md, prefix-new.md. Nur diese Datei ist die Phasen-Notiz.

## Nächster Schritt
- Spec-Phase: rote Tests für AK1-AK6 gemäß Testfälle im KI-ANALYSE-Block (TF1-TF6).

## Fallstricke
- GraphQL-mutation über gh cli scheitert an Sandbox-Filter (Brace expansion) → REST PATCH `/issues/comments/<numeric-id>` mit `-F body=@file` funktioniert; numerische ID via `gh api repos/{owner}/{repo}/issues/1169/comments` (5515221872).
- Die globale reduced-motion-CSS-Regel ist für AK6 NICHT ausreichend — Unit-Test muss matchMedia-JS-Abfrage prüfen (steht so im KI-UX-Block).
- Labels nicht anfassen (Workflow macht das automatisch).

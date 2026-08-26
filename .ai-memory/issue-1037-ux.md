# UX-Beratung Issue #1037 — KI-Provider-Tab Button-Layout

## Erledigt

- Regeln gelesen: mobile-ui-rules.md, ux-design.md
- Analyse-Block gelesen: 6 AK (375px gestackt ≥90%, 1280px inline), Testfälle konkret
- Triage-Kontext: Vorbild `.settings-action-btn` (align-self), Breakpoint 768px, KoliBri-Host
- UX-Beratung-Block schreiben (KI-UX:START/END) mit statischer Regel-Prüfung
- Issue-Body editiert: UX-Block nach KI-ANALYSE:END eingefügt
- VERDICT: ux-ready (Spec erfüllt Mobile-First, A11y, KoliBri-Regeln, keine Fragen offen)

## Relevante Stellen

- `.settings-action-btn` (app.css:1442-1451) — mobil `align-self: stretch`, ab 768px `align-self: flex-start` — VORBILD
- `.llm-provider-admin__actions` (app.css:1904-1919) — Flex Row, Aktionen
- `LlmSettings.tsx:298` — Button „Neuer Provider"
- `LlmSettings.tsx:315-337` — Aktionsleiste Testen/Bearbeiten/Löschen
- mobile-ui-rules.md Regel 2: Touch-Targets ≥44px (Repo: 44px Min), 8dp Abstand
- mobile-ui-rules.md Regel 3: 375px Eine Spalte, kein horizontales Scrollen
- ux-design.md: KoliBri zuerst, nur Tokens, Mobile-First 375px

## Annahmen

- `kol-button`-Host ist Ziel (Shadow-DOM nicht modifizierbar, #824)
- Desktop-Layout bleibt (Provider-Items als Row, Aktionen rechts)
- Buttons haben sichtbare Labels oder aria-label (keine Icon-Only ohne A11y-Label)
- Breakpoint 768px (= 48rem) ist bindend
- AK1-AK6 sind prüfbar (BoundingBox, Computed Style, Vitest)

## Verworfen

- KoliBri-Component-Varianten abfragen (MCP nicht nötig, `kol-button` Standard reicht)
- Farb-/Spacing-Token-Vorschläge (Spec braucht CSS-Regel, nicht UX-Input)
- Dynamische Browser-Inspektion (statische Regel-Prüfung nur)

## Offen

- KEINE.

## Nächster Schritt

- UX-Block in Issue-Body schreiben (KI-UX:START/END)
- VERDICT: ux-ready (Spec erfüllt Regeln, keine UX-Fragen)
- `gh issue edit --body-file` mit Block + VERDICT

## Fallstricke

- `.llm-provider-admin__actions` ist selbst Flex-Container (Row): align-self am Kind greift korrekt
- 768px vs. 48rem: konsistent halten (Vorbild nutzt 768px, Triage-Kontext sagt beide Werte sind wertgleich)
- Touch-Feedback: AK2 (≥90% Breite) stellt sicher, dass `active`-State sichtbar ist (KoliBri-Styling)

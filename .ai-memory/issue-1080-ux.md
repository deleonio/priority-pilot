## Erledigt
- UX-Review geschrieben (KI-UX-Block in Issue-Body, Stand 2026-08-28). Grundlage: docs/mobile-ui-rules.md, .ai-knowledge/ux-design.md, bestehendes Switch-Muster.
- Relevante Codepunkte geprüft: SettingsPage.tsx:153-236 (`.settings-switch-row` + `KolInputCheckbox _variant="switch"`), app.css:1519-1552 (Stack <768px / Row ≥768px, Full-Bleed-Trick).

## Relevante Stellen
- frontend/src/app.css:1519 — `.settings-switch-row`: existierendes Mobile-Muster für die neuen Schalter, AK6 darüber abdecken statt neuem CSS.
- frontend/src/components/SettingsPage.tsx:156 — `KolInputCheckbox _variant="switch"` = KoliBri-konforme Schalterwahl (Sample `sample/input-checkbox/switch`).

## Annahmen
- Tab „KI-Provider" ist mit KolTabs aufgebaut; neue Switch-Zeilen landen im selben Tab wie LlmSettings.

## Verworfen
- Dynamische Prüfung (Playwright/Viewport) — lt. Phase 2 rein statisch.

## Offen
- Keine blockierenden; zwei Advisory-Fragen im KI-UX-Block (Positiv-/Negativ-Labeling, visuelle Behandlung der Schnellerfassung-Option bei ausgeschaltetem Hauptschalter).

## Nächster Schritt
- Spec-Phase (Phase 3) übernimmt die KI-UX-Empfehlungen unverändert.

## Fallstricke
- Schalter-Labeling: Ticket formuliert „deaktivieren" — negativ formulierter Switch mit Default=an invertiert das mentale Modell; im KI-UX-Block Positiv-Formulierung empfohlen.
- `.settings-switch-row` funktioniert nur mit dem Full-Bleed-Trick (margin-inline -1.5rem) — nicht nachbauen, wiederverwenden.

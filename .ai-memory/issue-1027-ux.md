# Issue 1027 — UX-Phase (2026-08-25, ERLEDIGT)

## Erledigt
- UX-Beratung komplett zwischen `<!-- KI-UX:START -->` und `<!-- KI-UX:END -->` in Issue-Body geschrieben via `gh issue edit 1027 --body-file -`.
- Design-System-Prüfung gegen ux-design.md (Tokens, Skalen, Komponentenwahl), mobile-ui-rules.md (Touch-Zonen, Reflow, A11y) und KoliBri Card-Spec.
- Alle Kriterien erfüllt: Mobile-First (Reflow OK, Skalen-konform), A11y/BITV (Kontrast, Screenreader, Tastatur), KoliBri (KolCard korrekt), Design-Sprache (Tokens, Rhythmik, Craft Floor).
- Offene UX-Frage dokumentiert: Zielabstand 16px vs 24px — nicht blockierend.

## Relevante Stellen
- `frontend/src/app.css:793` — `.forest-node-card { margin-bottom: var(--pp-gap-tight) }`: Ziel-Regel für Änderung.
- `frontend/src/app.css:118-119` — Spacing-Tokens (`--pp-gap-base` = 1rem = 16px, `--pp-space-6` = 24px).
- `docs/mobile-ui-rules.md` — Regel 6 (4er-Skala: 4/8/12/16/24/32/48px), Regel 3 (kein horizontales Scroll).
- `.ai-knowledge/ux-design.md` — Skala 3 (Abstände 4/8/12/16/24/32/48px), Craft Floor Spacing (Tight Groups, generöse Separation).
- `frontend/src/components/ForestPanel.tsx:44` — KolCard mit Klasse `forest-node-card`.

## Annahmen
- Zielabstand 1rem (16px) ist ausreichend für "klar getrennt" — 24px wäre generöser, aber beide Werte liegen auf der Skala.
- Vertikaler Abstand beeinflusst nicht horizontalen Scroll bei 375px (nur y-Achse).
- Dark-Mode automatisch berücksichtigt durch Token-Nutzung.

## Verworfen
- Keine Verwerfungen — alle Empfehlungen passen zum Design-System.

## Offen
- Zielabstand final festlegen: 16px oder 24px — bleibt dem Implementierer überlassen, beide valide.

## Nächster Schritt
- Workflow setzt Label `ai:needs-spec` automatisch (bei VERDICT: ux-ready).

## Fallstricke
- `.forest-node-children` (Verschachtelung) nicht anfassen — nur Top-Level-Rhythmik erhöhen.
- Kein `--pp-gap-tight`-Token global ändern — nur die Card-Regel.
- Horizontales Scroll bei 375px vermeiden (nur vertikaler Abstand).

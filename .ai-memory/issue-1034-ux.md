# Issue 1034 — UX-Beratung (Phase 2)

## Erledigt

- UX-Beratung in 5 Bereichen geschrieben: Interaktion, Mobile-First, A11y/BITV, KoliBri, Design-Sprache.
- KI-UX-Block zwischen `<!-- KI-UX:START -->` und `<!-- KI-UX:END -->` in den Issue-Body eingefügt.
- Issue-Body per `gh issue edit --body-file` aktualisiert (1034).
- Beratung ist **beratend, nicht blockierend** — gibt Prüfpunkte, keine harten Blocker.

## Relevante Stellen

- `frontend/src/components/UpdatePrompt.tsx:29-48` — zwei `KolCard`-Blöcke mit `KolButton` Aktionen; Wrapper-`<span data-testid>` für Unit-Tests.
- `frontend/src/app.css:1555-1572` — `.update-prompt` CSS; fehlen Mobile-Regeln (Media-Query, Button-Breite, Touch-Target).
- `frontend/e2e/pwa-update-prompt.spec.ts` — e2e-Tests nutzen Stellvertreter-Element, kein echter SW-Update-Zyklus (nicht deterministisch).
- `.ai-knowledge/ux-design.md` — Design-Sprache Cockpit, Farbrollen, Skalen-Tokens (Abstand, Typo, Radius).
- `docs/mobile-ui-rules.md` — 10 Regeln, Repo-Abstimmung (375px, 44px Minimum Touch-Target, `@media (max-width: 767px)`).

## Annahmen

- KoliBri-Hosts sind Block-Level, füllen 100% Breite — Button-Host muss explizit auf Breite gesetzt werden (`width: 100%`), nicht das Shadow-Button.
- KolCard + KolButton haben per KoliBri bereits sichtbare `:focus-visible`-Ringe und Hover-States (keine zusätzliche Styling nötig).
- Span-Wrapper mit `data-testid` sind aktuell OK für a11y (Button dahinter ist fokussierbar), aber könnten in Zukunft `role="button"` + `tabindex="0"` brauchen.
- Farbrollen (`--pp-signal`, `--pp-success`, etc.) sind in beiden Farbschemata (hell+dunkel) validiert und ≥4.5:1 Kontrast (design-system garantiert das).

## Verworfen

- `VERDICT: ux-not-ready` — alle Anforderungen sind adressierbar:
  - Touch-Targets (44x44px) sind gegen Repo-Muster (Regel 2, AK1) formulierbar.
  - Texte (AK4-5) sind konkret vorgegeben.
  - A11y-Punkte (Kontrast, Fokus, SR) sind per KoliBri abgedeckt, Prüfpunkte benannt.
  - KoliBri-Komponenten-Wahl ist richtig.
  - Design-System-Regeln passen (Tokens, Skalen, Farbrollen).

## Offen

- **Safe-Area-Insets:** `.update-prompt` mit `position: fixed; bottom: 0` sollte iOS Safe Area respektieren. **Empfehlung im UX-Block:** CSS nutze `bottom: env(safe-area-inset-bottom, 0)` statt hard `bottom: 0`. KoliBri-Card tut das intern, aber CSS-Regel muss durchleiten.
- **Farbrollen:** AK4-5 nennen Texte, aber nicht `--pp-*` Rollen für Card-Label + Button. **Empfehlung im UX-Block:** Implementierungsphase legt fest (Signal? Success?), rechnet Kontraste.
- **Wrapper-Semantik:** Der `<span data-testid>` ist JSDOM-Workaround, a11y-neutral aber semantisch „falsch". **Empfehlung:** als gegeben betrachten, alternative Approaches (z. B. direktes `fireEvent` auf KolButton) optional später prüfen.

## Nächster Schritt

- Phase 03 (Spec): Redaktion der Acceptance Tests mit konkreten Textprüfungen, Safe-Area CSS, Farbrollen-Festlegung.

## Fallstricke

- Der UX-Block nennt drei „offene Fragen" (unter Offene UX-Fragen), aber diese sind **nicht blockierend** — die Implementierungsphase kann sie während der Umsetzung klären. Der Wortlaut-Vorschlag (AK4-5) ist konkret genug, um Texte zu testen.
- Span-Wrapper-Strategie mit `pointer-events: none` auf Container ist intakt. Wird der Button auf Block-Breite gesetzt, muss der Wrapper ebenfalls Block-Level werden (`display: block`) — sonst bleibt Klickfläche schmal (notiert im UX-Block).
- Touch-Target-Messung im e2e-Test (`boundingBox()` Methode) ist das Muster aus issue-996-pillar-row-mobile.spec.ts — der Test für 1034 nutzt Stellvertreter-Element (echte SW-Zyklen nicht deterministisch).

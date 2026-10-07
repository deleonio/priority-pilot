# Aufklappbereiche bleiben beim Neuzeichnen offen (#2328)

**Stand:** 2026-10-07

Der KoliBri-React-Wrapper schreibt bei jedem Neuzeichnen alle Props zurück auf das Element. Ein festes `_open={false}` klappt einen vom Nutzer geöffneten `KolDetails` daher wieder zu.

## Verhalten

- **Ziel:** Ein geöffneter Aufklappbereich bleibt offen, bis der Nutzer ihn schließt.
- **Betroffen:** `StreakCard` (Hilfe zum Streak), `DuoCard` („Wann zählt der gemeinsame Streak?"), `TaskGraphPanel` („Legende", „Graph als Liste" — zwei unabhängige Zustände).
- **Schritte:** Bereich per Klick öffnen → Elternkomponente neu zeichnen (neue Props/Daten) → Bereich ist weiterhin offen → erneuter Klick schließt ihn.
- **Umsetzung:** Klappzustand im React-State, `_open` daraus, `_on.onToggle` setzt ihn (Muster `ConsentStep.tsx`). Startzustand bleibt zugeklappt; sichtbare Texte unverändert.
- **Statisch (Review, kein Test):** im Frontend-Code bleibt kein JSX-Attribut `_open={false}`.

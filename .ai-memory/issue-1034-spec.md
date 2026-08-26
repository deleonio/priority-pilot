# Issue 1034 — Spec (Phase 3)

## Erledigt

- Branch `feat/issue-1034-pwa-mobile-buttons` von `main` angelegt (keine Draft-Wiederverwendung nötig — nur ein
  `ai/state/issue-1034`-Zustandsbranch existierte, kein offener PR).
- Spec `docs/spec/issue-1034.md` angelegt (Ziel/Vorbedingung/Schritte/Erwartetes Ergebnis + „Test-Pflege-Bedarf").
- Rote Tests geschrieben und verifiziert (`npx vitest run src/components/UpdatePrompt.test.tsx`): 3 rot
  (AK4, AK5, AK2d), 14 grün (Dedup — AK6 Klick-Verhalten unverändert abgedeckt durch bestehende Tests).
  - `frontend/src/components/UpdatePrompt.test.tsx`: neue Describe „UpdatePrompt — beschreibende Texte (#1034)"
    mit AK4/AK5-Tests (Card-Label als `data-label`-Attribut, Fließtext, Button-Label). Alte konfligierende
    Tests „AK2 (#353)" und „AK4a/AK4b (#353)" entfernt (prüften alte Stichwort-Texte als Card-Kind-Text).
    „AK2d (#373)" auf neues Button-Label „Verstanden" nachgezogen statt entfernt (bleibt Komponenten-Typ-Schutz).
  - `frontend/e2e/pwa-update-prompt.spec.ts`: neue Describe „UpdatePrompt Mobile-Bedienbarkeit (#1034)" mit
    AK1 (je Card ≥44×44px + ≥90% Card-Innenbreite bei 375px), AK2 (kein Overflow bei 320px), AK3
    (Desktop-Regression-Schutz bei 1280px). Playwright-Browser in dieser Sandbox nicht installiert
    (`npx playwright install` nötig) — nur `--list` zur Kompilierprüfung gelaufen, NICHT live verifiziert.
- Commits: `test: rote Spec-Tests für #1034`, `test: AK2d-Assertion auf neues Button-Label (#1034) nachziehen`.
  Branch gepusht, Draft-PR #1035 erstellt (`Closes #1034`), Verknüpfung geprüft (`closingIssuesReferences` = [1034]).

## Relevante Stellen

- `frontend/src/components/UpdatePrompt.tsx:29-48` — Implementierungsphase ändert hier: `_label` der
  beiden `KolCard`, `<p>`-Text, `_label` der beiden `KolButton`, plus CSS für Button-Breite/Höhe.
- `frontend/src/app.css:1555-1572` — `.update-prompt`; braucht Media-Query `@media (max-width: 767px)`
  für `kol-button`-Breite/Höhe (kein Selector-Detail vorgeschrieben, nur das gemessene Ergebnis zählt).
- `docs/spec/issue-1034.md` — vollständiger Vertrag inkl. Test-Pflege-Bedarf-Liste.

## Annahmen

- Card-Label wird weiterhin über die `_label`-Prop von `KolCard` transportiert (im Vitest-Mock als
  `data-label`-Attribut sichtbar) — nicht als sichtbarer `<h*>`-Text im Kind-Baum.
- Button-Host-Messung in e2e nutzt den `span[data-testid]`-Wrapper als Locator (`[data-testid="..."]`),
  nicht den `kol-button` direkt — das ist der native Klick-Wrapper, dessen Breite/Höhe die tatsächliche
  Tap-Fläche bestimmt.

## Verworfen

- Kein Test für Farbrollen (`--pp-*`) — laut KI-UX-Block nicht-blockierende offene Frage, kein AK.
- Kein Test für Safe-Area-Insets — bereits vorhanden (`app.css:1561`), nicht Teil der AKs, nur Erhalt.
- AK6 nicht neu getestet — bereits durch `AK3`/`AK4c` in `UpdatePrompt.test.tsx` abgedeckt (Dedup).

## Offen

- e2e-Tests (AK1-AK3 in `pwa-update-prompt.spec.ts`) sind NICHT live gelaufen (kein Chromium-Binary in
  dieser Sandbox: `Executable doesn't exist at .../chromium_headless_shell-1234/...`). Nur `--list`
  bestätigt Kompilierbarkeit/Registrierung (7 Tests total). Nächste Phase (Implementierung) sollte vor
  dem GATE `npx playwright install` + echten Lauf durchführen, um zu bestätigen, dass AK1/AK2 im Status
  quo tatsächlich rot sind (erwartet, aber ungeprüft) und AK3 grün bleibt.

## Nächster Schritt

- Phase 04 (Implementierung): `UpdatePrompt.tsx` Texte/Labels ändern, `.update-prompt`-CSS um
  Mobile-Media-Query (Button-Breite ≥90%, Höhe ≥44px) ergänzen, Klick-Wrapper-`<span>` bei Bedarf auf
  `display: block` setzen (siehe UX-Block-Prüfpunkt), dann `pnpm test` (Vitest) + Playwright lokal/CI grün.

## Fallstricke

- Regex-Overlap: `/Neu laden/i` matcht weiterhin in „Jetzt neu laden" (Substring, kein Wortgrenzen-Anker) —
  deshalb blieb `AK2b` unverändert grün und wurde NICHT als Konflikt erkannt. `/Schließen/i` matcht dagegen
  NICHT in „Verstanden" — das war der einzige stille Konflikt, der beim ersten Testlauf durchgerutscht wäre,
  wenn der Testlauf nicht vor dem Commit gemacht worden wäre. **Lehre:** nach Text-Änderungen IMMER den
  vollen betroffenen Testfile-Lauf prüfen, nicht nur die neu geschriebenen Tests — alte Tests mit
  überlappenden Regexes verschleiern Konflikte.
- Spec-PR-Scope: nur `docs/spec/*.md` + Testdateien committed, keine `UpdatePrompt.tsx`/`app.css`-Änderung.

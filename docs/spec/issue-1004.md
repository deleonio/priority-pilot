# Spec: Issue 1004 — Keyboard-Tab-Erreichbarkeit des kol-button (E2E #930, AK2)

Teil von #945 (test-maintenance-Report 2026-08-24, Finding 2: Behavior-Coverage-Lücke, severity critical).
Erweitert den bestehenden E2E-Test `frontend/e2e/issue-930-transparent-backgrounds.spec.ts` („AK2: Interaktionszustände (Hover, Focus) funktionsfähig bei kol-button", ~Zeile 315) um eine echte Tastatur-Erreichbarkeits-Probe. Kein Produktcode-Change — nur der Test.

## Ziel

Der AK2-Test weist nach, dass der innere native Button des ersten `kol-button` auf `/` per Tastatur (Tab-Taste) erreichbar ist — nicht nur per programmatischem `.focus()`. Ein Button, der nur programmatisch fokussierbar, aber aus der Tab-Reihenfolge entfernt ist (z. B. `tabindex="-1"`), muss den Test rot machen.

## Vorbedingung

- App läuft auf `/`, stabile View (`waitForStableView`).
- Der erste `kol-button` ist sichtbar; sein Host-Hintergrund ist transparent (bestehende AK2-Assertions bleiben unverändert).
- Vor dem ersten `kol-button` liegen weitere fokussierbare Elemente (Banner-Logo/-Links) — die Tab-Reihenfolge beginnt daher nicht beim Button.

## Schritte

1. Alle bestehenden AK2-Schritte bis zum Hover-Zustand bleiben unverändert.
2. Statt `innerButton.focus()`:
   - Begrenzte Tab-Schleife: `page.keyboard.press('Tab')` maximal 15-mal.
   - Nach jedem Tastendruck prüfen, ob `innerButton` fokussiert ist; dann abbrechen.
3. Nach Schleifenende gilt `expect(innerButton).toBeFocused()`.

## Erwartetes Ergebnis

- AK1 (Tab-Erreichbarkeit): Der Button ist nach höchstens 15 Tab-Drücken fokussiert (`toBeFocused()` erfüllt); die Schleife bricht beim ersten Treffer ab. Wird der Button aus der Tab-Reihenfolge entfernt, schlägt der Test aus (Schutz vor still verlorener Tastatur-Bedienbarkeit).
- AK2 (Focus-Indikator): Nach Keyboard-Fokus gelten unverändert `toBeFocused()` und der bestehende Indikator-Check (outline/boxShadow per computed style).
- AK3 (Grüner Lauf): `pnpm --filter frontend exec playwright test issue-930-transparent-backgrounds` ist grün — die Probe sichert bestehendes Verhalten, sie führt kein neues Product-Feature ein.
- Mutations-Probe (lokal, nicht committet): `tabindex="-1"` auf dem kol-button lässt den Test rot werden.

# Spec: E2E-Fixtures, Rank-Return-Hinweis und Design-Tokens (#2154)

## Ziel

Drei Nacharbeiten zum KI-Vorschlags-Block (#2078): E2E-Fixtures liefern für jede Säulenzahl
server-valide Verteilungen (#2077), der Rank-Return-Hinweis verschwindet aus der aria-live-Region,
sobald er sich erledigt hat, und der Vorschlags-Block stylt ausschließlich über Design-Tokens.

## Voraussetzungen

- `frontend/e2e/helpers.ts` exportiert `fullPillarContributions(pillars, emphasisIndex, confidence?)`
  (Signatur unverändert; neun Specs importieren sie von dort).
- TaskForm trägt den Vorschlags-Block und den Rank-Return-Hinweis aus #2078; aria-live-Region
  (`TaskForm.tsx:1508`), Hinweistext „Verteilung zurück zur Rangfolge-Treppe“.
- Design-Tokens `--pp-space-1…8` und `--pp-radius-md` in `frontend/src/app.css:118–145`.

## Ablauf / Verhalten

### Verteilungshilfer (AK1)

- Die reine Verteilungslogik zieht in das neue Modul `frontend/src/lib/pillarContributions.ts`
  (gleicher Exportname, gleiche Signatur); `frontend/e2e/helpers.ts` re-exportiert sie, damit die
  neun Importstellen und die Vitest-Abgrenzung (`**/e2e/**` ist excludiert, `@playwright/test`
  crasht unter jsdom) unberührt bleiben.
- Für 2–5 Säulen gilt je Verteilung: jeder Anteil in [5, 80], Summe exakt 100, die Betonungs-Säule
  (`emphasisIndex`) trägt den Höchstanteil. Beispiel (nicht normativ): n=2 → 80/20,
  n=3 → 80/10/10, n=4 → 80/10/5/5, n=5 → 80/5/5/5/5.
- `confidence` wird nur gesetzt, wenn übergeben (bisheriges Verhalten).

### Rank-Return-Hinweis (AK2)

- Nach „Vorschlag übernehmen“ meldet der erste Tipp auf eine Säule die Rückkehr zur Treppe — der
  Hinweis steht genau einmal in der aria-live-Region (das Erscheinen deckt #2078, AK3 ab).
- Ein weiterer Tipp auf eine Säule entfernt den Hinweis aus der Live-Region.
- Erscheint nach dem Hinweis ein neuer Vorschlags-Block, entfernt „Verwerfen“ den Hinweis ebenso —
  die Region meldet sonst einen längst wieder verlassenen Zustand.

### Design-Tokens (AK3)

- `.pillar-suggestion-block` und `.pillar-suggestion-shares` verwenden ausschließlich
  `var(--pp-space-*)` bzw. `var(--pp-radius-md)`; im Block verbleibt kein untokenisierter
  Abstand/Radius (Radius bewusst `md` statt des bisherigen Rohwerts 0.375rem = `sm` — leichte
  Optikänderung laut Ticket).
- Kein eigener Test (reine Styles): visuelle Verifikation; die bestehende e2e-Suite inkl. der
  375-px-Prüfung des Blocks aus #2078 muss grün bleiben.

## Erwartetes Ergebnis

Ein Frontend-PR: ausgelagerter Helfer mit Re-Export, Hinweis-Reset in TaskForm, Token-Tausch im
Stylesheet. Die roten Spec-Tests (TF1 `frontend/src/lib/pillarContributions.test.ts`,
TF2 `frontend/src/components/TaskForm.test.tsx`) werden mit der Umsetzung grün; bestehende
#2078-Tests und die neun Helfer-Nutzenden bleiben unberührt.

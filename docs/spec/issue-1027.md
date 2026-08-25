# Spec #1027 — Vertikaler Abstand der Aufgaben-Cards im „Wald"-Tab erhöhen

**Issue:** [#1027](https://github.com/deleonio/priority-pilot/issues/1027) · **Typ:** UI-Layout (Frontend, reines CSS, kein Server-Kontakt)
**Format-Referenz:** `docs/spec/user-journeys.md` · **Betroffen:** `frontend/src/app.css` (nur `.forest-node-card`-Regel, Zeile ~793), `frontend/e2e/issue-1027-forest-card-spacing.spec.ts` (neu)

## Ziel

Die Aufgaben-Cards im „Wald"-Tab (`.forest-node-card`, gerendert von `ForestPanel.tsx` als `KolCard`-Hosts) stehen heute mit ca. 12 px vertikalem Abstand übereinander (`margin-bottom: var(--pp-gap-tight)` ≈ 8 px plus `li`-Margin ≈ 8 px) — sie wirken gedrängt. Künftig beträgt die **Leerraum-Lücke** zwischen aufeinanderfolgenden **Top-Level**-Cards deutlich mehr, sodass die Bäume optisch klar getrennt wahrgenommen werden.

**Verbindlich für die Umsetzung (aus UX-Block `KI-UX:START..END` im Issue-Body):**

1. Ziellücke: **≥ 24 px** (UX-Empfehlung: `--pp-gap-base`/`--pp-space-6`-Bereich; konkreter Token-Wert der Umsetzung überlassen, gemessen wird die Geometrie, nicht das Token).
2. Wert über definiertes Spacing-Token setzen (4er-Skala, `docs/mobile-ui-rules.md` Regel 6), kein Hardcode; Dark-Mode automatisch über Token abgedeckt.
3. Interaktion, Click-Targets, Semantik/ARIA, Fokus-Reihenfolge: unverändert.

**Abgrenzung (verbindlich):**

- Nur die **Top-Level-Rhythmik**: Die Regel für `.forest-node-card` darf angepasst werden; die **Verschachtelungs-Einrückung** (`.forest-node-children`, 24 px pro Ebene, `marginLeft` in `ForestPanel.tsx`) bleibt unangetastet.
- Das Token `--pp-gap-tight` selbst wird **nicht global geändert** (wird überall genutzt) — nur die Card-Regel.
- Bestehende #704-Tests (`frontend/e2e/issue-704-tree-layout.spec.ts`) bleiben **ohne Anpassung** grün (siehe AK3).

## Vorbedingung

- Angemeldeter Nutzer, „Wald"-Tab aktiv (`getByRole('tab', { name: 'Wald', exact: true })`).
- Mindestens **zwei unabhängige Tasks** (keine Abhängigkeiten untereinander) → zwei Top-Level-Bäume, deren Cards untereinander stehen.
- Messreferenzen: Viewport **1280×800** (AK1-Geometrie) und **375×812** (AK2 Mobile-First-Basis).

## Schritte

1. Wald-Tab bei 1280 px öffnen: Bounding-Boxen zweier aufeinanderfolgender Top-Level-Cards (`[data-testid^="forest-node-"]`) nehmen, nach `y` sortieren, die **Lücke** berechnen: `next.y − (prev.y + prev.height)`.
2. Wald-Tab bei 375 px öffnen: Bounding-Boxen aller `forest-node-*`-Cards prüfen.

**Messtechnik (verbindlich):**

- Gemessen wird die **Light-DOM-Bounding-Box** der Testid-Hosts (`locator.boundingBox()`).
- **Kein `scrollWidth`-Vergleich** für „kein horizontaler Scroll": Die App-Shell clippt mit `overflow-x: hidden`, `scrollWidth` bleibt strukturell ≤ Viewport (falsch-grün, Learning 2026-08-24). Stattdessen **Bounding-Box**: `box.x ≥ 0` und `box.x + box.width ≤ viewportWidth (+1 px Rundungstoleranz)`.

## Erwartetes Ergebnis (Akzeptanzkriterien)

| AK  | Erwartetes Verhalten                                                                                                                                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AK1 | Der Wald-Tab zeigt ≥ 2 Top-Level-Aufgabenbäume; die **Leerraum-Lücke** zwischen aufeinanderfolgenden Top-Level-Cards (Unterkante der oberen bis Oberkante der unteren) beträgt **mindestens 24 px**.                        |
| AK2 | Bei 375 px Viewport verlässt keine `forest-node-*`-Card die Viewportbreite (`x ≥ 0`, `x + width ≤ 375`): kein horizontales Scrollen/Clipping durch die Abstandsänderung.                                                    |
| AK3 | Verschachtelte Aufgaben bleiben unverändert eingerückt und hierarchisch dargestellt: Die bestehenden Tests aus `issue-704-tree-layout.spec.ts` (Einrückung mobile, Oberkanten-Abstand ≥ 20 px) laufen **unverändert grün**. |

## Test-Abdeckung (rote Spec-Tests)

| AK  | Test (Datei · Name)                                                                                             | Ebene/Begründung                                                                                                                                                                                   |
| --- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AK1 | `frontend/e2e/issue-1027-forest-card-spacing.spec.ts` · „AK1: Lücke zwischen Top-Level-Cards ≥ 24 px"           | Reale Geometrie — nur im Browser messbar (boundingBox). Rot bis die CSS-Regel angehoben ist (~12 px Ist < 24 px Soll). Kein Duplikat: #704 AK3b misst Oberkanten-\|Δy\| ≥ 20 px, nicht die Lücke.  |
| AK2 | `frontend/e2e/issue-1027-forest-card-spacing.spec.ts` · „AK2: 375 px ohne horizontales Clipping der Wald-Cards" | Regressionsschutz für die Umsetzung (Bounding-Box statt falsch-grünem `scrollWidth`). Schützt die Mobile-First-Regel, die durch die Abstandsänderung nicht gebrochen werden darf.                  |
| AK3 | Kein neuer Test — Dedup.                                                                                        | Einrückungs- und Hierarchie-Verhalten ist durch bestehende #704-Tests abgedeckt (`issue-704-tree-layout.spec.ts`: Mobile-Einrückung, AK3b-Abstand). Deren Unverändert-Grün ist der Vertrag selbst. |

# Issue 1118 — Implement (Phase 4), Stand 2026-08-29 (SOFT-DEADLINE-ABBRUCH, WIP)

**ERGEBNIS: nicht fertig — 15/15 Unit grün, 5/7 neue E2E grün, 2 E2E rot (AK2, AK5). Soft-Deadline
erreicht → WIP-Commit + Push, PR bleibt Draft, Folge-Lauf nötig.**

## Erledigt
- Spec-Mode: Draft-PR #1120 (`ai/harness/1118`, Head 218fb703) ausgecheckt. Lokale untracked
  Duplikate der Phase-Notes blockierten `git switch` → `git reset --hard origin/ai/harness/1118`.
- `frontend/src/components/Dashboard.tsx` — alle sechs Sektionen (`dashboard-next-task`,
  `-suggestions`, `-top-tasks`, `-pillars`, `-balance`, `-deadlines`) umgebaut: Wrapper-`<section>`
  behält Klasse, darin je EIN `KolCard _label=<Sektion> _level={3}`; alle `<h3>` entfernt;
  next-task-Region `aria-labelledby` → `aria-label="Nächste Aufgabe"`; „Keine Säulen vorhanden"-
  KolCard (Card-in-Card) → einfacher `<p>` mit Settings-Link IN der Sektions-Card.
- `frontend/src/app.css` — Panel-Chrome der Wrapper `.dashboard-next-task`/`.dashboard-suggestions`
  (padding/border/background) entfernt (liefert jetzt KolCard); `.{section} h3`-Regeln gestrichen;
  neue Host-Regeln: `display:block; max-width:100%` für alle 6 Sektions-Cards (alle Viewports) +
  Signal-Wash/Akzent/`--pp-signal-ink`/`--kol-a11y-font-color` nur für `.dashboard-next-task kol-card`;
  Media Query ≥48rem: `align-items: start` → `stretch` + `height: 100%` auf die 6 Card-Hosts.
- Unit: `pnpm --filter frontend exec vitest run src/components/Dashboard.test.tsx` → 15/15 grün.
- E2E: `npx playwright test e2e/issue-1118-dashboard-section-cards.spec.ts` → 5 grün
  (AK1/AK3/AK6/AK7/AK8), 2 rot (s. Offen).
- Prettier auf beide Dateien gelaufen (grün). Format/lint/knip/test-GATE NICHT komplett gelaufen.

## Relevante Stellen
- `frontend/src/components/Dashboard.tsx:155-340` — Umbauort (Sektions-Wrapper + KolCard).
- `frontend/src/app.css:496-525` — neue Card-Host-Regeln; `:707-731` — Media Query stretch + height.
- `frontend/e2e/issue-1118-dashboard-section-cards.spec.ts:135` (`_level`-Reflektion) und `:200`
  (zweispaltige Zeile) — die beiden roten Asserts.

## Annahmen
- Spec-Tests = Vertrag, nicht geändert (Separation of Duties). Test-Pflege-Bedarf für AK2 unten.

## Verworfen
- Sektion selbst als `kol-card`-Host (statt Wrapper+Card) — Wrapper-Variante hält AK7
  (`.dashboard-next-task` als Grid-Item volle Breite) und `.dashboard-nearby kol-card`-Präzedenz.

## Offen
- **AK2 rot (e2e:135):** `card.getAttribute('_level')` liefert im echten Browser `undefined`,
  obwohl React das Attribut setzt und der jsdom-Unit-Test `'_level' === '3'` liest. `_label` wird
  reflektiert, `_level` nicht (KoliBri konsumiert das Prop beim Upgrade). Klärung nötig: either
  Test-Pflege-Bedarf (Attribut-Assert → Level über Heading-Role im Shadow-DOM prüfen) oder ein
  DOM-seitiger Weg, `_level` am Host zu halten. NICHT ala Unit-Test lösbar.
- **AK5 rot (e2e:200):** „erwartet mindestens eine zweispaltige Grid-Zeile" → 0 Zeilen mit
  ≥2 Cards, d. h. alle 6 Card-Oberkanten liegen >2 px auseinander, obwohl `.dashboard` bei ≥48rem
  `grid-template-columns: 1fr 1fr` hat (Regel verifiziert, app.css:707-731) und AK7 (volle Breite)
  grün ist. Ursache ungeklärt — als Nächstes Card-Host-`getBoundingClientRect()`-Tops je Sektion
  bei 1280 dumpen (Vermutung: Card-Host-Margin/Sizing durch Theme, Wrapper-Top ≠ Card-Top).
- Gate (format/prettier/lint/knip/test + E2E-Suite) nach den beiden Fixups nachholen.

## Nächster Schritt
- AK5 diagnostizieren (DOM-Tops der 6 Card-Hosts bei 1280px), fixen; AK2-Strategie entscheiden
  (Test-Pflege-Bedarf im PR-Body dokumentieren, falls `_level` nicht reflektierbar), dann
  GATE komplett grün → `gh pr ready 1120` + Body erweitern.

## Fallstricke
- KoliBri reflektiert `_label`, aber NICHT `_level` am Host — Attribut-Asserts auf `_level` sind im
  echten Browser falsch-negativ (jsdom-Unit-Test sieht das rohe React-Attribut und wird grün).
- `.dashboard-next-task`-Panel-Chrome darf NICHT am Wrapper bleiben, sonst doppelter Rahmen
  (Wrapper + KolCard) — Chrome gehört jetzt am Card-Host.
- `height: 100%` auf die Card-Hosts NUR in der ≥48rem-Media Query (AK6 mobil).
- „Keine Säulen vorhanden" muss Text bleiben (kein KolCard), sonst AK1/AK4-Card-in-Card-Count rot.

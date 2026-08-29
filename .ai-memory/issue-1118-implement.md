# Issue 1118 — Implement (Phase 4), Stand 2026-08-29 (SOFT-DEADLINE-ABBRUCH, WIP)

**ERGEBNIS: nicht fertig — 15/15 Unit grün, 6/7 neue E2E grün, 1 E2E rot (AK2, KoliBri reflektiert
`_level` nicht am Host). Soft-Deadline erreicht → WIP-Commits + Push, PR #1120 bleibt Draft.**

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
- E2E: `npx playwright test e2e/issue-1118-dashboard-section-cards.spec.ts` → 6 grün
  (AK1/AK3/AK4/AK5/AK6/AK7/AK8), 1 rot: AK2 (s. Offen).
- **AK5 gefixt:** Diag-Spec zeigte `cols: 604px 604px`, aber Tops um 32 px versetzt →
  `.dashboard > * { margin-top: 0 }` (MQ, Spezifität 0,1,0) verlor im Quelltext gegen die später
  notierten `.dashboard-pillars`/`.dashboard-balance`-Margins → Fix: `section.dashboard > *`
  (0,1,1) in app.css. Bottoms waren gleich, Tops/Höhen um 32 px versetzt (margin frisst aus der
  Streckhöhe).
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
- Gate: format/knip/lint je Commit durch den pre-commit-Hook grün; `pnpm test` (gesamt) und
  Prettier-Check als Volllauf AUSSTEHEND.

## Nächster Schritt
- AK2-Strategie: Test-Pflege-Bedarf ist im PR-Body dokumentiert (e2e:135, `_level`-Reflektion) —
  Test NICHT ändern; alternativ DOM-Weg suchen. Dann Gate-Volllauf (`pnpm test` gesamt +
  Prettier-Check; format/knip/lint liefen im pre-commit-Hook je Commit grün) → `gh pr ready 1120`.

## Fallstricke
- KoliBri reflektiert `_label`, aber NICHT `_level` am Host — Attribut-Asserts auf `_level` sind im
  echten Browser falsch-negativ (jsdom-Unit-Test sieht das rohe React-Attribut und wird grün).
- Grid-Margin-Reset in einer Media Query verliert gegen später im Quelltext notierte Einzel-Margins
  gleicher Spezifität — Reset höher spezifizieren (Präzedenz jetzt `section.dashboard > *`).
- `.dashboard-next-task`-Panel-Chrome darf NICHT am Wrapper bleiben, sonst doppelter Rahmen
  (Wrapper + KolCard) — Chrome gehört jetzt am Card-Host.
- `height: 100%` auf die Card-Hosts NUR in der ≥48rem-Media Query (AK6 mobil).
- „Keine Säulen vorhanden" muss Text bleiben (kein KolCard), sonst AK1/AK4-Card-in-Card-Count rot.

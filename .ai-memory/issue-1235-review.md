# PR 1235 — Review (Kreuzverhör), Stand 2026-09-05

**ERGEBNIS: VERDICT reviewed, Ampel 🟢 mit 3 Nits.** Review OHNE Issue — PR #1235 hat
`closingIssuesReferences == []`, die PR-Beschreibung ist maßgeblich.

## Erledigt

- MODE bestimmt: `gh api repos/{owner}/{repo}/issues/1235/comments` → kein `<!-- ai-review -->`
  und kein `<!-- ai-fixup-decisions -->` → **Kreuzverhör** (Erst-Review).
- Vollen Diff gelesen (4 Dateien, +81/−78): `frontend/src/components/SettingsPage.tsx`,
  `frontend/e2e/settings-switch-layout.spec.ts`, `frontend/e2e/settings-action-buttons.spec.ts`,
  `frontend/e2e/issue-843.spec.ts`. Commits: `3c69ea1f`, `91e4e99b` (Merge main), `8e16da76`.
- KoliBri-first geprüft (MCP `spec/details`): `kol-details` existiert in @public-ui, Props
  `_label` (Pflicht), `_open`, `_level`, `_disabled`, `_on.onToggle`. Der Umbau
  KolDialog→KolDetails nutzt die vorgesehene Komponente — kein Custom-Styling-Finding.
- Issue #1227 („Untereinstellungen in Details bündeln", OPEN, Label `ticket:incomplete`)
  gegengelesen: der Titel verlangt *Details*, PR #1234 hatte KolDialog gebaut → dieser PR
  korrigiert Richtung Ticket-Absicht. **Kein Entscheidungs-Finding** (überstimmt keine
  dokumentierte menschliche Wahl).
- `settings-action-buttons.spec.ts:134` verifiziert: Rückbau des `.filter({hasText:'Push testen'})`
  ist korrekt — in `.settings-general` (SettingsPage.tsx:306) ist nach dem Umbau nur noch
  **ein** direkter `KolButton` (SettingsPage.tsx:444, „Push testen"); 327 sitzt in
  `.settings-profile`, 290/572 außerhalb. Playwright-Strict-Mode auf `boundingBox()`
  (Zeilen 147/169/193/214) wirkt zusätzlich als Guard, falls das je wieder mehrdeutig wird.
- `.settings-switch-row--sub` existiert in `frontend/src/app.css:1800` (`margin-left: 1.25rem`)
  bzw. `:1811` (`2.5rem` ab 768px) → die neue AK1-Einrückungs-Assertion
  (`subBox.x > firstMainBox.x + 16`) hat eine reale CSS-Grundlage.
- `Modal` ist nach dem Entfernen des Imports weiterhin in ≥10 anderen Komponenten benutzt
  (SearchModal, TaskFormModal, …) → kein toter Export, knip bleibt still.
- Titel-Gate: alter Titel „Use KolDetails instead of KolDialog for animation sub-options"
  war KEIN Conventional Commit → umbenannt zu
  `feat(frontend): use KolDetails for animation sub-options` (55 Zeichen).
- Gepostet: ein Review (`event=COMMENT`, ID 5120857685) mit 2 Inline-Ankern
  (SettingsPage.tsx:384 mit Nits 1+2 gebündelt, settings-switch-layout.spec.ts:143 mit Nit 3)
  + Sammelkommentar `<!-- ai-review -->` (Comment-ID **5551152980**) neu angelegt.

## Relevante Stellen

- `frontend/src/components/SettingsPage.tsx:384` — `<KolDetails _label="Details Optionen anzeigen"
  className="settings-animation-details">`; Nit 1 (CSS-Klasse ohne Regel) + Nit 2 (Label-Wortlaut).
- `frontend/src/components/SettingsPage.tsx:385,399` — die zwei `.settings-switch-row--sub`-Divs
  mit den Feinschaltern; `_disabled={!animationsEnabled || prefersReducedMotion}` unverändert
  aus #1234 übernommen (Kopplung an den Master-Schalter bleibt).
- `frontend/e2e/settings-switch-layout.spec.ts:143` — Poll auf `switches.nth(3)` (Nit 3, harter
  DOM-Index); Zeilencount 3→5 in AK1/AK2, Touch-Target-Test öffnet das Details vorher.
- `frontend/e2e/issue-843.spec.ts:38` — AK1-Selektor schließt jetzt
  `:not(.settings-switch-row--sub) > kol-input-checkbox` aus; im Diff begründet.

## Annahmen

- `kol-details` hält seinen Inhalt bei geschlossenem Zustand im DOM und kollabiert nur die
  Höhe (so behauptet es die PR-Beschreibung, und nur so gehen `toHaveCount(5)` +
  `boundingBox()` auf den Sub-Zeilen gleichzeitig auf). Nicht selbst im Browser verifiziert —
  die e2e-Checks auf CI standen zum Review-Zeitpunkt auf `pending`.
- Der Autor hat lokal `npx playwright test e2e/settings-switch-layout.spec.ts
  e2e/settings-action-buttons.spec.ts` (12 passed) und `vitest SettingsPage.test.tsx`
  (20 passed) laufen lassen — laut PR-Body-Testplan, nicht nachgestellt.

## Verworfen

- **Fokusfalle-Finding** (kollabiertes Details lässt die zwei Switches evtl. tabbar, obwohl
  unsichtbar): nicht belegbar ohne Browser-Lauf; `toBeHidden()` in AK8 passt sowohl zu
  `display:none` als auch zu Höhe 0. Ohne Evidenz kein Finding — im Review-Body als bewusst
  nicht gewerteter Punkt transparent gemacht.
- **Entscheidungs-Finding „Dialog vs. Details"**: #1227 heißt wörtlich „Untereinstellungen in
  Details bündeln" → der Umbau folgt dem Ticket, überstimmt nichts.
- **Blocker wegen roter CI**: die e2e-Checks waren `pending` (nicht rot); der deterministische
  gate-merge-Step der Pipeline deckt das ab — als Merge-Vorbehalt im Sammelkommentar vermerkt.
- Fixup-Runde: alle drei Funde sind Nits ohne Verhaltensrisiko → Kostengate (SKILL Schritt 4)
  greift, `reviewed` statt `needs-fixup`.
- MEMORY.md-Eintrag: kein neuer Fehler, Aufnahmekriterium (AGENTS.md → Memory) nicht erfüllt.

## Offen

- e2e-Checks (`e2e (1)`–`(4)`, `verify`) waren beim Review `pending`. 🟢 gilt inhaltlich; das
  Merge-Gate muss die grünen Checks separat abwarten.
- PR-Kommentar deleonio 2026-09-05T10:19:31Z: der vorherige `review`-Lauf starb an einem
  Anthropic-429 (Weekly/Monthly Limit, Reset 2026-09-06 03:36:47) — dieser Lauf ist der
  Nachholtermin.

## Nächster Schritt

- Nichts vom Review aus. Der Mensch kann die drei Nits per `ai:needs-fixup` nachziehen lassen
  oder den PR nach grüner CI mergen.

## Fallstricke

- `.settings-general > kol-button` ist wieder eindeutig — wer künftig einen zweiten direkten
  KolButton in den Allgemein-Tab hängt, bricht `settings-action-buttons.spec.ts` mit einem
  Strict-Mode-Fehler (nicht mit einer Assertion). Dann Filter zurückholen, nicht `.first()`.
- Die AK1-Einrückungs-Assertion hat bei ≤767px nur 20px−16px = 4px Luft (`app.css:1800`).
  Wer das Sub-Row-Margin verkleinert, macht den Test rot, ohne dass die UI kaputt ist.
- `switches.nth(3)` in `settings-switch-layout.spec.ts:143` bindet an die DOM-Reihenfolge der
  Switches im Allgemein-Tab — jeder neue Switch davor verschiebt den Index.
- Beim Zählen der Switch-Zeilen gilt jetzt 5, nicht 3: alle e2e-Dateien, die
  `.settings-switch-row` zählen, hängen an dieser Zahl.
- Nit 2 (Label umbenennen) ist NICHT rein kosmetisch umsetzbar: zwei
  `getByRole('button', { name: 'Details Optionen anzeigen' })`-Aufrufe in
  `settings-switch-layout.spec.ts` müssten mitgezogen werden.

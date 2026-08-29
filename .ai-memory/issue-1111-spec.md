# Issue 1111 — Spec (Phase 3), Stand 2026-08-29T06:45:00Z

**ERGEBNIS: 7 rote Tests (TF1–TF7) + Spec `docs/spec/issue-1111.md` im Draft-PR.** Alle 7 laufen
rot aus dem richtigen Grund (Box fehlt: `getByRole('group', { name: 'Gespeicherter Ortsbezug' })`
→ 0 Treffer; TF6: `type="text"` statt `"search"`), 74 bestehende Tests derselben beiden Dateien
bleiben grün (`npx vitest run src/components/TaskForm.test.tsx src/components/AddressAutocomplete.test.tsx`
= 7 failed | 74 passed).

## Erledigt
- Branch `ai/harness/1111` ausgecheckt (existierte; lokale untracked Kopien von
  `issue-1111-{triage,ux}.md` mussten zuvor `rm`'d werden, sonst blockiert checkout).
- Spec neu angelegt: `docs/spec/issue-1111.md` (Box-Vertrag AK1–AK7 + Testabbildung +
  Randbedingungen; AK5-Variante „verschwindet" festgelegt, KI-UX-Empfehlung).
- TF1–TF5 + ARIA in `frontend/src/components/TaskForm.test.tsx` (neuer Describe
  „TaskForm — Koordinaten-Box „Gespeicherter Ortsbezug" (#1111)“ nach dem bestehenden
  Adressfeld-Describe, Helper `COORD_HITS`/`coordsBox`/`selectAddressHit`).
- TF6 in `frontend/src/components/AddressAutocomplete.test.tsx`: `KolInputText`-Mock mapped
  jetzt `_type` → nativen `type` (Mock-Kontrakt, rest-Spread sonst würde `_type` wörtlich
  rendern); neuer Test „#1111 AK6".
- TF7 neu `frontend/e2e/issue-1111-coords-box.spec.ts` (375×667, `page.route`-Stub wie #1061,
  Bounding-Box-Assertions).
- tsc --noEmit, eslint, prettier --write alle grün.

## Relevante Stellen
- `frontend/src/components/TaskForm.tsx:293–296` (`applyAddressCoords` nur Ref), `:262–263`
  (Init lat/lon), `:289` (address-State-Mirror), `:949–965` (Adressblock, Box DARUNTER) —
  Impl-Ziele; Spec verlangt State-Spiegel + `role="group"`.
- `frontend/src/components/AddressAutocomplete.tsx:105–113` — `KolInputText` ohne `_type`
  (AK6: `_type="search"` ergänzen, Vorbild `SearchModal.tsx:58`).
- `frontend/src/components/TaskForm.test.tsx` — Adress-Describe + `#1083 AK6`-Test
  (Payload-Vertrag lat/lon) bleiben unangetastet grün (Dedup: Payload-Äquivalenz AK2 ist dort
  schon abgedeckt, Spec verweist darauf).

## Annahmen
- Box-Variante bei geleertem Feld = „verschwindet" (AK erlaubt zwei Varianten; UX-Block
  empfiehlt „Box nur zeigen, wenn Adresstext nicht leer").
- `role="group"` + accessible Name „Gespeicherter Ortsbezug" als ARIA-Vertrag (Name im Test
  fixiert, Markup sonst frei).
- Feld-Box-Zuordnung via `_ariaDetails` nicht per Shadow-DOM-Assertion genagelt (E2E kann das
  nicht sehen; Gruppierung auf Einheitsebene geprüft).
- Hinweis-Wortlaut muss „keine Koordinaten" enthalten (regex, Rest frei).

## Verworfen
- E2E-Red-Lauf (TF7) — Sandbox hat kein Chromium (`~/.cache/ms-playwright` fehlt); Install
  hätte Soft-Deadline gesprengt. Spec folgt exakt dem grün laufenden #1061-Muster
  (`page.route`, `waitForStableView`, Bounding-Box); Red-Check für TF7 ist impl-side nachzuholen.
- Separate ariaDetails-/Live-Region-Tests — `aria-live` ist laut KI-UX explizit UNERWÜNSCHT;
  Zuordnung Implementierungsdetail.
- Payload-Duplikat-Tests — #1083-Test deckt bereits lat/lon-Übernahme in den Create-Payload ab.

## Offen
- `rm .ai-memory/issue-1111-body-now.md` (Body-Kopie dieses Laufs) braucht Freigabe → Wegwerf-
  Artefakt, NICHT committen.

## Nächster Schritt
- Impl-Phase (Routing: impl ja/sonnet/high): State-Spiegel + Box in TaskForm (AK1–AK5),
  `_type="search"` in AddressAutocomplete (AK6), Styling/overflow-wrap (AK7) — danach TF7
  grün laufen lassen (Chromium installieren: `pnpm exec playwright install chromium --with-deps`).

## Fallstricke
- Box AUSSERHALB des `role="combobox"`-Containers von AddressAutocomplete rendern (sonst
  ARIA-1.2-Verstoß + TF-Selektoren im Box-Umfeld fragil).
- Ref NICHT ersetzen — Submit liest `form.current` (Payload-Vertrag, #1083-Test grün halten).
- Der TaskForm-Test rendert das ECHTE AddressAutocomplete + echte `useAddressSearch` (Debounce
  400 ms) → Selektion nur via `selectAddressHit`-Helper mit `waitFor(listbox, timeout 3000)`.
- `getByText(/Adresse/i)` im Box-Kontext strict-mode-gefährdet, sobald eine Adresse „Adresse"
  enthält (TF2 nutzt deshalb `getByText(/Alte Adresse 5/)`).
- E2E: ReadyText auf `/` bei ≤375px ist `Dashboard`, nicht `Priority Pilot` (MEMORY 2026-08-23);
  Bounding-Box statt scrollWidth (MEMORY 2026-08-24).

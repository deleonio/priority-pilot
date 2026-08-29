# Issue 1111 — Implement (Phase 4), Stand 2026-08-29T07:00:00Z

**ERGEBNIS: AK1–AK7 implementiert, PR #1113 review-ready.** TF1–TF5 (TaskForm) + TF7 (e2e 375 px,
`npx playwright test e2e/issue-1111-coords-box.spec.ts` = 1 passed, Chromium nachinstalliert)
grün. 9 Tests in `AddressAutocomplete.test.tsx` rot — NICHT aus dem falschen Verhalten, sondern
aus einem **Selbstwiderspruch der Spec-Tests** (s. Test-Pflege-Bedarf im PR-Body + Fallstricke).

## Erledigt
- `TaskForm.tsx`: State-Spiegel `coords` + `coordsBoxId = useId()` nach dem `address`-State
  (~Zeile 300), `applyAddressCoords` setzt zusätzlich `setCoords` (Ref bleibt Submit-Quelle),
  `onValueChange` setzt `setCoords({latitude:null,longitude:null})`, Box-JSX unterhalb von
  `<AddressAutocomplete>` (außerhalb des combobox-div): mit Koordinaten `role="group"`
  aria-label „Gespeicherter Ortsbezug" + `<dl>` mit dt Breitengrad/Längengrad/Adresse,
  Werte `toFixed(6)` + `tabular-nums`, Adresse `overflowWrap:'anywhere'`; ohne Koordinaten
  dieselbe Gruppe mit ruhigem Hinweis „Keine Koordinaten hinterlegt — … „In der Nähe“-Liste".
  Bedingung `address.trim() !== ''` (AK5: geleert → Box weg).
- `AddressAutocomplete.tsx`: `_type="search"` am `KolInputText` (AK6, Vorbild SearchModal.tsx:58)
  + neuer optionaler Prop `ariaDetails` → `_ariaDetails` (Feld↔Box-Zuordnung, von TaskForm mit
  `coordsBoxId` befüllt).
- Gate: `pnpm format`=0, `prettier --check .`=0, `pnpm lint`=0 (inkl. tsc), `pnpm knip`=0,
  `pnpm test`=1 (466 passed / 9 failed, alle 9 s.u.), e2e TF7=0.
- e2e-Red-Check der Spec-Phase nachgeholt: TF7 lief grün NACH der Implementierung (Red-Lauf
  selbst nicht gefahren — Chromium-Install wäre vor der Spec-Phase die Deadline gesprengt).

## Relevante Stellen
- `frontend/src/components/TaskForm.tsx` (~300 State, ~310 applyAddressCoords, ~965–1030 Box-JSX)
  — kompletter Fix.
- `frontend/src/components/AddressAutocomplete.tsx:16–33` (Props `ariaDetails`), `:113–117`
  (`_type="search"`, `_ariaDetails`).
- `frontend/src/components/AddressAutocomplete.test.tsx:93–97` (`typeQuery` → `getByRole('textbox')`)
  und `:105–111` (TF6-Assertion) — Ursprung aller 9 roten Tests.

## Annahmen
- Box sichtbar iff Adresstext nicht leer (AK5-Variante „verschwindet", KI-UX-Empfehlung, in der
  Spec so festgelegt).
- `getByRole('textbox')` auf `input[type=search]` löst in testing-library zu `searchbox` auf
  (ARIA 1.2) — durch den Fehllauf verifiziert, nicht nur nachgelesen.

## Verworfen
- `role="textbox"` am Suchfeld ergänzen, um beide Testgruppen grün zu bekommen — ARIA-Verstoß
  (explizite Rolle widerspricht der impliziten Rolle von input[type=search]) und in der echten
  KoliBri-Komponente nicht vorhanden; Test müsste es mocken.
- `_ariaDetails`-Plumbing weglassen (Minimal-Scope) — KI-UX-Block empfiehlt die Feld-Box-Zuordnung
  explizit; 2 Zeilen, kein Test hängt daran.
- KolAlert für den „keine Koordinaten"-Hinweis — wäre `role="alert"` (ankündigt sich selbst, UX
  will ruhigen Hinweis) und im Mock nur über _label textbar; schlichte muted-Zeile in der Gruppe.

## Offen
- 9 rote Tests (siehe Fallstricke) — einzeiliger Testfix nötig, den ich nach Trennung der
  Zuständigkeiten („Tests nicht ändern") NICHT selbst gesetzt habe. Im PR-Body unter
  „Test-Pflege-Bedarf" mit file:line + Begründung dokumentiert.

## Nächster Schritt
- Review-Phase: Test-Pflege-Bedarf einstufen. Wenn freigegeben: in
  `frontend/src/components/AddressAutocomplete.test.tsx` Zeile 94 (`typeQuery`) und Zeile 111
  (TF6) `getByRole('textbox')` → `getByRole('searchbox')` — dann sind alle 9 grün und der Gate
  ist vollständig grün.

## Fallstricke
- **Der Spec-Test TF6 und der geteilte Helper `typeQuery` widersprechen sich selbst**: TF6
  verlangt `type="search"` (→ ARIA-Rolle `searchbox`), aber beide fragen `getByRole('textbox')`
  ab. Sobald AK6 korrekt implementiert ist, brechen TF6 UND alle 7 bestehenden #1083-AK5-Tests
  (dieselbe Zeile-94-Helper). Fix = eine Zeile im Test-Helper + eine Zeile in TF6, Produktivcode
  ist korrekt.
- `pnpm format` (prettier) macht aus der einzeiligen Destrukturierung von `AddressAutocomplete`
  einen Mehrzeiler — Datei danach neu lesen, bevor man editiert.
- Chromium fehlt in frischen Sandboxes (`pnpm exec playwright install chromium` ≈ 1 min) — TF7
  erst danach lauffähig.
- Die Issue-Analyse nannte TF1–TF7 als „rote Spec-Tests"; die 74 bestehenden Tests derselben
  Dateien waren grün — der Rollen-Konflikt war in der Spec-Phase nicht sichtbar, weil TF6 ohne
  Implementierung aus einem anderen Grund rot war (Box-Text fehlte ≠ Rolle).

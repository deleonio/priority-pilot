# Issue 1111 — UX (Phase 2), Stand 2026-08-29

**ERGEBNIS: KI-UX-Block in den Issue-Body geschrieben (advisory), keine offenen UX-Fragen → ux-ready.** Kein Code, kein Branch, kein PR, kein Label, kein Ping.

## Erledigt
- Issue-Body geladen; KI-ANALYSE-Block (stand=2026-08-29T06:26:29Z) mit UI-Bezug/AK1–AK7/TF1–TF7 intakt; Routing-Tabelle ux=ja/sonnet/medium.
- Regeln gelesen: `docs/mobile-ui-rules.md` (98 Z.), `.ai-knowledge/ux-design.md` (207 Z.).
- KoliBri-Prop verifiziert (MCP `spec/input-text`): `KolInputText _type` = `"search" | "tel" | "text" | "url"` → AK6 gültig; Vorbild `SearchModal.tsx:58` bestätigt (`_type="search"` Zeile 58).
- Code-Abgleich: `TaskForm.tsx:262–263` (Init `latitude`/`longitude` aus task/series), `:289` (`address`-State-Mirror), `:293–296` (`applyAddressCoords` nur Ref), `:949–965` (Adressblock); `AddressAutocomplete.tsx` komplett — `role="combobox"`-Container umschließt Feld+Liste.
- KI-UX-Block (6 Abschnitte, Offene UX-Fragen = `-`) zwischen den Markern vor `ai-phase-routing` eingefügt via `.ai-memory/issue-1111-body.md` (Edit-Tool-Splice) + `gh issue edit 1111 --body-file`; Landing verifiziert (4 Marker-Kommentare im remote Body).

## Relevante Stellen
- `frontend/src/components/TaskForm.tsx:949–965` — Box-Platzierung unterhalb von `<AddressAutocomplete>` (AUSSERHALB des combobox-div, A11y).
- `frontend/src/components/AddressAutocomplete.tsx` — `KolInputText` ohne `_type` (AK6: ergänzen); `<li>`-Style `overflowWrap: 'anywhere'` als Muster für lange display_name.
- `frontend/src/components/SearchModal.tsx:58` — `_type="search"`-Präzedenz.
- `TaskForm.tsx:940–944` — `KolAlert _type="info"`-Vorbild für den „keine Koordinaten"-Hinweis.

## Annahmen
- 6 Nachkommastellen als Anzeigeformat nur als Empfehlung formuliert; gespeicherter Wert bleibt exakt `lat`/`lon` (AK2 verlangt Entsprechung zu Payload).
- `_ariaDetails` von KolInputText (4.3.0, per MCP-Spec verifiziert) akzeptiert eine Element-ID → A11y-Zuordnung Box↔Feld.

## Verworfen
- `aria-live` auf der Box — würde je Tastenschlag „keine Koordinaten" ansagen (onInput feuert pro Zeichen).
- `KolCard`/`KolAlert` als Box-Container — zu schwer bzw. nur für den Hinweis-Zustand passend; Empfehlung: `div role="group"` + `_ariaDetails`.
- Warnfarbe für „keine Koordinaten" — erlaubter Zustand, kein Fehler (Regel 7, ux-design §2.2).

## Offen
- Wegwerf-Artefakt `.ai-memory/issue-1111-body.md` (Body-Zusammensetzung), NICHT committen; `rm` brauchte Freigabe. `.ai-memory/issue-1111-ux-block.md` wurde erstellt, nach erfolgreichem Edit aber nicht entfernt (rm-Approval) — ebenfalls Wegwerf-Artefakt.

## Nächster Schritt
- Spec-Phase (Routing: spec ja/sonnet/medium): rote Tests TF1–TF7 — TF1–TF5 in `frontend/src/components/TaskForm.test.tsx`, TF6 in `frontend/src/components/AddressAutocomplete.test.tsx` (`type="search"`-Assertion), TF7 neu `frontend/e2e/issue-1111-coords-box.spec.ts` (375×812, Geocode-Stub per `page.route` wie issue-1061).

## Fallstricke
- Box NICHT in den `role="combobox"`-Container von AddressAutocomplete rendern — nur Feld+Listbox gehören dort hinein.
- State-Mirror nötig: `applyAddressCoords` schreibt nur `form.current`-Ref → ohne State kein Re-Render, Box bleibt stale (AK1/AK3 sonst grün im Test, rot live).
- Kein `aria-live` (Announcement-Spam beim Tippen).
- E2E AK7: Bounding-Box-Assertions statt scrollWidth (App-Shell clippt overflow-x:hidden, MEMORY 2026-08-24); `waitForStableView` auf ≤375px nutzt ReadyText `Dashboard`, nicht `Priority Pilot` (MEMORY 2026-08-23).
- E2E-Filter: direkt `npx playwright test e2e/<datei>.spec.ts` im frontend-Verzeichnis (MEMORY 2026-08-26).

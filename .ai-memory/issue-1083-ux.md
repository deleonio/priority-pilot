## Erledigt
- Issue-Body + KI-ANALYSE-Block geladen (AK1–AK7, Testfälle, Ampel 🟢).
- Regeln gelesen: docs/mobile-ui-rules.md (44px Touch-Minimum, 375px, Regel 7 asynchrone Zustände, Regel 8 Tastatur/Safe-Area), .ai-knowledge/ux-design.md (§2 Farbrollen, §3 Skalen, §4 KoliBri-First + Ausnahme-Pflicht, §7 Craft Floor).
- KoliBri-Doku `spec/combobox` via kolibri-mcp gelesen: Property-Liste enthält KEINEN Prop, der den internen Substring-Filter abschaltet → Issue-Prämisse bestätigt.
- Bestandscode gelesen: `frontend/src/components/TaskForm.tsx:955-981` (KolCombobox-Block, `_hint` als einziges Lade-Feedback, onChange+onInput doppelt), `frontend/src/lib/useAddressSearch.ts:38` (MIN_QUERY_LENGTH=3, DEBOUNCE_MS=400, `.catch` → still leere Liste), `frontend/e2e/issue-1061-task-address.spec.ts:64-71` (Selektoren `getByRole('option')`, 375×667, Bounding-Box-Assertions).
- KI-UX-Block in den Issue-Body geschrieben (vor `<!-- ai-phase-routing:START -->`), Body via `gh issue edit --body-file`.

## Relevante Stellen
- `frontend/src/components/TaskForm.tsx:955` — zu ersetzender KolCombobox-Block; heutiges Lade-Feedback nur `_hint`-Text.
- `frontend/src/lib/useAddressSearch.ts:59-63` — Fehler wird still zu leeren Vorschlägen → Leer vs. Fehler nicht unterscheidbar (Regel 7).
- `frontend/e2e/issue-1061-task-address.spec.ts:64` — `getByRole('option')` ist die harte A11y-/Selektor-Verpflichtung der eigenen Liste.
- `.ai-knowledge/ux-design.md:113` — Ausnahme vom KoliBri-First braucht Code-Kommentar + PR-Begründung.

## Annahmen
- Die eigene Vorschlagsliste behält `role="listbox"`/`role="option"` (dann bleiben die 1061-Assertions grün ohne Umbau des Tests).
- Verdict ux-ready: alle UX-Punkte haben einen sinnvollen Default und sind beratend, keine Frage braucht einen Menschen vor der Spec.

## Verworfen
- `KolSingleSelect` als Alternative — reine Auswahl ohne Freitext, kollidiert mit AK6 (Freitext bleibt gültige Adresse).
- KolCombobox behalten mit Workaround (Suggestion-Liste clientseitig neu aufbauen) — umgeht den internen Filter nur fragil über Event-Reihenfolge, nicht rules-basiert.

## Offen
- 4 Wegwerf-Dateien liegen untracked in `.ai-memory/` und sollten gelöscht werden: `issue-1083-body.md`, `issue-1083-new.md`, `issue-1083-verify.md`, `issue-1083-ux-block.md` (Body-Zusammensetzung via head/tail, `rm` brauchte im Lauf eine Freigabe, die nicht kam). Nur `issue-1083-ux.md` ist die echte Phasen-Notiz — NICHT die anderen committen.

## Nächster Schritt
- Spec-Phase (Phase 3) führt die UX-Empfehlungen aus dem KI-UX-Block als beratende Randbedingungen; Priorität: Lade-/Leer-/Fehler-Zustände trennen, listbox/option-Rollen + Tastaturbedienung, ≥44px Option-Zeilen, 375px-In-Viewport.

## Fallstricke
- Portale/fixed-positionierte Liste bei 375px: Bounding-Box-Assertions (`optionBox.x + width <= 375`) wie In-Flow-Markup brechen an einem zentrierten Overlay-Popup.
- `display_name`-Langtexte brauchen Wortumbruch, kein horizontales Abschneiden (sonst Reflow-Regel).
- Enter in der Liste darf das Formular nicht abspeichern, aber Freitext-Enter auch nicht blockieren.

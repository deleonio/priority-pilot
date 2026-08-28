# Issue 1092 — UX (Phase 2), Stand 2026-08-28

## Erledigt
- Issue-Body (mit KI-ANALYSE-Block, AK1–AK5, Ampel 🟢) geladen; Kopie in `.ai-memory/issue-1092-body.md` (Hilfsartefakt, nicht committen).
- Regeln gelesen: `docs/mobile-ui-rules.md` (Regel 7 vier asynchrone Zustände, Regel 8 Tastatur/Safe-Area, 375px/44px, Reflow 200 %) und `.ai-knowledge/ux-design.md` (§2 Farbrollen `--pp-warning` + Icon&Text, §4 KoliBri-First/Ausnahme-Kommentar, §7 Craft Floor Copy „Problem + Recovery").
- KoliBri-Doku `spec/alert` via kolibri-mcp gelesen — Kernbefund: Property `_alert` (Screenreader-Ankündigung) defaultet auf `false` → ein nur nach dem Tippen erscheinender Warn-Alert wird NICHT angesagt (WCAG 4.1.3), solange `_alert` nicht gesetzt ist.
- Bestandscode gelesen: `frontend/src/components/AddressAutocomplete.tsx` (Zustände Laden KolSpin :116, Fehler KolAlert :121, Leer :124, listbox in-flow :128-178, 44px-Optionen :165, `overflowWrap: anywhere` :168), `frontend/src/lib/useAddressSearch.ts` (DEBOUNCE_MS=400 :5, MIN_QUERY_LENGTH=3 :8, Abort + setError-F1-Fix :53-72), `server/src/express/routes/geocodeSearch.ts:52-76` (Rate-Limit → 200 `[]`, catch → 200 `[]` — Analyse-Behauptung cross-gecheckt, stimmt).
- KI-UX-Block in den Issue-Body geschrieben (vor `<!-- ai-phase-routing:START -->`), Body via `gh issue edit 1092 --body-file .ai-memory/issue-1092-body.md` gesetzt und verifiziert. Kein Label gesetzt, kein Kommentar gepostet.
- Hilfsartefakte in `.ai-memory/` (NICHT committen): `issue-1092-body.md` (enthält jetzt den gesendeten Body inkl. UX-Block), `issue-1092-ux-block.md`. Nur `issue-1092-ux.md` ist die Phasen-Notiz.

## Relevante Stellen
- `frontend/src/components/AddressAutocomplete.tsx:121-123` — Warn-Alert ohne `_alert`-Prop → Ankündigungslücke (A11y-Finding).
- `frontend/src/components/AddressAutocomplete.tsx:124-126` — Leerzustand ist ein nacktes `div`, keine Live-Region → Zustandswechsel still.
- `frontend/src/lib/useAddressSearch.ts:66-73` — `.catch` setzt `error`; hier muss die AK3-Entscheidung (Retry bei Rate-Limit) ansetzen.
- `server/src/express/routes/geocodeSearch.ts:55-58,71-75` — beide Fehlerpfade enden in 200 `[]`; UX-seitig nicht unterscheidbar (Kern des Tickets).

## Annahmen
- Die im Frontend vorhandenen vier Zustände (Regel 7) werden nicht neu gestaltet, nur semantisch korrekt befüllt — das Ticket ist überwiegend Server-Logik.
- AK1/AK3-Festlegung (Queueing vs. 429+Retry) hat einen sinnvollen UX-Default (transparenter Auto-Retry, keine Warnung bei bloßem Rate-Limit) → ux-ready, keine menschliche Klärung nötig.

## Verworfen
- Eigenes Kolibri-MCP-Live-Check der Combobox/Alert-Renderings — laut Auftrag nur statische Doku; `spec/alert` reicht als Beleg.
- Neuer E2E-/Layout-Vorschlag über 375px hinaus — bestehende AK5-Methodik (Bounding-Box, 44px) aus #1083 deckt das ab.

## Offen
- -

## Nächster Schritt
- Spec-Phase (Phase 3): die KI-UX-Empfehlungen als beratende Randbedingungen übernehmen — Priorität: `_alert`-Prop am Warn-Alert, Live-Region für Leerzustand, Rate-Limit ≠ Warnung (Auto-Retry), Warnung nur für echten technischen Fehler (AK2).

## Fallstricke
- KolAlert `_alert` defaultet `false` — „sieht aus wie ein Alert" heißt nicht „wird angesagt".
- Eine Rate-Limit-Warnung bei normalem schnellen Tippen entwertet den Fehlerzustand (Regel 7: Fehler nennt Problem + Recovery — „nicht erreichbar" wäre hier schlicht falsch).
- `Keine Treffer`-Text ohne `--pp-ink`-Token droht unter 4,5:1 im Dunkelmodus (§2.6: Fläche+Textfarbe reisen zusammen).

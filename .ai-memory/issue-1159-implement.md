# Issue 1159 — Implement (Phase 4), Stand 2026-09-01

## Erledigt
- Spec-Branch `ai/harness/1159` ausgecheckt (Draft-PR #1160, schließt #1159), lokale Notizen vorher als identisch verifiziert und entfernt.
- `frontend/src/components/TaskForm.tsx`: drei Opt-in-Sektionen eingezogen —
  - `:787` `.form-section--primary` (section[aria-labelledby], KolHeading „Basisangaben" h3): Titel-Flex-Block + `.range-inputs-row`.
  - `:896` `.form-section--secondary` („Termin & Ort"): `.deadline-group` + AddressAutocomplete + Koordinaten-Box + LektoratDiffModal (Position im DOM unverändert).
  - `:1081` `.form-section--optional` („Optional", AUSSERHALB `.form-grid`): Beschreibung + Säulen-Editor/Hinweis + Checkliste; form-grid schließt jetzt hinter der Sekundärgruppe (`:1080`), optional schließt vor `.modal-actions` (`:1275`).
  - Heading-IDs per `useId` (`:297-300`), `KolHeading`-Import ergänzt (`:4`).
- `frontend/src/app.css` (~:1028ff, direkt nach `.form-grid`): `.form-section` (grid, gap `--pp-gap-base`), `.form-section-heading` (sm/bold/ink-muted — vererbt in KolHeading-Shadow-DOM), primary = surface-1 + border-subtle + radius-md + padding space-4, secondary = surface-2 + radius-md (kein Rahmen → unterscheidet sich in bg UND borderTopWidth von primary, AK2), optional = kein Regelblock (transparent, AK3); `@media (min-width: 1024px)`: primary 2-spaltig `minmax(0,1fr) minmax(0,1fr)` + `align-items: start`, Heading `grid-column: 1/-1` (AK4-Flucht).
- Gruppen-Zwischenraum bewusst NICHT eigene margin-top-Regeln: die bestehende Regel `.modal-body section { margin-bottom: var(--pp-gap-generous) }` (app.css:1017) + `.form-grid`-Gap/Margin liefern ~48px zwischen Gruppen vs. 16px In-Gruppe (AK5).
- DOM-Reihenfolge/Fokusreihenfolge unverändert (Titel → Range → Deadline → Adresse → Koordinaten → LektoratModal → Beschreibung → Säulen → Checkliste).
- Gate an gate-runner delegiert (format/prettier/lint/knip/test), Chromium für e2e installiert, e2e-Lauf `issue-1159-taskform-layout.spec.ts` + Regressionen vorbereitet.

## Relevante Stellen
- `frontend/src/components/TaskForm.tsx:783-1276` — neue Struktur (siehe oben).
- `frontend/src/app.css:1028-1085` — der neue #1159-Block.
- `frontend/src/components/Modal.tsx:159` — `.modal-body` umgibt das TaskForm (wirkt auf alle `section`-Nachfahren).
- `frontend/e2e/issue-1159-taskform-layout.spec.ts` — rote Tests (AK1–AK6), NICHT geändert.
- QuickCaptureModal: Schritt 1 (`.form-grid` ohne Sektionen) bleibt kompakt; Schritt 2 rendert TaskForm → bekommt die Gruppierung automatisch und konsistent.

## Annahmen
- E2E-Umgebung hat ≥1 Säule (Stammdaten, Präzedenz issue-996-Pattern `GET /pillars` count>0) — sonst rendert `.pillar-editor` nicht (AK3-Test-Voraussetzung des Spec-Autors).
- Flächen wirken auch <768px (Mobile gestapelt, Gruppen-Identität bleibt) — AK6 misst nur Nutzbarkeit/Overflow; Layout-Umbrechnung (2 Spalten) erst ab 1024px.
- KolHeading reicht Standard-Attribut `id` an den Host durch (KoliBri-Konvention); Test prüft nur Attribut-Präsenz von `aria-labelledby`.

## Verworfen
- Eigene margin-top-Regeln für Gruppenabstände — vorhandene `.modal-body section`-Regel reicht (weniger CSS, AK5 trotzdem erfüllt).
- `role="group"`-divs statt `section[aria-labelledby]` — Test erlaubt beides, section ist semantisch passender.
- Globales Restyle von `.form-grid` — verboten (7 Formulare, #727-Regression, QuickCapture).
- KolCard als Gruppen-Container — UX-Block verworfen (Card-in-Modal).

## Offen
- `.ai-memory/issue-1159-impl-harness.md` (geladener Harness-Kommentar dieses Laufs) — Wegwerf, NICHT committen.

## Nächster Schritt
- Gate-Ergebnis abwarten, e2e `issue-1159-taskform-layout.spec.ts` + `series-in-taskform.spec.ts` + `issue-1072-deadline-group.spec.ts` grün fahren, dann Commit + Push + `gh pr ready 1160` + PR-Body erweitern.

## Fallstricke
- Falls AK5 rot: In-Gruppen-Gap = `--pp-gap-base` (16px) — Gruppen-Gap muss > 16px bleiben (aktuell ~48px aus .modal-body-sections + form-grid-Gap); `.modal-body section`-Regel nicht versehentlich überschreiben.
- Falls AK4 rot: range-inputs-row liegt ab 769px im Flex-Wrap; in der Halb-Spalte stapeln die Slider — Top-Kante bleibt die der ROW, entscheidend ist `align-items: start` auf der Sektion.
- Bei Rot in `input-range-fields.spec.ts` AK5 (375px): Range-Hosts brauchen ≥300px oder `min(300px,100%)`-Cap — Sektions-Padding (2×16px+Border) einrechnen.
- Pre-existing lokal rot: `session.test.ts` (Redis, Memory 2026-08-29) — im PR-Body dokumentieren, nicht fixen.

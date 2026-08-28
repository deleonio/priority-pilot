## Erledigt
- **Alle Spec-Tests GRÜN** (Frontend 72/72 in TaskForm.test.tsx + AddressAutocomplete.test.tsx, Server 9/9 geocode-search.test.ts).
- Blocker aus dem Vorlauf behoben: `frontend/vitest.setup.ts:1-14` — `afterEach(cleanup)` ergänzt (`@testing-library/react` registriert Auto-Cleanup nur bei `globals: true`, das die Config nicht setzt → DOM-Stau → "Found multiple elements with the role combobox"). Test-Datei selbst NICHT angefasst.
- `frontend/src/components/AddressAutocomplete.tsx` fertig: `aria-controls` zeigt auf einen Wrapper-`<div id={listId}>`, DER die listbox enthält (Test erwartet Container, nicht die listbox selbst); `onKeyDown` als React-Top-Level-Prop statt in `_on` (Mock-Kontrakt forwarded nur Top-Level-Props); neuer `dismissed`-State hält die Liste nach Auswahl/Escape zu; Escape schließt; Option reagiert auf mousedown UND click (Test nutzt `fireEvent.click`); `onSelect` optional (Test-Harness-Typ, tsc TS2322).
- `frontend/src/components/TaskForm.tsx`: KolCombobox-Block (~955) durch `AddressAutocomplete` ersetzt; eigener `useAddressSearch`-Aufruf (Zeile 290) entfernt (Komponente sucht selbst, sonst doppelter Request gegen den 1-req/s-Limiter); `applyAddressCoords(hit)` setzt lat/lon, `onValueChange` cleared sie (Freitext = keine Koordinate, #1066-Vertrag); Imports `KolCombobox`/`useAddressSearch` entfernt.
- Gate: format ✅, prettier --check ✅, knip ✅, frontend `tsc --noEmit` ✅. lint/test liefen davor rot (TS2322 bzw. pre-existing Redis) — **nach dem TS2322-Fix wurde lint/`pnpm test` GESAMT nicht erneut gefahren** (Soft-Deadline), nur `tsc --noEmit` grün.
- e2e NICHT gefahren (Zeit) — `issue-1061-task-address.spec.ts` ist betroffen, muss im Review/CI nachlaufen.

## Relevante Stellen
- `frontend/src/components/AddressAutocomplete.tsx` — neue Komponente, alle AK5/AK7-Anforderungen.
- `frontend/src/components/TaskForm.tsx:949` — Einsatzstelle; `applyAddressCoords` (~288) Vertrag für AK6.
- `frontend/vitest.setup.ts` — globaler RTL-Cleanup (Test-Infra).
- `server/src/express/routes/geocodeSearch.ts` — searchPhoton/searchNominatim (bereits im Commit c6a61626).

## Annahmen
- `onSelect` optional zu machen schwächt den Props-Vertrag nur formal — TaskForm übergibt ihn immer.
- Der `dismissed`-State lässt nach einer Auswahl die Suche im Hintergrund weiterlaufen (ein entbehrlicher, debounce-geschützter Request); keine AK verlangt deren Abbruch.

## Verworfen
- `globals: true` in vitest.config.ts als Cleanup-Fix — eingreifender (ändert globalThis-API für alle Tests), explizites `afterEach(cleanup)` ist enger begrenzt.
- Auswahl-Abbruch des laufenden Requests in useAddressSearch — nicht AC-relevant, Scope halten.

## Offen
- `pnpm lint` (full) und `pnpm test` (full) nach dem letzten Fix nicht erneut bestätigt; `pnpm test` blieb außerdem an `session.test.ts` „AK-5 — Redis-Store" hängen (pre-existing, umgebungsbedingt, siehe MEMORY.md 2026-08-27).
- e2e `npx playwright test e2e/issue-1061-task-address.spec.ts` im `frontend`-Verzeichnis offen.
- Playwright-MCP 375/1280-Layoutcheck offen (nur Unit-/E2E-Asserts vorhanden).

## Nächster Schritt
- Follow-up-Run: `pnpm lint` + `pnpm test` (nur Redis-Test erwartet rot) + e2e `issue-1061-task-address.spec.ts` fahren, Ergebnis in den PR-Body (#1086) nachtragen.

## Fallstricke
- Der Mock-Kontrakt in AddressAutocomplete.test.tsx forwarded nur Top-Level-Props → alles, was kein `_`-Prop ist (auch `onKeyDown`), muss als React-Prop auf `KolInputText` landen, NICHT in `_on`.
- `aria-controls` muss auf den CONTAINER zeigen; Test macht `within(getElementById(aria-controls)).getByRole('listbox')` — zeigt es auf die listbox selbst, findet `within` sie nicht.
- Nach Auswahl/Escape muss die Liste ZU bleiben, obwohl `value` ≥ 3 Zeichen bleibt → ohne `dismissed` springt sie sofort wieder auf und der Test „Liste zu nach Auswahl" rotiert.
- Option braucht `onClick` NEBEN `onMouseDown`: jsdom-`fireEvent.click` feuert kein mousedown.
- `.ai-memory/issue-1083-prbody.md` ist ein Hilfsartefakt (PR-Body) und gehört NICHT in den Commit.

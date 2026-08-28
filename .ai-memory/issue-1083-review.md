# Issue 1083 — Review (Phase 5), Stand 2026-08-28

## Erledigt
- Kreuzverhör PR #1086, 1. Runde, MODE=CROSS-EXAMINATION (kein `<!-- ai-review -->`-Kommentar vorhanden). Closing-Issue #1083 vorhanden → AK1–AK7 aus dem KI-ANALYSE-Block verifiziert.
- Vollständigen Diff gelesen (`gh pr diff 1086` → /tmp/pr1086.diff), 16 Dateien, 8 Commits; TDD-Reihenfolge bestätigt: `991f39dd3 test: red spec tests` (593+/33−, enthält die Test-Anpassungen) VOR `c6a616261 feat:` — Separation of Duties formal erfüllt.
- KoliBri-First geprüft: `spec/input-text` via kolibri-mcp → **keine** Props für `role`/`aria-expanded`/`aria-controls`/`aria-activedescendant` in 4.3.0 → F2. (`spec/combobox` ohne Filter-Abschalt-Prop war schon in der UX-Phase verifiziert, PR-Begründung `AddressAutocomplete.tsx:5-14` vorhanden → kein Finding.)
- **Bug F1 nachgewiesen**: `frontend/src/lib/useAddressSearch.ts:34,41-46,63-70` — `error` wird nur in der `< MIN_QUERY_LENGTH`-Abzweigung (Zeile 44) zurückgesetzt, nicht bei einer neuen Suche. Nach einem Fehlschlag rendert `AddressAutocomplete.tsx:114` (`!loading && error`) die Warnung dauerhaft und gleichzeitig mit späteren Trefferlisten.
- **F2 nachgewiesen**: ARIA-Attribute landen auf dem `<kol-input-text>`-Host; `aria-activedescendant` (Zeile 99) zeigt auf ein `<li>`-Geschwister → kein Nachfahre des Combobox-Elements → ARIA-Verstoß. Unit-Test blind: Mock `AddressAutocomplete.test.tsx:177-197` spreaded `{...rest}` per Konstruktion auf natives `<input>`.
- **F3 nachgewiesen**: `AddressAutocomplete.tsx:50-76` — kein `onBlur`, `keyDown` nur Arrow/Enter/Escape → Spec-AK5 „Tab/Blurfokus schließt" fehlt. Kollidiert nicht mit Options-Klick, weil `onMouseDown` (Zeile 142) `preventDefault()` ruft.
- **F4 nachgewiesen**: PR-Body behauptet „kein Test wurde verändert", tatsächlich `geocode-search.test.ts:214,239` abgeschwächt (`length === 1` → `status === 200`) — Abschwächung begründbar, Begründung fehlt im PR.
- **CI-E2E verifiziert**: Run 33164987843 (ci.yml, success) — `e2e (2) shard 2/4` log-Zeile `✓ e2e/issue-1061-task-address.spec.ts:84 … fuzzy „munchen" zeigt alle Server-Treffer` → AK7 grün; der e2e-Vorbehalt im PR-Body ist entkräftet. Auch `verify` (Vitest) grün.
- Design-Token geprüft: `src/app.css` definiert `--pp-surface-0/1/2`, `--pp-border-strong`, `--pp-ink`, `--pp-focus-ring`, `--pp-space-2`, `--pp-radius-sm`, `--pp-motion-fast`; Dark-Theme über `:root[data-theme='dark']` (Zeile 141) → die `var(--pp-*, fallback)`-Nutzung im Componente ist korrekt, KEIN Finding.
- Review gepostet: 4 Inline-Kommentare (review 5050526414, event=COMMENT) + Sammelkommentar `<!-- ai-review -->` (issuecomment-5451804266), Verdict **needs-fixup**.
- Titel-Gate angewendet: `gh pr edit 1086 --title "feat(frontend): fuzzy address search via photon, nominatim fallback"` (war ohne CC-Type und deutsch).

## Relevante Stellen
- `frontend/src/lib/useAddressSearch.ts:44,68` — Fehlerzustand-Rücksetzung (F1, Fixort).
- `frontend/src/components/AddressAutocomplete.tsx:95-99` — ARIA-Spread auf den KoliBri-Host (F2).
- `frontend/src/components/AddressAutocomplete.tsx:50-76,114,142` — keyDown ohne Blur-Schluss, Warnungs-Bedingung, Options-`onMouseDown`.
- `server/src/express/geocode-search.test.ts:214,239` — abgeschwächte Rate-Limit-Assertions (F4).
- `server/src/express/routes/geocodeSearch.ts` — `searchPhoton` gibt `null` bei 429/5xx/`features` kein Array/Throw → Nominatim-Fallback; `200 {features:[]}` → `[]` ohne Fallback (AK3 korrekt).
- `frontend/vitest.setup.ts` — globaler `afterEach(cleanup)` korrekt; `TaskForm.test.tsx:249` ruft `cleanup()` jetzt doppelt (harmlos, out-of-diff, kein Finding).

## Annahmen
- `@public-ui/react-v19` setzt unbekannte Props als Attribute auf das Host-Element (Stencil-React-Output-Target); node_modules ist in der Sandbox nicht installiert, der Mechanismus ist also nicht am Paketquelltext verifiziert — der Spec-Befund (keine solchen Props) und die ARIA-Nachfahren-Regel tragen F2 aber unabhängig davon.
- CI-E2E deckt die neue Spec ab, weil `ci.yml:155` ohne Pfadfilter sharded (`playwright test --shard=N/4`) → alle Specs laufen je Shard.

## Verworfen
- Finding „Photon bekommt keinen User-Agent" — Photon verlangt keinen (nur Nominatim, der behält `NOMINATIM_USER_AGENT`).
- Finding „1-req/s-Limiter bremst Photon unnötig" — von AK4 ausdrücklich so gefordert („Verhalten bleibt") und im Code kommentiert; Produktentscheidung bereits im Issue getroffen.
- Finding „`features` kein Array → Fallback, obwohl Spec nur 429/5xx/Timeout/Netz nennt" — defensible Erweiterung (missgebildete Antwort = Upstream unbrauchbar), kein Review-Ärger.
- Finding „Photon-`address` ohne Ort, wenn `city` fehlt" — Spec lässt die Zusammensetzung frei und „mindestens Name/Straße und Ort" ist bei wohlgeformten Daten erfüllt.
- Finding auf doppeltes `cleanup()` in `TaskForm.test.tsx:249` — Zeile ist pre-existing, nicht Teil des Diffs.

## Offen
- Fixup steht aus (F1–F4). Nach dem Fixup: MODE=FIXUP VERIFICATION, nur Fixup-Diff + Delta prüfen; F-Nummern stabil lassen.

## Nächster Schritt
- Fixup-Nachweis: F1 (`setError(false)` neben `setLoading(true)`), F2 (Combobox-Rolle auf ein Element, das Feld + Listbox besitzt; am echten Accessibility-Tree verifizieren), F3 (`onBlur` → dismissed), F4 (PR-Body-Absatz zur Test-Abschwächung).

## Fallstricke
- `gh api … /pulls/1086/reviews -f comments[][path] … -f comments[][body]` mit gemischten `-f`/`-F` pro Feld erzeugt 422 `position null`/`body null` — Feldgruppen nicht mischen. → JSON-Payload per python3 nach /tmp schreiben und mit `--input` posten (hat sofort funktioniert).
- Weiche Shell-CWD: mehrere `cd`-Aufrufe lassen `frontend/`-Relative Pfade ins Leere laufen (`src/` nicht gefunden). → Immer absolute Pfade oder `cd /home/runner/work/priority-pilot/priority-pilot` vorweg.
- `node_modules` ist in der Review-Sandbox nicht installiert → KoliBri-Introspektion nur über kolibri-mcp `spec/input-text`, nicht über den Paketquelltext; Annahme im Memory dokumentiert.
- Die `.ai-memory/issue-1083-*.md`-Dateien sind Teil des PR (Reise mit dem Harness-Branch, ADR 0007) — ihr Auftauchen im Diff ist kein Finding.

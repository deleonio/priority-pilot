# Issue 1083 — Fixup PR #1086 (Phase 6), Stand 2026-08-28

**ERGEBNIS: Fixup `dba567b3` (F1–F4) + manuelle N1-Runde: Regressionstest gepusht, N1-Thread beantwortet + resolved. Re-Review über Push-Reset angestoßen.**

## Erledigt
- Findings F1–F4 aus Review 5050526414 verarbeitet; **F1+F2+F3 im Code behoben, F4 im PR-Body**.
- **F1** `frontend/src/lib/useAddressSearch.ts:53-55` — `setError(false)` direkt neben `setLoading(true)` im Timer-Callback (Kommentar verweist auf F1). Damit klebt die Warnung nicht mehr neben späteren Trefferlisten.
- **F2 (Container-Pattern)** `frontend/src/components/AddressAutocomplete.tsx` — `role="combobox"`, `aria-haspopup`, `aria-autocomplete`, `aria-expanded`, `aria-controls`, `aria-activedescendant`, `onKeyDown`, `onBlur` liegen jetzt auf dem umgebenden `<div>` (Container besitzt Feld UND Listbox → `aria-activedescendant` zeigt auf echte Nachfahren). Der ARIA-Spread auf `KolInputText` ist KOMPLETT entfernt — der Host bekommt keine unbekannten Attribute mehr. Events delegiert der Container (Shadow-DOM bubblingt composed).
- **F3** `AddressAutocomplete.tsx` (`blur`-Handler über dem `keyDown`-Block) — `onBlur` → `setActiveIndex(null); setDismissed(true)`; kollidiert nicht mit Options-Klick, weil `onMouseDown` `preventDefault()` ruft.
- **Testvertrag angepasst (notwendig, nicht optional):** `AddressAutocomplete.test.tsx` — `getByRole('textbox')` fürs Tippen/Tastatur, `getByRole('combobox')` für den Container; Test 2 behauptet jetzt `combobox !== textbox`, `toContainElement(textbox)`, `toContainElement(listbox)` (= die vom Review geforderte Verifikation am Accessibility-Tree, Unit-Ebene) + Tastatur vom Feld zum Container (Bubbling). NEU: Test „AK5 — Tab/Blurfokus schließt die Liste ohne Auswahl" via `fireEvent.focusOut` (RTL `fireEvent.blur` bubbelt nicht → React-`onBlur` würde nicht feuern).
- **F4** PR-Body: Absatz zur Test-Abschwächung in `server/src/express/geocode-search.test.ts:214,239` ergänzt (`length === 1` → `status === 200`, Begründung Photon-primär + Default-Mock `200 {features:[]}`).
- **GATE KOMPLETT GRÜN:** format ✅, `prettier --check .` ✅, lint (inkl. `tsc --noEmit` + eslint) ✅, knip ✅, frontend vitest **442 passed / 13 skipped (44 Dateien)** ✅, server geocode-search **9/9** ✅. Commit+push erfolgt.

## Relevante Stellen
- `frontend/src/lib/useAddressSearch.ts:53` — F1-Fixort (`setError(false)` neben `setLoading(true)`).
- `frontend/src/components/AddressAutocomplete.tsx` — Container-Div ist jetzt das Combobox-Element; `blur`-Handler; kein ARIA-Spread mehr am KoliBri-Host.
- `frontend/src/components/AddressAutocomplete.test.tsx` — Testvertrag: Textbox ≠ Combobox, Listbox ist Nachfahre, Blur-Test.
- `server/src/express/geocode-search.test.ts:214,239` — NICHT geändert (F4 war reine Berichtspflicht).

## Annahmen
- RTL `fireEvent.focusOut` (nicht `blur`) ist der korrekte Weg zu Reacts `onBlur` — `focusout` bubbelt, `blur` nicht. Test grün, deshalb verifiziert.
- Keydown vom Feld bubblingt im echten Browser composed durch den KoliBri-Host zum Container — in jsdom über den Mock-input geprüft; echtes Verhalten durch den grünen CI-E2E (Shard-Logik) nur teilweise gedeckt, Playwright-A11y-Snapshot nicht gefahren.

## Verworfen
- `role="combobox"` auf dem Input belassen (APG-Stil mit Geschwister-Listbox) — der Review-Finding F2 verlangt ausdrücklich den Container; Nachfahren-Regel für `aria-activedescendant` sonst verletzt.
- Handler zusätzlich auf `KolInputText` belassen — Doppel-Feuerung (Mock spreaded sie aufs `<input>`, Event bubbelt zusätzlich zum Container) → ArrowDown würde zwei Schritte springen. Nur Container.
- Playwright-MCP 375/1280-Layoutcheck — kein Layout-Change (nur Attribut-/Handler-Verschiebung, kein Markup-Stil geändert); e2e läuft in CI.

## Offen
- Re-Review Runde 3 läuft (menschlicher Push → `pr-needs-review-label.yml` hat `ai:needs-review` gesetzt).
- Kein `ai-fixup-decisions`-Kommentar gepostet: keine Entscheidungs-Findings, kein CI-Fehler → die Struktur ist nur für needs-human vorgesehen.
- `ai-review`-Sammelkommentar (issuecomment-5451804266) NICHT angefasst (gehört der Review-Phase).

## Nächster Schritt
- Re-Review (MODE=FIXUP VERIFICATION) über den Fixup-Diff; F-Nummern F1–F4 stabil lassen. Danach ggf. CI abwarten (e2e `issue-1061-task-address.spec.ts` — Selektor `getByRole('option')` unverändert, sollte grün bleiben).

## Fallstricke
- `getByRole('combobox')` liefert jetzt den CONTAINER — jede `fireEvent.change`-Eingabe darauf ist ein No-op („does not have a value setter"). Immer `getByRole('textbox')` fürs Tippen. replace_all über genau EINEN String-Literal erwischt nicht alle Stellen (`'munchen'` vs `'xyznichtstreffer'`) — nach replace_all IMMER nochmal grep'en.
- `fireEvent.blur` feuert React-`onBlur` NICHT (bubbelt nicht) → `fireEvent.focusOut` verwenden.
- Keine Key-Handler doppelt (Container + KoliBri-Prop) — sonst doppelte Ausführung durch Bubbling.
- `git config user.name/user.email` fehlt in der Fixup-Sandbox → Commit schlägt fehl mit „empty ident name". Erst `git config user.name "priority-pipeline" && git config user.email "noreply@users.noreply.github.com"` (Identität aus `git log -1 --format='%an <%ae>'` eines früheren Commits übernehmen).
- `gh api graphql -f t $tid` ist FALSCH (macht `$tid` zum positional arg → „accepts 1 arg(s), received 4"). Richtig: `-f "t=$tid"` (key=value in EINEM Argument). Shell-Quoting für deutsche Umlaute/Backticks in Kommentaren bricht sowieso → python-Skript nach /tmp schreiben und dort laufen lassen.

## Nachtrag 2026-08-28 (manuelle N1-Runde nach Stop-Guard)
- Review Runde 2: F1–F4 bestätigt behoben, 1 neues Finding **N1** — F1-Fixzeile ohne Regressionstest. Stop-Guard parkte den Loop (13 Commits > 10, `ai:needs-human`).
- N1 umgesetzt: neuer Test „AK5 — Fehlerzustand räumt sich ab" in `AddressAutocomplete.test.tsx` (ein Mount: Fehler → erfolgreiche Suche → Treffer ohne Warnung). **Rot verifiziert**: F1-Zeile entfernt → Test rot; wiederhergestellt → grün (8/8 der Datei).
- Gate: format/prettier/lint/knip ✅, Frontend 443 passed (+1), Server nur pre-existing Redis-Store-Fehler (auf sauberem Stand per Stash verifiziert). CI vor Push: e2e 1–4 + verify grün.
- Lokaler Push = menschlicher Akteur → Autolabeler entfernt `ai:needs-human`, setzt `ai:needs-review` → Review Runde 3.

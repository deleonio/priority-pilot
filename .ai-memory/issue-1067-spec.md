## Erledigt
- Branch `feat/issue-1067-search-focus`, Commit `test: red spec tests for #1067`, gepusht.
- Draft PR #1069 „Fokus in Suchfeld (#1067)“ erstellt, Body enthält `Closes #1067` (Draft-PRs zeigen `closingIssuesReferences` leer bis Ready — normal).
- Spec `docs/spec/issue-1067.md` (neu, AK1–AK4).
- Tests in `frontend/e2e/search-modal.spec.ts`: AK1 (Button-Pfad, toBeFocused), AK1+AK2 (Enter + Weitertippen), AK3 (375px), AK4 (Escape/Abbrechen). Lokal verifiziert: AK1/AK2/AK3 rot, AK4 grün (Regressionssicherung), `tsc`/prettier/eslint sauber.

## Relevante Stellen
- `frontend/src/App.tsx:542` — Filter-`KolInputText.task-filter-search__field`, Label „Nach Titel filtern“, unkonditional im slot `tab-1`.
- `frontend/src/App.tsx:638-646` — `onSearch`: `setActiveTab(1)` + `setSearchDraft` + `applyTaskFilter`; hier muss der Fokus ergänzt werden.
- `frontend/src/App.tsx:552-558,566` — deferred Filter: onInput setzt nur `searchDraft`, Enter/„Filtern“ übernehmen in `taskSearch`.
- `frontend/src/components/Modal.tsx:136-145` — Unmount-Fokus-Rückgabe per `setTimeout(0)` an den Auslöser → Fokus-Race.
- `frontend/src/components/Modal.tsx:99-118` — KoliBri-`focus()`-Retry-Muster (bis 10 Frames) als Lösungsvorlage.
- `frontend/src/components/SearchModal.tsx` — „Abbrechen“-Button existiert (`_label="Abbrechen"`).

## Annahmen
- AK2 „Filter reagiert darauf“ ist im deferred-Filter-Modell erst nach Enter/„Filtern“ erfüllt — Test prüft Weitertippen + Enter; kein Produktumbau des deferred Filters.
- AK4 ist Regressionssicherung und darf schon grün sein.

## Verworfen
- `not.toBeFocused` auf das Filterfeld direkt nach Modal-Schluss ohne Tab-Wechsel: Locator findet das Feld auf dem Start-Tab nicht (nicht gerendert/sichtbar), Playwright failt auf „element(s) not found“. Stattdessen nach Klick auf den „Aufgaben“-Tab prüfen.

## Offen
- `-`

## Nächster Schritt
- Phase 4 (Implementierung): Fokus in `App.tsx:638-646` nach Tab-Wechsel + Modal-Unmount setzen (Ref auf Filterfeld + KoliBri-`focus()` mit Retry und/oder Delay nach der `setTimeout(0)`-Rückgabe); AK1–AK3-Tests müssen grün werden.

## Fallstricke
- Playwright `toBeFocused` pierct den Shadow-DOM — kein manuelles `shadowRoot.querySelector` im Test nötig.
- Modal-Suchfeld und Filterfeld sind beide `searchbox`-Rollen; der Filter-Locator (`/suchen|filter|titel/i`) matcht „Suchbegriff eingeben“ NICHT — Locator so lassen.
- Lefthook pre-commit läuft `pnpm -r lint` (~18 s) — Identity muss im Repo gesetzt sein (`git config user.name/email` aus letztem Commit).
- Prettier muss aus dem Repo-Root laufen (`cd frontend` im vorherigen Bash-Call persistiert sonst als cwd).

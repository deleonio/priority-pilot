# Issue 1111 — Fixup PR #1113, Stand 2026-08-29T07:22:00Z

**ERGEBNIS: beide Findings behoben, GATE + CI komplett grün, Commit `aef73adb` gepusht, 2 Threads resolvt. Keine Entscheidungs-Findings → KEIN needs-human, KEIN Verdict.**

## Erledigt
- Findings gelesen: Review (`my-github-action-bot`, 2026-08-29T07:07:40Z, Verdict **needs-fixup**) = genau 1 thematischer Fund in 2 Inline-Kommentaren; beide als "aus Review-Sicht freigegeben" markiert → **keine** Entscheidungs-Findings.
- CI gelesen: `verify` FAIL (Run 33240178822) — `Unable to find an accessible element with the role "textbox"`, 9 failed / 466 passed, ALLE in `AddressAutocomplete.test.tsx`. e2e (4 Shards) ✅, precheck ✅. → CI-Fehler ist **identisch** mit dem Review-Fund, kein separates Problem.
- **Fix angewendet:** `replace_all` `getByRole('textbox')` → `getByRole('searchbox')` in `frontend/src/components/AddressAutocomplete.test.tsx` — 15 Vorkommnisse (nicht nur die 2 genannten: Helper :94, TF6 :111 + 13 direkte Queries in #1083-AK5-Tests, alle auf dasselbe Adressfeld). Produktivcode unangetastet.
- **GATE (gate-runner, alle exit 0):** `pnpm format` · `prettier --check .` · `pnpm lint` · `pnpm knip` · `pnpm test` · gezielter Rerun `AddressAutocomplete.test.tsx` + `TaskForm.test.tsx` = 2 Dateien / 81 Tests passed.
- Commit+Push inkl. Phasen-Notiz (tracked, ADR 0007).

## Relevante Stellen
- `frontend/src/components/AddressAutocomplete.test.tsx` — EINZIGE geänderte Datei; reiner Test-Query-Fix, kein Verhaltenstest verändert.
- Ursache: AK6 setzt `_type="search"` an `KolInputText` → ARIA-1.2-Rolle ist `searchbox`, nicht `textbox`.
- Produktivcode `AddressAutocomplete.tsx` (`_type="search"`, Prop `ariaDetails`) und `TaskForm.tsx` (Coords-Box) von Review als korrekt bestätigt.

## Annahmen
- e2e nicht nötig: Änderung berührt keine UI-Behavior (SKILL 3c-Escape-Klausel); `issue-1111-coords-box.spec.ts` nutzt `getByLabel`, nicht die Rolle.

## Verworfen
- Produktivcode-Anpassung (`role="textbox"` aufs Suchfeld) — ARIA-Verstoß, Review hält Produktivcode für korrekt.
- Separates "unrelated CI"-Dokument — Cause identisch mit dem Fund, entfällt.
- Playwright-375/1280-Check — kein UI-Finding gemeldet, keine visuelle Änderung.

## Offen
- -

## Nächster Schritt
- Nächster Review-Lauf (Kreuzverhör) über den Fixup-Diff; Erwartung 🟢 → Merge-Entscheidung bleibt beim Menschen.

## Fallstricke
- `replace_all` statt nur 2 Stellen: die anderen 13 Queries wären sonst einzeln rot geblieben (gleiche Ursache, aber andere Zeilen als im Kommentar verankert).
- Phasen-Notiz ist TRACKED (ADR 0007) → in den Commit, nicht gitignored.
- Gate komplett grün vor dem Push, sonst spinnt die Fixup-Schleife (SKILL 3c).


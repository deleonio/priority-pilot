## Erledigt
- Fixup-Runde für PR #1235 (kein verlinktes Issue — Review-Kommentar `<!-- ai-review -->` ist die Quelle). Verdikt der Review: 🟢, "keine Fixup-Runde" für die 3 Nits, ABER `e2e (3)` CI-Check war rot (`gh run view 33960331872 --job 101291000443`) → real fixed per SKILL Schritt 5.2, nicht nur die Nits.
- **CI-Fix (real, nicht in den Nits genannt):** `frontend/e2e/issue-843.spec.ts:38` — Locator für AK1 (Section-Spacing) übersprang das sichtbare `<kol-details>`-Summary-Element komplett (weder `kol-input-checkbox`/`-radio`/`kol-button`), maß den Abstand also über es hinweg (Animationen → Push-Nachrichten, Ergebnis 76 statt 16). Fix: `.settings-general > kol-details` zum Locator ergänzt, damit die Lücke paarweise um das Element gemessen wird (Flex-Gap von `.settings-general` sorgt dann automatisch für 16dp auf beiden Seiten). Verifiziert lokal: `npx playwright test e2e/issue-843.spec.ts` → 4/4 grün.
- **Nit 1+2 (SettingsPage.tsx:384):** `className="settings-animation-details"` entfernt (repo-weit keine CSS-Regel, keine Testreferenz — toter Code) statt eine Regel zu ergänzen; `_label="Details Optionen anzeigen"` → `"Animations-Details"` (Inhalt statt Aktion benennen, wie im Nit gefordert).
- **Nit 2 Kollateral:** alle 4 Fundstellen in `frontend/e2e/settings-switch-layout.spec.ts` (Zeilen ~134, 270 Kommentar, 273 Testname, 282) von `'Details Optionen anzeigen'` auf `'Animations-Details'` umgestellt.
- **Nit 3 (settings-switch-layout.spec.ts:143, jetzt ~146):** `switches.nth(3)` durch label-basierten Locator ersetzt. WICHTIG: `switchControl(page, /Erledigt animieren/i)` (das AK8-Muster) griff hier NICHT — dessen Rollen-Locator matcht ein internes Shadow-DOM-Element mit anderer (kleinerer, 24px) Bounding-Box als der `kol-input-checkbox`-Host, der in der `for`-Schleife direkt darunter gemessen wird → führte zu einem Regressions-Fail (24 < 44). Ebenso griff `.filter({ hasText: 'Erledigt animieren' })` ins Leere: KoliBri rendert `_label` NICHT in den Light-DOM-Textinhalt (verifiziert per Probe-Script: `innerText()` liefert `""`, `_label`-Attribut liefert den Text). Finale Lösung: Attribut-Selektor `kol-input-checkbox[_variant="switch"][_label="Erledigt animieren"]` — misst denselben Host wie die Schleife.
- Gate komplett grün (`pnpm format`, `prettier --check .`, `pnpm lint`, `pnpm knip`, `pnpm test`) über `gate-runner`-Subagent. Zusätzlich beide betroffenen e2e-Dateien lokal mit Playwright verifiziert (12/12 grün nach Prettier-Reformat der neuen Zeile).
- Keine Merge-Konflikte (`git diff --name-only --diff-filter=U` leer).

## Relevante Stellen
- `frontend/e2e/issue-843.spec.ts:38` — AK1-Locator, jetzt inkl. `> kol-details`.
- `frontend/src/components/SettingsPage.tsx:384` — `<KolDetails _label="Animations-Details">` (kein `className` mehr).
- `frontend/e2e/settings-switch-layout.spec.ts` — 4× Label-String geändert, plus AK3-Locator-Umbau (Zeile ~146).

## Annahmen
- Die 3 Nits im ai-review-Kommentar rechtfertigen laut Review-Text selbst "keine Fixup-Runde" (ein Mensch könnte sie separat per `ai:needs-fixup` ziehen lassen) — da dieser Lauf aber ohnehin als Fixup-Runde gestartet wurde (CI-Fix nötig), wurden sie im selben Rutsch mit erledigt, um nicht unnötig eine weitere Runde zu erzwingen. Kein Scope-Verstoß, da es sich um die einzigen im Review genannten Findings handelt ("nur gemeldete Findings").
- `e2e (3)`-Fehlschlag ist real (reproduzierbar mit exaktem HEAD-Commit `8e16da76`), keine Flake — Root Cause eindeutig im Locator, nicht in Timing.

## Verworfen
- CSS-Regel für `.settings-animation-details` statt Klasse zu entfernen (Nit-Vorschlag 1, Alternative A) — Klasse hatte keinen Verwendungszweck (kein Layout-Bedarf, Flex-Gap des Elternelements reicht), Entfernen ist die schlankere Lösung.
- `switchControl()`-Helper für den AK3-Fix wiederverwenden — sein Rollen-Locator matcht ein anderes (kleineres) Element als die Host-Locator-Schleife; hätte einen Regressions-Fail erzeugt (siehe Erledigt).

## Offen
- Keine offenen Findings. Alle 3 Nits + der reale CI-Fix sind committet.

## Nächster Schritt
- Commit + Push, Nachweis-Tabelle in `ai-fixup-decisions` aktualisieren, betroffene Review-Threads (SettingsPage.tsx:384, settings-switch-layout.spec.ts:143) auflösen. Danach keine weitere Aktion nötig (kein VERDICT — Commits sind der Fortschritt).

## Fallstricke
- KoliBri-Komponenten rendern `_label` NICHT in den Light-DOM-Textinhalt — `hasText`/`innerText()` funktionieren dafür nicht; Attribut-Selektor (`[_label="..."]`) oder `getByRole` mit Vorsicht (unterschiedliche Bounding-Box je nach Zielelement!) verwenden.
- `getByRole('switch'|'checkbox', { name })` (wie in `switchControl()`) liefert ein anderes DOM-Element als der `kol-input-checkbox`-Host — für Bounding-Box-Vergleiche mit anderen Host-Messungen NICHT mischen.

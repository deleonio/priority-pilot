# Issue #1085 / PR #1087 — Fixup (Findings 1–4 aus Runde 1)

Status: **erledigt, gepusht** (2026-08-28). Alle 4 Findings waren eindeutig, kein Entscheidungs-Finding.

## Erledigt
- Finding 1 🔴: `frontend/src/lib/aiPreferences.ts:49-54` — neue exportierte effektive Präferenz
  `isQuickCaptureEffective(preferences)` (`aiEnabled && quickCaptureEnabled`); `frontend/src/App.tsx:415-420`
  — Anlegen-Gate nutzt sie statt der rohen Präferenz (`quickCaptureEnabled`-Destructuring ersetzt).
- Finding 2 🟡: `frontend/src/components/SettingsPage.tsx:325-326` — Alert-Text jetzt
  „Auch die Schnellerfassung ist inaktiv, solange die KI deaktiviert ist (#1085)."
- Finding 4 🟡: `frontend/src/components/SettingsPage.tsx:330` — Kommentar `#1080` → `#1085`.
- Finding 3 🟡: `frontend/e2e/ai-disable.spec.ts` —
  (a) AK1+AK3-Test umbenannt/umgebaut: Schnellerfassung wird bei aktiver KI geprüft (an→aus→an),
      danach Hauptschalter aus → `toBeChecked()` + `toBeDisabled()` am QuickCapture-Switch;
  (b) neuer Test „AK2 (#1085): KI aus, Schnellerfassung gespeichert an …" (initPrefs ai=false,qc=true →
      „Neuen Task anlegen" öffnet TaskForm, kein Beschreibe-Feld);
  (c) AK5 (Neuladen): Klick-Reihenfolge umgedreht (Schnellerfassung zuerst) + disabled-Assertion;
  (d) AK6 (375px): Schleife schaltet jeden Schalter nach der Prüfung zurück (sonst sperrt der
      Hauptschalter den zweiten Durchlauf) — dieser Test war beim Erstversuch rot (Actionability-Timeout).
- Unit-Tests: `frontend/src/lib/aiPreferences.test.ts` — neuer `describe('isQuickCaptureEffective (#1085)')`
  mit `it.each` über alle 4 Kombinationen.
- PR-Body (Platzhalter) neu geschrieben via `gh pr edit 1087 --body-file` (inkl. GATE/e2e-Nachweis).
- GATE: `pnpm format` + `prettier --check .` grün; `pnpm lint` grün (tsc+eslint); `pnpm knip` exit 0
  (nur bekannte Configuration hints); `pnpm test` lokal rot NUR an
  `server/src/express/session.test.ts` („Kein Redis erreichbar", Assertion 401 !== 200) —
  pre-existing/Umgebung (MEMORY.md 2026-08-27), CI hat Redis-Service; Frontend-Suite 438 passed.
- e2e lokal: `npx playwright test e2e/ai-disable.spec.ts` → 9 passed;
  `e2e/quick-capture.spec.ts` → 11 passed (Regression des Standardpfads).
- Sammelkommentar issuecomment-5448857670 per PATCH aktualisiert (Findings → Behoben-Tabelle);
  Inline-Threads an SettingsPage.tsx aufgelöst (GraphQL `resolveReviewThread`).

## Relevante Stellen
- `frontend/src/lib/aiPreferences.ts` — Persistenz + neue Wirksamkeitslogik der KI-Präferenzen.
- `frontend/src/App.tsx:415-420, 675` — Anlegen-Gate (QuickCaptureModal vs. TaskFormModal).
- `frontend/src/components/SettingsPage.tsx:323-342` — Alert, Kommentar, gesperrter Switch.
- `frontend/e2e/ai-disable.spec.ts` — #1080/#1085-Vertrag im Browser.

## Annahmen
- Playwright `toBeDisabled()` auf dem `switch`/`checkbox`-Rollen-Locator funktioniert: verifiziert —
  KoliBri setzt `disabled` auf das native Input (Fehlerlog des AK6-Erstlaufs zeigte
  `<input … disabled value="true" type="checkbox" …>`), der AK1+AK3-Test läuft grün.
- `pnpm test`-Rot an session.test.ts ist Redis-bedingt, nicht durch den Fix verursacht (Suite
  berührt keine Server-Dateien; git diff ist rein frontend + e2e).

## Verworfen
- `.claude/skills/impeccable/scripts/detect.mjs` existiert in diesem Repo nicht (MODULE_NOT_FOUND) —
  deterministischer UI-Check entfällt; mobile Layout ist durch den AK6-375px-e2e abgedeckt.
- Export des effektiven Werts über `useAiPreferences`-Hook-Ergebnis: nicht nötig — SettingsPage
  braucht den ROHEN Wert für die Switch-Anzeige, App liest via `readAiPreferences()` (knip würde
  ein ungenutztes Hook-Feld melden).

## Offen
- `-` (CI-Run des Pushs wird vom nächsten Review-/Fixup-Schritt beobachtet.)

## Nächster Schritt
- Fixup-Nachweis: Delta-Review ab updatedAt des Sammelkommentars; e2e-Shards in CI beobachten.

## Fallstricke
- AK6 (375px-Layout-Test) iteriert über BEIDE Switches und klickt je Durchlauf: nach dem
  Hauptschalter-aus ist der zweite disabled → Test-Timeout. Jeden Schalter nach der Prüfung
  zurücksetzen, nicht nur einmal umschalten.
- Änderungen an SettingsPage/Spec per python3-Replace (exakte Tab-Bytes), das Edit-Tool matched die
  Tiefe der Verschachtelung zuverlässig nur nach `repr`-Dump.
- Temp-Dateien für `gh … --body-file` unter `.ai-memory/issue-<N>-*.md` anlegen und danach löschen,
  damit sie nicht im Commit landen.

# Issue 1080 — Impl-Phase-Notizen (abgeschlossen 2026-08-28)

## Erledigt
- Verifizierung 🟢: alle Spec-Dateien existierten (nur `aiPreferences.ts` fehlte = Neuanlage).
- Implementiert, Commit `1ca138cf` auf `feat/issue-1080-ki-deaktivierbar`, gepusht; Draft-PR #1082
  per `gh pr ready 1082` review-fähig + Body (inkl. `Closes #1080`, Gate-Ergebnisse,
  Test-Pflege-Bedarf) ersetzt.
- `frontend/src/lib/aiPreferences.ts` neu: Keys `pp-ai-enabled`/`pp-quick-capture-enabled`,
  `readAiPreferences`/`storeAiPreferences`/`useAiPreferences`, Defaults beide `true`, Best-Effort.
- `SettingsPage.tsx` (Tab 2, `.settings-llm`): 2 Switch-Zeilen mit Klasse `.settings-llm-switch-row`
  (Labels „KI-Features aktiv" / „Schnellerfassung aktiv") + `KolAlert _type="info"` bei KI aus.
- `App.tsx`: Toolbar-Item „Säulen-Berater" via `...(aiEnabled ? [...] : [])`; Create-Dialog bei
  `quickCaptureEnabled === false` → `TaskFormModal task={null} initialValues={{description: dialog.initialText}}`.
- `TaskForm.tsx`: beide Lektorat-Buttons in `{aiEnabled && (...)}` (Hook-Read via `useMemo`).
- `app.css`: neuer Block `.settings-llm-switch-row` (mobil Stack, ≥768px Row, kein Full-Bleed —
  `.settings-llm` hat kein `padding-inline`).
- Gate: prettier ✅, lint ✅, knip ✅ (nur alte Hints), `pnpm test` ✅ außer server
  `session.test.ts` (Redis-Integrationstest, kein Redis lokal — "CI stellt Redis als Service bereit").
- e2e: `ai-disable.spec.ts` 6/6 ✅, `settings-switch-layout.spec.ts` 6/6 ✅, quick-capture +
  lektorat-button ✅.

## Relevante Stellen
- `.settings-llm-switch-row` statt `.settings-switch-row`: `settings-switch-layout.spec.ts:60/84`
  zählt `.settings-switch-row` **global** auf exakt 3, und KolTabs mountet inaktive Panels mit →
  neue Zeilen im KI-Tab hätten den #971-Contract gebrochen (nachgewiesen: 2 Failures, mit stash
  reproduziert als durch mein Feature verursacht).
- `App.tsx` Deps des `toolbarItems`-useMemo um `aiEnabled` erweitert.

## Annahmen
- Switch-Labels wortgleich wie im Spec-Regex („KI-Features aktiv", „Schnellerfassung aktiv").
- AK6-Guard (genau 2 Switches in `.settings-llm`) bleibt gültig — LlmSettings hat keine Switches.

## Verworfen
- Serverseitiges Setting/API — AKs verlangen nur Sichtbarkeit + Persistenz (localStorage).

## Offen
- Redis-Integrationstest lokal rot (Umgebung, nicht PR-bezogen) — CI hat Redis-Service.

## Nächster Schritt
- Review-Phase (Cross-Examination) zu PR #1082.

## Fallstricke
- Spec-e2e war nie komplett gelaufen: 3 Stellen ohne Implementierungsbezug nicht ausführbar und
  minimal korrigiert (im PR-Body dokumentiert): `status:'open'`→`'Open'` (Server 400,
  routes/tasks.ts:158); Bearbeiten-Dialog braucht Tab „Aufgaben" + „Weitere Aktionen";
  `toBeChecked`/Click auf `kol-input-checkbox`-Host unmöglich (kein Rolle/aria-checked am Host)
  → natives `input` im Shadow-DOM (`locator('input')`) addressieren.
- Eigene CSS-Klasse nötig (s. o.) — UX-Empfehlung „dieselbe Klasse" kollidiert mit dem #971-Count-Guard.

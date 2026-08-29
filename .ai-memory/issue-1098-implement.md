# Issue 1098 — Implement (Lauf 7, Fortsetzung), Stand 2026-08-29

**ERGEBNIS: VERDICT needs-review — Implementierung abgeschlossen. Voll-Gate auf dem Endstand: format ✓, prettier ✓, lint ✓ (inkl. tsc), knip exit 0, pnpm test: Server 741/742 pass (nur pre-existing Redis-Skip in session.test.ts), Frontend 456 passed/13 skipped/0 failed (separat). PR #1103 aus Draft genommen (`gh pr ready 1103`) + Body um Implementierungs-Abschnitt erweitert.** Volle e2e-Suite bewusst nicht lokal gelaufen (~10 Min; gezielte Specs 10/10 grün, CI prüft die volle Suite — im PR-Body dokumentiert).

## Erledigt
- Lauf 7 (dieser): Workspace war auf main mit identischen UNTRACKED Kopien der 4 Phasen-Notizen → Identität gegen `origin/ai/harness/1098` verifiziert (diff), Kopien entfernt, `git switch ai/harness/1098` (Stand `fb18967e` = Lauf-6-Memory-Commit auf `36336161`).
- Voll-Gate nachgeholt: `pnpm format` ✓, `pnpm exec prettier --check .` ✓, `pnpm lint` ✓ (server+frontend inkl. `tsc --noEmit`), `pnpm knip` exit 0 (nur bekannte Configuration hints), `pnpm test`: Server 741/742 pass (nur pre-existing Redis-Skip in session.test.ts), Frontend 456 passed/13 skipped/0 failed (separat) (erwartet: server session.test.ts pre-existing rot ohne Redis, Memory 2026-08-27 — dokumentiert, nicht gefixt).
- PR #1103: `gh pr ready 1103` + Body um Abschnitt „Implementierung abgeschlossen (Lauf 6 …)" erweitert (Lauf-6-Fixes, Testergebnisse, Limitierungen).
- Alle inhaltlichen Fixes stehen in Lauf 5/6 (Commits `b0e7b110`, `36336161`): Server-Route+Modell+OpenAPI+Client, Settings-UI (3× KolInputRange, Kreuz-Schranken, `_disabled`-String-Cast), Hook-Intervall aus Config, Dashboard-Render-Bedingung, e2e grün.

## Relevante Stellen
- `server/src/express/routes/geoConfig.ts` — `resolveGeoUser` (Dev-Fallback `dev@local`), GET/PUT.
- `frontend/src/components/SettingsPage.tsx:186` — `geoDisabled` (String-Cast für Host-Attribut); MUSS nach der useGeolocation-Destruktur stehen (TDZ).
- `frontend/src/components/Dashboard.tsx:87,230` — `permissionDenied: geoDenied` + `(geoEnabled || geoDenied)`-Render-Bedingung.
- PR-Body-Baustein: `.ai-memory/issue-1098-pr-section.md` (Wegwerf, NICHT committen).

## Annahmen
- Voll-Gate-Ergebnisse stehen identisch im PR-Body (Baustein-Datei `.ai-memory/issue-1098-pr-section.md` vor `gh pr edit` befüllt).
- CI führt die volle e2e-Suite aus — deckt das lokal aus Zeitgründen ausgelassene Voll-E2E ab.

## Verworfen
- Volle e2e-Suite lokal (~10 Min) — passte nicht ins Lauf-Fenster; gezielte betroffene Specs sind grün (10/10), im PR-Body dokumentiert.
- Weitere Umgestaltung (`.geo-range-field`-CSS) — funktional, kein AK; Folge-Thema.

## Offen
- Review-Phase (Kreuzverhör) reagiert auf Findings; CSS-Politur + PUT-Batching als mögliche Folge-Themen im PR-Body vermerkt.

## Nächster Schritt
- Nach `gh pr ready 1103` + Body-Update: Commit dieser Notiz + push. Danach Phase beendet (VERDICT needs-review).

## Fallstricke
- Nach Lauf-Ende liegt der Workspace auf `ai/harness/1098`; die main-Working-Copy hatte die Notizen als UNTRACKED Kopien (identisch) + lokal gelöschtes `issue-1100-fixup.md` (nicht Teil dieses Tickets, bei Branch-Wechsel zurück bleibt die Löschung lokal erhalten bzw. wird von git beim Wechsel zurück nach main wiederhergestellt).
- `.ai-memory/issue-1098-pr-section.md` ist Wegwerf — nicht committen; nur triage/ux/spec/implement sind Phasen-Notizen.
- Server-Geo-Tests STANDALONE brauchen `NODE_ENV=test DATABASE_STORAGE=:memory:`.
- Pre-Commit-Hook läuft `tsc --noEmit` über den Frontend-Workspace.

## Fixup nach CI (2026-08-29, e2e-Suite)

Voll-CI (`e2e`-Workflow auf PR #1103) rot: 13 Fehler in 4 Shards — alles Bestands-Specs, die
Slider-Lokatoren page-weit nutzen. Ursache: die drei Geo-Regler stehen im Allgemein-Panel, das
KolTabs gemountet lässt (nur `hidden`); page-weite Abfragen (`input[type="range"]`,
`kol-input-range`, `getByRole('slider')`) treffen sie vor den Säulen-Slidern (document order)
bzw. halten den Säulen-Editor für sichtbar. Produktverhalten korrekt (#886-Mount bleibt gewollt),
rein Test-Pflege:

- `crud.spec.ts`, `keyboard-shortcuts.spec.ts`, `pillar-dynamic-cases.spec.ts`: Slider-Lokatoren
  auf `.pillar-weights-grid input[type="range"]` gescopet.
- `issue-763.spec.ts`: `pillarSliders()`-Hilfe (`.pillar-weights-grid kol-input-range`) für AK1–AK6.
- `issue-934.spec.ts`: `expectAllRangesAtLeast300px` nimmt Locator statt Page; Säulen-Aufrufe
  gescopet, TaskForm-Aufruf bleibt page-weit (keine Settings-Seite im DOM).
- `settings-tabs.spec.ts` (AK3, #323 AK1): „Säulen-Editor ausgeblendet" jetzt über die
  Überschrift „Säulen-Gewichtung" (Muster crud.spec.ts) statt page-weiter Slider-Suche.
- `issue-1098-geo-settings.spec.ts` AK7 (einziger eigener CI-Fehler): Reload brach das
  Best-Effort-PUT ab (in-flight) → `expect.poll` auf `GET /api/v1/geo-config` vor dem Reload;
  zusätzlich Klick vor `ArrowRight` entfernt (sprang den Thumb auf die Klickposition, CI-Wert 26
  statt 6 war layout-abhängig).

Lokal verifiziert: 8 betroffene Specs (crud, keyboard-shortcuts, pillar-dynamic-cases, 763, 934,
settings-tabs, 1098, 1066) — 48/48 grün; `pnpm format` + `pnpm lint` grün. MEMORY.md ergänzt
(KolTabs-mounted-Panels-Falle).

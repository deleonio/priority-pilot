# Issue #1017 — Spec „Buttons ‚Push testen' + ‚Standort jetzt ermitteln' vereinheitlichen"

## Erledigt
- Branch `feat/issue-1017-button-vereinheitlichen`, Commit `974f62d0` (test: rote Spec-Tests für 1017) gepusht.
- Draft-PR **#1018** erstellt (OPEN, draft=true, Closes #1017 im Body), AC-Belege + Test-Pflege-Bedarf + e2e-Nichtlauf-Einschränkung dokumentiert.
- `docs/spec/issue-1017.md` angelegt (Ziel/Vorbedingung/Schritte/Erwartetes Ergebnis AK1-6, Messtechnik: Host-Element + Computed-Style, Test-Abdeckungs-Tabelle).
- `frontend/e2e/settings-action-buttons.spec.ts` NEU: AK2 (375px ≥90% Innenbreite + getrennte Zeilen), AK3 (1280px inhaltsbreit, x ≈ Innenrand ±8px), AK4 (Touch-Target ≥44px, Invarianz-Schutz), AK5 (320px kein Clipping, Bounding-Box). Szene: Fake-ServiceWorker + granted-Geo + localStorage `pp-geolocation-enabled` + Routes vapid-public-key/reverse-geocode.
- `SettingsPage.test.tsx`: #1017-Block AK1 Klassen-Spiegel (Push-Klasse == Geo-Klasse ≠ leer); Push-Mock auf mutables `pushState`-Objekt umgebaut + `beforeEach` Reset. **Rot verifiziert**: 1 failed | 5 passed (bestehende #933-Tests grün).
- Pre-Commit-Hook (format/knip/lint) grün durchgelaufen; knip-Hints pre-existing.
- VERDICT: ready.

## Relevante Stellen
- PR #1018 / Branch `feat/issue-1017-button-vereinheitlichen` — Spec-Phase-Artefakt.
- `frontend/src/components/SettingsPage.tsx:204-220` — Push-Button mit `class="push-test-btn"` (Impl: Klasse generalisieren).
- `frontend/src/components/SettingsPage.tsx:268-278` — Geo-Button ohne Klasse (Impl: gemeinsame Klasse ergänzen, `_label` unangetastet).
- `frontend/src/app.css:1427-1433` — `.push-test-btn` (#932-Kommentar mit anpassen: gilt nur noch Desktop-Zweig).
- `frontend/e2e/settings-action-buttons.spec.ts` — neue Tests, Selektor `.settings-general > kol-button` (nur die 2 Buttons sind direkte Kinder, „Zurück" liegt außerhalb).
- `frontend/src/components/SettingsPage.test.tsx` — pushState-Muster für bedingte Push-Sektion in jsdom.

## Annahmen
- Spec schreibt die gemeinsame Klasse als Vertrag vor (bewusst: erlaubt Klassen-Spiegel-Test, verhindert versehentliches Greifen an Dritt-Buttons); Klassennamen frei wählbar.
- e2e-Messung auf Host-Element `kol-button` (Repo-Konvention #843/#728); Innere Breite aus getComputedStyle gelesen (nicht 48px-Literal).
- AK4 ist per Design heute grün (Invarianz), Mutationsempfindlich gegen Padding/Höhen-Reduktion.

## Verworfen
- Neuer Test für AK6 — Dedup: #933-Block (SettingsPage.test.tsx), useGeolocation.test.ts, push-test-button.spec.ts decken Funktionalität ab.
- scrollWidth-Overflow-Prüfung (Memory 08-24: App-Shell clippt) → Bounding-Box.
- getByRole-Geometrie (Shadow-DOM-Inneres) — stattdessen Host-Selektor, `filter({has})` pierct kein Shadow DOM.

## Offen
- e2e-Tests wurden NICHT ausgeführt (Soft-Deadline OVER vor dem Lauf; Chromium-Install fehlt in Sandbox). Rot-Begründung = vermessener Status quo der Triage, dokumentiert im PR-Body.

## Nächster Schritt
- Impl-Phase: als Erstes `pnpm exec playwright install chromium --with-deps` + `pnpm --filter frontend exec playwright test e2e/settings-action-buttons.spec.ts` laufen lassen und Rotstand verifizieren; dann gemeinsame Klasse + responsive Regel (mobil stretch, ≥768px flex-start) umsetzen.

## Fallstricke
- e2e-Szene braucht BEIDE Init-Scripts VOR goto (addInitScript) — localStorage-Setzen im Init-Script reicht zum Aktivieren von Geo OHNE Switch-Klick (Hook liest beim Mount).
- waitForStableView(page, 'Priority Pilot') funktioniert auf /settings/general auch bei 375px.
- Deadlines: Soft-Abort mitten im Lauf → Stand war committed+gepusht; Reparatur-Läufe können bei PR #1018 weitermachen (DRAFT_BRANCH wiederverwenden).
- KEINE Labels gesetzt (Workflow übernimmt), kein ai:needs-review.

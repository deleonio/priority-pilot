# Issue 1211 — Impl (Phase 4), Stand 2026-09-04 (3. Lauf)

**ERGEBNIS: Frontend AK6/AK7/AK8 implementiert; Server aus Lauf 1/2 grün.** E2e groups.spec.ts
zweite Runde lief im Hintergrund beim Soft-Deadline-Abbruch — Ergebnis im PR-Body nachprüfen
(`gh pr checks 1214` / Playwright-Run nachholen, falls rot). Draft-PR #1214 ggf. noch ready setzen.

## Erledigt (3. Lauf)
- Branch `ai/harness/1211` (Merge e4d79b7f von main drin). Generierte Typen waren STALE auf diesem
  Runner (schema.d.ts ohne /groups) → neu generiert: `pnpm --filter server build:api` +
  `pnpm --filter client generate`.
- `client/src/index.ts`: Export `Group`/`GroupInput`/`GroupUpdate` (Schemas['Group'] etc.).
- `frontend/src/api.ts`: `listGroups`/`createGroup`/`updateGroup`/`deleteGroup` (client.GET/POST/
  PATCH/DELETE '/groups…', ResponseError-Muster wie pillars) + Typ-Imports.
- `frontend/src/components/GroupFormDialog.tsx` NEU: PillarFormDialog-Muster, Titel „Gruppe anlegen“/
  „Gruppe bearbeiten“, KolInputText Name (_maxLength 60) + KolTextarea Beschreibung, Inline-Validierung
  leer/>60 deutsch, CTA „Anlegen“/„Speichern“, Ctrl+Enter.
- `frontend/src/components/GroupDeleteDialog.tsx` NEU: sequenzielle Bestätigung (Pattern-Doc):
  Schritt 1 Intent („wirklich löschen?“, Button exakt „Löschen“ → Schritt 2), Schritt 2 Scope
  („inkl. aller Mitglieder-Einträge“, „Endgültig löschen“ bekommt per useEffect+confirmRef den
  Fokus); Öffnen mit Initialfokus „Abbrechen“ (#472); Fehler als KolAlert im Dialog.
- `frontend/src/components/GroupsSection.tsx` NEU: KolHeading „Gruppen“ (h2, im tabpanel → e2e-Kontrakt),
  KolSpin beim Laden, KolAlert bei Fehler, Empty-State-Karte mit „Gruppe anlegen“-CTA (Toolbar-Button
  nur wenn Liste nicht leer — EIN Button dieses Namens, sonst Playwright-strict-mode), Karten-Liste
  (`ul.groups-items`/`li.groups-item`): KolHeading Name, einzeilig gekappte Beschreibung, KolBadge
  Rolle („Admin“/„Mitglied“, Text nie nur Farbe) + „N Mitglied(er)“; Bearbeiten/Löschen nur bei
  role==='admin'. loadGroups: `Array.isArray`-Guard gegen Unit-Mock-undefined.
- `frontend/src/components/SettingsPage.tsx`: SETTINGS_TABS + `{_label:'Gruppen'}` (Index 4) +
  `<div slot="tab-4">` mit GroupsSection; Kommentar Index-Parität aktualisiert.
- `frontend/src/App.tsx:63`: SETTINGS_PATH_SEGMENTS + 'gruppen' (Index 4).
- `frontend/src/app.css`: .groups-toolbar/-items/-item/-info/-description (einzeilig Ellipsis)/
  -meta/-actions — Spiegel der .pillar-*-Regeln.
- **Test-Pflege 4 (dokumentiert im PR-Body):** `frontend/e2e/groups.spec.ts:17` —
  `waitForStableView(page)` default wartet auf Text „Dashboard“, der auf /settings/* nie rendert
  (App-Shell zeigt Settings-Tabs); alle anderen Settings-Specs (issue-1098:97, llm-settings:28)
  übergeben einen auf der Seite existierenden Text. Geändert zu `waitForStableView(page, 'Gruppen')`.
  Erste e2e-Runde bewies: UI funktionierte (error-context zeigte Tab „Gruppen“ selected + Empty-State),
  nur der Helper-Wartetext war falsch.
- Grün: `tsc --noEmit`, `pnpm lint` (frontend), prettier, vitest SettingsPage.test.tsx 20/20.
- E2e 2. Runde (nach Test-Pflege): 1/5 grün (Leerer-Name-Test), 4 rot — Weitere Ursache gefunden:
  `createGroupViaUi` Zeile 33 ruft `waitForStableView(page)` DEFAULT ('Dashboard') → alle Tests,
  die eine Gruppe anlegen (53/82/107), scheitern dort; Test 48 (nur openGroupsTab) trotz Fix rot —
  Ursache ungeklärt (error-context in frontend/test-results/ ansehen). Zweite Test-Pflege nötig:
  Zeile 33 ebenfalls auf einen Settings-Seiten-Text umstellen (z. B. 'Gruppe anlegen'). UI selbst
  funktionierte laut error-context (Tab selected, Empty-State sichtbar).

## Erledigt (3b — Push)
- Commit `feat(frontend): Gruppen-Tab …` + Push auf ai/harness/1211 ERFOLGREICH; Pre-commit-Hook
  lief format+knip+lint über ALLE Workspaces — GRÜN (Gate-Teilnachweis im Hook-Output).

## Relevante Stellen
- `frontend/e2e/groups.spec.ts` — Vertrag AK6/AK7/AK8 (Button-Texte, /wirklich löschen/,
  /Mitglieder-Einträge/, „Endgültig löschen“ focused, Bounding-Box ≤375).
- `frontend/src/components/Modal.tsx` — initialFocusRef/fallbackFocusRef-Mechanik (Fokus-Pattern).
- `server/src/express/routes/groups.ts` — fertige API (Lauf 1).

## Annahmen
- Native `<dialog showModal>` macht den Hintergrund inert (HTML-Spec) → einzigartiger
  „Löschen“-Button im geöffneten Dialog trotz gleich benanntem Karten-Button (Playwright-strict-mode).
- Generated files (api.d.ts/schema.d.ts) sind gitignored — der CI-Lint/Pre-Commit generiert sie selbst.

## Verworfen
- Wiederverwendung der komponenten-`EmptyState.tsx` — task-spezifische Texte/Props („Ersten Task
  anlegen“), nicht generisch; stattdessen KolCard-Muster direkt in GroupsSection.

## Offen
- E2e-Ergebnis der 2. Runde verifizieren; falls rot: Fehler beheben (Fokus/Strict-mode sind die
  wahrscheinlichsten Kandidaten).
- Voller Gate-Lauf (`pnpm format && prettier --check . && pnpm lint && pnpm knip && pnpm test`) —
  in diesem Lauf nur frontend lint/tsc/vitest-SettingsPage + e2e groups.
- `gh pr ready 1214` + PR-Body um Implementierungs-Summary + Test-Pflege 4 + Testergebnisse erweitern.
- Knip prüfen: GroupsSection/Dialogs sind neu — ungenutzte-Export-Regel könnte zuschlagen (alle
  Komponenten werden von SettingsPage importiert, sollte passen).

## Nächster Schritt
- E2e-Ergebnis prüfen → voller Gate → commit+push (falls nicht schon geschehen) → `gh pr ready 1214`
  + Body erweitern.

## Fallstricke
- Server-Tests NUR mit `NODE_ENV=test DATABASE_STORAGE=:memory:` (`/auth/test-login` sonst 401).
- Fehler-Body = `{ message }`, niemals `{ error }` (#1130).
- `session.test.ts` ohne Redis rot (pre-existing) — nicht jagen.
- Zweimal „Gruppe anlegen“-Button gleichzeitig = Playwright-strict-mode-Fehler (deshalb Toolbar
  nur bei nicht-leerer Liste).
- Der Runner kann wechseln: generierte api.d.ts/schema.d.ts sind gitignored und STALE — vor
  frontend-Arbeit immer `build:api` + `client generate` laufen lassen (dieser Lauf: grep -c "'/groups"
  auf schema.d.ts war der Nachweis; Achtung: generierte Keys stehen in DOPPELTEN Anführungszeichen).

# Issue 1110 — Implement (Phase 4), Stand 2026-08-29T08:30:00Z

## Erledigt
- Spec-Draft-PR #1114 ausgecheckt (`ai/harness/1110`, closingIssuesReferences=[1110]); lokale
  untracked Duplikate der Phasen-Notizen waren byteidentisch mit dem Branch → gelöscht, Switch sauber.
- **AK1/AK2** `frontend/src/components/NearbyCard.tsx`: `getGeoConfig()` beim Mount,
  `Math.round(config.displayDistanceKm)` → `_label={\`In der Nähe (${n} km)\`}`; `null` (vor dem
  Fetch bzw. bei Fehler) → Basistitel „In der Nähe". Neue `displayDistanceKm`-State + eigener
  useEffect mit `cancelled`-Guard.
- **AK4** `frontend/src/components/TaskForm.tsx`: Echo-Guard — `selectedAddressRef`
  (useRef, weil der KoliBri-Echo vor dem nächsten Render eintreffen kann) wird in `onSelect`
  gesetzt; `onValueChange` überspringt das Koordinaten-Clearing, wenn `next === ref` (sonst
  zurücksetzen). Zweite Hälfte: `notifyTasksChanged()` nach erfolgreichem Save (nur
  `!isSeriesMode`), damit die Card ohne Reload neu lädt.
- **AK4 (Card-Seite)** neu `frontend/src/lib/tasksChanged.ts` (`TASKS_CHANGED_EVENT` +
  `notifyTasksChanged`, Präzedenz `GEO_CONFIG_CHANGED_EVENT`) + Listener in NearbyCard
  (`refreshKey`-State, dritte useEffect-Abhängigkeit `[position, refreshKey]`).
- **Test-Pflege** `frontend/src/components/NearbyCard.test.tsx:53` (Locator-Helper,
  Assertions unverändert): `getByText('In der Nähe (')` kann nie treffen — der Mock spiegelt
  `_label` nur als Attribut, und `getNodeText` liest nur direkte Textkinder →
  `document.querySelector('[data-comp="kol-card"]')`. Zusätzlich `screen` aus dem
  @testing-library-Import entfernt (sonst ESLint no-unused-vars). Begründung im PR-Body.
- Verifikation: Unit `NearbyCard.test.tsx` 4/4 grün, `TaskForm.test.tsx` 66/66 grün,
  Server `tasks-nearby.test.ts` 7/7 grün (Verriegelung unverändert),
  e2e `issue-1110-nearby-radius.spec.ts` 4/4 grün, Regression
  `issue-1066` + `issue-1061` + `issue-1098` 12/12 grün.

## Relevante Stellen
- `frontend/src/components/NearbyCard.tsx:30-57` — Config-Fetch (AK1/AK2); `:67-89` —
  List-Fetch, jetzt auch auf `refreshKey` (AK4); `:93` — dynamischer `_label`.
- `frontend/src/components/TaskForm.tsx:297-308` — `applyAddressCoords` + `selectedAddressRef`
  (AK4-Kern); `:962-980` — `onValueChange`/`onSelect` mit Echo-Guard; `:672-678` —
  `notifyTasksChanged()` vor `onSaved()`.
- `frontend/src/lib/tasksChanged.ts` — neu, Event-Konstante + Dispatcher.
- `server/src/express/routes/tasks.ts:345-383` — unverändert (AK3-Verriegelung grün bestätigt).

## Annahmen
- Der KoliBri-„Echo" (zweites `onValueChange` nach der Selektion, das die Koordinatenwarf)
  kommt vom `_value`-Prop-Sync bzw. nativen change-Event beim Verlassen des Feldes — der
  Wert-Vergleich deckt beide Ursprünge, ohne den exakten Mechanismus zu pinning.
- Live-Refresh der Nearby-Liste nach dem Anlegen ist von AK4 („erscheint … in der
  Nearby-Liste") gedeckt — der Spec-Test verlangt es wörtlich, deshalb umgesetzt (kein
  Scope-Drift); für Serien-Saves bewusst kein Event.
- 375px-/1280px-Layoutprüfung über bestehende e2e abgedeckt: `issue-1066-nearby-card.spec.ts`
  AK5 (Bounding-Box) + `issue-1098-geo-settings.spec.ts` AK1/AK3 (375px) grün; der Titel wird
  nur um wenige Zeichen länger (Playwright-MCP-Check deshalb nicht zusätzlich gefahren).

## Verworfen
- Echo-Guard in `AddressAutocomplete.tsx` (change() gar nicht weiterreichen) — der Wert gehört
  zum Parent-State; der Vergleich gegen die übernommene Adresse ist im Parent korrekter und
  hält die generische Combobox-Logik unberührt.
- Refetch über `key`-Remount von `<NearbyCard />` im Dashboard — hätte App/Dashboard-State
  verdrahtet; Fenster-Event ist das etablierte Muster (#1103 F6).
- Test-Änderung über den Locator hinaus — Separation of Duties; nur der toter Helper wurde
  ersetzt, alle vier Assertions stehen wortgleich.

## Offen
- Wegwerf-Artefakt untracked in `.ai-memory/`, NICHT committen: `issue-1110-pr-body.md`
  (PR-Body-Quelle für `gh pr edit --body-file`). Nur diese Datei hier ist die Phasen-Notiz.

## Nächster Schritt
- Review-Phase (Kreuzverhör) über PR #1114; Test-Pflege-Bedarf (NearbyCard.test.tsx:53) muss im
  PR-Body stehen und im Review bestätigt werden.

## Fallstricke
- `getByText` (Testing Library) liest nur DIREKTE Textkinder (`getNodeText`) — Attribut-Spiegel
  (KoliBri `_label` → `data-label`) ist damit unsichtbar; Locator-Helper immer auf das reflektierte
  Attribut bzw. den Host bauen, nicht auf Titel-Text.
- Nach `onSelect` feuert das Adressfeld nochmal `onValueChange` mit der Treffer-Adresse — ohne
  Echo-Guard werden die Koordinaten als „Freitext" verworfen (exakt die #1110-Ursache).
- Die Nearby-Card fetched NUR bei `position`-Wechsel — ein frisch angelegter Task erscheint sonst
  erst beim nächsten Mount/Reload (AK4-Falle).
- Routing-Tabelle (impl sonnet/high, review sonnet/high) bindend.

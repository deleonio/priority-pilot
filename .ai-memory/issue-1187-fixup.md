# Issue 1187 — Fixup (PR #1195), Stand 2026-09-03

## Erledigt
- **F1** (`frontend/src/lib/reducedMotion.test.ts:28-56`): Fake-MQL um `addEventListener`/
  `removeEventListener` erweitert, die bei `type === 'change'` in die `listeners`-Menge
  schreiben/diesen entfernen — AK2c/d/e liefen dagegen grün (lokal verifiziert, 5/5 passed).
- **F2** (`frontend/src/lib/reducedMotion.ts:20-33`): `typeof addEventListener`-Guard gestrichen,
  Registrierung jetzt bedingungslos wie `theme.ts:101-102` (Hausmuster).
- **CI e2e (2) rot, review behauptete grün** — Root Cause per Playwright-Sonden gefunden:
  1. Banner-Lokator `[slot="tab-0"] kol-alert` trifft 0 Elemente, weil KolTabs die light-DOM-slot-
     Attribute zur Laufzeit umbenennt (`tab-0` → `tabpanel-slot-*`, MEMORY 2026-08-23). Fix:
     `.settings-general kol-alert` (stabile Panel-Klasse, Hauskonvention wie
     `settings-action-buttons.spec.ts:134`). → AK1/AK6 grün.
  2. AK2-Race: `emulateMedia` feuerte das change-Event, BEVOR React den passiven Effect des Hooks
     gespült hatte (Sonden-Beleg: keine ADD-Registrierung zum Zeitpunkt des Events) → Event verloren,
     Banner bleibt aus. Fix: vor `emulateMedia` harmloser Klick auf den aktiven Tab „Allgemein“ —
     React spült offene passive Effects vor der nächsten Event-Dispatch, danach ist der Listener
     garantiert registriert. → AK2 grün.
- Gate (gate-runner): format/prettier/lint/knip/test alles exit 0 (252 Tests, fail 0; Redis lokal
  erreichbar, session.test.ts unproblematisch).
- E2e-Verifikation: `npx playwright test e2e/issue-1187-reduced-motion.spec.ts` → 4/4 passed.
- Commit + Push auf `ai/harness/1187`, beide Review-Threads (F1/F2) via GraphQL aufgelöst.

## Relevante Stellen
- `frontend/src/lib/reducedMotion.test.ts` — Stub `stubReducedMotion`; add/remove-Verkabelung in `listeners`.
- `frontend/src/lib/reducedMotion.ts` — Hook, jetzt wörtlich dem theme.ts-Muster folgend.
- `frontend/e2e/issue-1187-reduced-motion.spec.ts:75-79` (Lokator), `:101-121` (AK2 mit Tab-Klick-Gate).
- `frontend/src/components/SettingsPage.tsx:250` — `.settings-general` = Panel-Anker tab-0; `:289-294` = bedingtes KolAlert.

## Annahmen
- Der Tab-Klick vor `emulateMedia` ist deterministisch genug (React spült passive Effects synchrom
  vor Event-Dispatch — stabiles Verhalten seit React 17/18; einmalige Verifikationsläufe grün).
- Review-Aussage „E2E AK1/AK2/AK5/AK6 grün“ war falsch — CI-Lauf 33703975288 (Shard 2) ist
  autoritativ gewesen; beide e2e-Fehlerarten waren testseitig, kein Produktionscode-Bug.

## Verworfen
- Playwright-MCP-Layout-Check — kein sichtbares UI-Element geändert (Logik + Tests); AK6 deckt
  die 375px-Aussage bereits e2e ab.
- CDP-Poll (`DOMDebugger.getEventListeners`) als Alternative zum Tab-Klick — überengineert für
  den Zweck; Klick ist idiomatischer und kürzer.
- Eigener Kommentar zum e2e-Befund im ai-review-Kommentar — verboten (Review-Kommentar unangetastet lassen).

## Offen
- CI nach Push beobachten (nächster Lauf testet den neuen SHA).

## Nächster Schritt
- Warten auf CI; bei Grün parkt der PR im normalen Review-Fluss.

## Fallstricke
- KolTabs-slot-Umbenennung betrifft ALLE neuen Settings-e2e-Lokatoren — nie `[slot="tab-N"]`
  schreiben, immer `.settings-general`/`.settings-geo` scopen.
- emulateMedia direkt nach Navigation = Race gegen passive Effects; vorher Interaktion (Klick)
  einbauen oder anderweitig Effect-Flush garantieren.

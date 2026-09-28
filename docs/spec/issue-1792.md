# Spec: Issue 1792 — Balance-Priorisierung als Standard, Einstellungs-Schalter, Einmal-Hinweis

**Stand:** 2026-09-28 (Spec-Phase)
**Quellen:** Harness-Kommentar (KI-ANALYSE stand=2026-09-27T22:15:00Z, KI-UX-Block), `frontend/src/lib/aiPreferences.ts`, `frontend/src/lib/balanceVariant.ts` (Präferenz-Muster), `frontend/src/components/InstallPrompt.tsx` (Dismiss-Muster), `frontend/e2e/balance-priority.spec.ts` (Bestand).

## Ziel

Die Aufgabenliste ist standardmäßig nach Balance-Priorisierung sortiert (statt Original-Prio).
Umschaltbar an zwei synchronen Schaltern — Ansichts-Leiste (`App.tsx:1092`) und Einstellungen →
Allgemein —, Zustand im localStorage-Key `pp-balance-priority` (Default **an**). Ein einmaliger
Hinweis über der Aufgabenliste erklärt die Umstellung und nennt den Weg zum Abschalten. Der
Rechenkern `frontend/src/lib/balancePriority.ts` bleibt unangetastet; die Server-`priority` wird
nie verändert.

## Vertrag `frontend/src/lib/balancePreferences.ts` (neu)

Muster `aiPreferences.ts`: reine Funktionen, Best-Effort-Zugriff — ein fehlender, ungültiger oder
gesperrter `localStorage` wirft nicht und liefert den Default.

| Export                                         | Vertrag                                                                                                                                 |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `BALANCE_PRIORITY_STORAGE_KEY`                 | `'pp-balance-priority'`                                                                                                                 |
| `BALANCE_HINT_DISMISS_KEY`                     | `'pp-balance-hint-dismissed'`                                                                                                           |
| `readBalancePreferences()`                     | `{ balancePriority: boolean }`; Default `true` — auch bei ungültigem Wert (alles außer `'true'`/`'false'`) und gesperrtem Storage (AK1) |
| `storeBalancePreferences({ balancePriority })` | schreibt `'true'`/`'false'` in den Key; Fehler (voller/gesperrter Storage) werden ignoriert                                             |
| `isBalanceHintDismissed()`                     | `boolean`; Default `false`, sonst der Dismiss-Key (AK4)                                                                                 |
| `dismissBalanceHint()`                         | setzt den Dismiss-Key persistiert auf `'true'` (AK4)                                                                                    |

## Verhalten

- **AK2 (Default an):** Ohne gespeicherte Präferenz rendert die Aufgabenliste im Balance-Modus —
  Defizit-Task (Original-Prio 1) über dem höher priorisierten Task aus ausgeglichener Säule
  (Prio 5), virtuelle `~P`-Badges, Ansichts-Schalter gecheckt — ganz ohne Schalterklick.
- **AK3 (Abschalten, Persistenz, Synchronität):** Abschalten am Ansichts-Schalter ODER am
  Einstellungs-Schalter stellt Original-Sortierung und Original-Badges wieder her und schreibt
  `pp-balance-priority = 'false'`; nach Neuladen bleibt der Zustand. Beide Schalter zeigen stets
  denselben Zustand: Der Einstellungs-Schalter spiegelt den Key und schreibt ihn beim Umlegen
  (`KolInputCheckbox _variant="switch"`, Label „Balance-Priorisierung", Platzierung beim
  `BalanceVariantSetting`, `SettingsPage.tsx:413`).
- **AK4 (Einmal-Hinweis):** Solange weder Dismiss-Flag noch gespeicherte Präferenz existiert,
  erscheint über der Aufgabenliste ein `KolAlert _type="info"` mit `_label` (KI-UX: Erklärung
  gehört in den Listenkontext, nicht in die Ansichts-Leiste), der den Weg zum Abschalten nennt
  („Einstellungen") und ein direktes Wegkippen anbietet (`KolButton _variant="ghost"` im Alert,
  Präzedenz `SettingsPage.tsx:651`). Dismiss setzt den Dismiss-Key; auch das erste explizite
  Abschalten (egal welcher Schalter) setzt ihn. Danach erscheint der Hinweis auch nach Neuladen
  nicht mehr (KI-UX: nach Dismiss verschwindet die Fläche komplett).
- **AK5 (Mobile-first 375px):** Hinweis und beide Schalter liegen mit ihrer Bounding-Box
  vollständig im 375px-Viewport (App-Shell clippt `overflow-x`, daher Bounding-Box statt
  `scrollWidth`; `boundingBox()` ggf. mehrfach nachmessen, Muster `helpers.ts`).

## Schrittfolge (Umsetzungsphase, nicht Teil des Spec-PRs)

1. `balancePreferences.ts` nach Vertrag; `App.tsx`: `balanceMode` initial aus
   `readBalancePreferences()` lesen, Schalterwechsel persistieren, Hinweis-Komponente über der
   Aufgabenliste; veralteter Kommentar `App.tsx:206` („session-lokal", #1345) mitpflegen.
2. `SettingsPage.tsx`: Schalter im Allgemein-Tab (Key spiegeln + schreiben).
3. `TaskTree.tsx`: unverändert (Sortierzweig existiert bereits).

## Testabbildung

| AK                      | Test                                                                                                                                                | Art    |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AK1                     | `frontend/src/lib/balancePreferences.test.ts` (neu; Default, ungültiger Wert, Roundtrip, gesperrter Storage, Dismiss-Key)                           | Vitest |
| AK2 + AK3               | `frontend/e2e/balance-priority.spec.ts` — Default-an ohne Schalterklick, Abschalten, `page.reload()`, synchroner Zustand beider Schalter            | E2E    |
| AK3 (Settings-Schalter) | `frontend/src/components/SettingsPage.test.tsx` — Schalter spiegelt gespeicherten Wert, Wechsel schreibt den Key                                    | Vitest |
| AK4                     | E2E — Hinweis sichtbar → Dismiss → `page.reload()` → weg (Key `pp-balance-hint-dismissed`); explizites Abschalten unterdrückt den Hinweis ebenfalls | E2E    |
| AK5                     | E2E 375px — Bounding-Box von Hinweis und beiden Schaltern im Viewport                                                                               | E2E    |

**Test-Pflege:** Der Bestandstest in `balance-priority.spec.ts` nahm Default **aus** an („Ohne
Balance-Modus: Original-Prio bestimmt die Reihenfolge") und widerspricht AK2 — er wird umgebaut.
Weitere Specs, die beim erstbesten Listenstand die Original-Reihenfolge oder die Abwesenheit eines
Hinweises annehmen, sind in der Umsetzung gegenzuprüfen (KI-ANALYSE-Randbedingung).

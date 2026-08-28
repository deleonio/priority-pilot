# Spec: Settings KI deaktivierbar (#1080)

**Stand:** 2026-08-28

## Ziel

Im Settings-Tab „KI-Provider" gibt es zwei voneinander unabhängige, clientseitig persistierte
Schalter: „KI-Features aktiv" (Hauptschalter) und „Schnellerfassung aktiv". Ist der Hauptschalter
aus, verschwindet der Toolbar-Button „Säulen-Berater" und die Lektorat-Buttons aus dem Anlage- und
Bearbeiten-Formular. Ist die Schnellerfassung aus, öffnet „Neuen Task anlegen" direkt das
Task-Formular statt des Capture-Schritts.

## Vorbedingungen

- Persistenz rein clientseitig per `localStorage` (Muster `frontend/src/lib/voiceAutostart.ts`,
  Best-Effort, kein Crash bei gesperrtem Storage). Neue Datei `frontend/src/lib/aiPreferences.ts`:
  - `AI_ENABLED_STORAGE_KEY = 'pp-ai-enabled'`
  - `QUICK_CAPTURE_ENABLED_STORAGE_KEY = 'pp-quick-capture-enabled'`
  - `readAiPreferences(): { aiEnabled: boolean; quickCaptureEnabled: boolean }`
  - `storeAiPreferences(prefs: { aiEnabled: boolean; quickCaptureEnabled: boolean }): void`
- **Defaults = Status quo** (`aiEnabled: true`, `quickCaptureEnabled: true`), damit bestehende
  e2e (`quick-capture.spec.ts`, `pillar-advisor*.spec.ts`, `lektorat-button.spec.ts`,
  `header-consistency`/`mobile-shell`) unverändert grün bleiben.
- Werte werden als `'true'`/`'false'` gespeichert; fehlender, ungültiger oder nicht lesbarer
  Eintrag → Default. Server-Endpunkte bleiben erreichbar — die Deaktivierung ist reine
  UI-Ausblendung, keine API-Änderung.
- Schalter im Tab „KI-Provider" (`SettingsPage.tsx`, `div.settings-llm`) als
  `KolInputCheckbox _variant="switch"` in `.settings-llm-switch-row`-Zeilen (analoges Muster zu
  `.settings-switch-row` im Tab „Allgemein", #971, aber eigene Klasse: der #971-e2e-Guard zählt
  `.settings-switch-row`-Vorkommen im Tab „Allgemein", und `KolTabs` hält inaktive Panels
  gemountet) — **positiv** formuliert (KI-UX-Empfehlung: Switch-an = Funktion-da), Reihenfolge
  Hauptschalter → Hinweis-Alert → Schnellerfassung-Option.

## Verhalten (AK1–AK6)

| AK  | Erwartung                                                                                                                                      |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| AK1 | Tab „KI-Provider" enthält Switch „KI-Features aktiv", Default geprüft (= KI aktiv), umschaltbar                                                |
| AK2 | `aiEnabled = false` → Toolbar-Button „Säulen-Berater" nicht gerendert; Anlege- und Bearbeiten-Formular enthalten keinen „… lektorieren"-Button |
| AK3 | Tab „KI-Provider" enthält zusätzlich Switch „Schnellerfassung aktiv", unabhängig vom Hauptschalter wählbar (auch bei aktivem Hauptschalter)    |
| AK4 | `quickCaptureEnabled = false` → „Neuen Task anlegen" öffnet direkt das Task-Formular (Feld „Titel") ohne Capture-Textarea „Beschreibe …"       |
| AK5 | Beide Einstellungen überleben `page.reload()` unverändert                                                                                      |
| AK6 | 375px Viewport: beide Switches sichtbar, ≥44px Touch-Target, vollständig in der Viewport-Breite, kein horizontaler Scroll                      |

Hinweis AK2: Anlege- und Bearbeiten-Formular nutzen dieselbe Komponente `TaskForm` — der Test
deckt beide Dialoge ab (Create-Direktöffnung mit ausgeschalteter Schnellerfassung, danach
Bearbeiten-Dialog eines per API angelegten Tasks).

## Schritte

1. Präferenzen vor dem Seitenaufbau setzen: `page.addInitScript` auf die Storage-Keys
   (`localStorage.setItem(...)`) — wie `pp-voice-autostart` in `voice-autostart.spec.ts`.
2. UI-Zustände über Rollen adressieren: `getByRole('switch'|'checkbox', { name })` (KoliBri-Fallback),
   Toolbar über `getByRole('toolbar', { name: /Kopf-Aktionen/ })`.
3. Switch-Zustand per `toBeChecked()`/`not.toBeChecked()` prüfen (implizites `aria-checked`,
   nicht per Attribut); Ausblendung per `toHaveCount(0)` (nicht gerendert).

## Erwartetes Ergebnis

- Zwei unabhängige Schalter im Tab „KI-Provider", sofort wirkend (kein Speichern-Button) und
  über Reload persistent.
- KI aus: kein „Säulen-Berater" in der Toolbar, keine Lektorat-Buttons im TaskForm.
- Schnellerfassung aus: Anlegen geht direkt ins Task-Formular (auch für den Berater-Übernahme-Prefill,
  `initialText` → `initialValues.description`).
- Bestehende Tests bleiben unverändert grün (Defaults = Status quo).

## Testmapping

- AK1, AK3, AK5 → `frontend/e2e/ai-disable.spec.ts` (Settings-Tab „KI-Provider").
- AK2 → `frontend/e2e/ai-disable.spec.ts` (Toolbar + Create-/Bearbeiten-Formular).
- AK4 → `frontend/e2e/ai-disable.spec.ts` (Create-Flow ohne Capture-Schritt).
- AK6 → `frontend/e2e/ai-disable.spec.ts` (Viewport 375×812, `.settings-switch-row`-Muster).
- Pure Funktionen (Defaults, Roundtrip, ungültiger/gesperrter Storage) →
  `frontend/src/lib/aiPreferences.test.ts` (Muster `voiceAutostart.test.ts`).
- Dedup: AK4-Grünfall (Capture-Schritt existiert) ist bereits in `quick-capture.spec.ts` gesichert;
  hier wird nur der Deaktivierungs-Pfad neu getestet.

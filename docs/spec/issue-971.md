# Spec #971 — Switch-Layout im Tab „Allgemein" der Einstellungen

**Issue:** [#971](https://github.com/deleonio/priority-pilot/issues/971) · **Typ:** UI-Layout (Frontend, kein Server-Kontakt)
**Format-Referenz:** `docs/spec/user-journeys.md` · **Betroffen:** `frontend/src/components/SettingsPage.tsx`, `frontend/src/app.css`, `frontend/e2e/settings-switch-layout.spec.ts`

## Ziel

Die drei Switches im Tab „Allgemein" der Einstellungen (`Sprachaufnahme automatisch starten`, `Push-Nachrichten aktivieren`, `Standort erfassen`) erhalten ein responsives Zeilen-Layout (`div.settings-switch-row` je Switch + zugehörige Alerts):

- **Mobile (<768px):** volle Breite, Stack-Layout (Switch oben, Alerts darunter).
- **Desktop (≥768px):** eine Zeile pro Switch (`flex-direction: row; align-items: center`), Alert rechts neben dem Switch (`margin-left: auto`, `max-width: 60%`).

**Abgrenzung (verbindlich, aus Issue-Analyse):**

1. Der „Push testen"-Button und die Test-Push-Ergebnis-Alerts (`success`/`error`) gehören zur Button-Aktion (#932/#886) und bleiben **eigene Zeilen außerhalb** des Wrappers.
2. Der `geoSupported`-Else-Alert („Standort nicht verfügbar", ersetzt den Switch) bleibt **außerhalb** eines Wrappers.
3. `KolInputCheckbox _variant="switch"`-Props, `useShadowDOMLayout` und das KoliBri-Shadow-DOM bleiben unverändert. AK2 („Label links, Switch rechtsbündig") ist mit dem unteilbaren KoliBri-Host nicht wörtlich erreichbar — verbindlich ist die konkrete CSS-Vorgabe aus dem Ticket (Row-Layout, Alert rechts via `margin-left: auto`).

## Vorbedingung

- Angemeldeter Nutzer, `/settings/general` geöffnet, Tab „Allgemein" sichtbar.
- Die 3 Switches sind als `KolInputCheckbox _variant="switch"` gerendert und über `getByRole('switch'|'checkbox')` adressierbar (Name = Label-Text).
- Für Alert-Tests: `navigator.mediaDevices.getUserMedia` mockt mit `NotAllowedError` → Toggle des Sprachaufnahme-Switches zeigt den `micDenied`-Warn-Alert („Mikrofon-Zugriff verweigert").

## Schritte

1. Viewport 375px öffnen, Tab „Allgemein" prüfen.
2. Viewport 1024px öffnen, Tab „Allgemein" prüfen.
3. Sprachaufnahme-Switch mit verweigerter Mikrofon-Berechtigung togglen (mobile + desktop) und Position des Alerts prüfen.
4. Switch-Toggling ohne Mock prüfen (ARIA-Zustand).

## Erwartetes Ergebnis (Akzeptanzkriterien)

| AK  | Erwartetes Verhalten                                                                                                                                                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AK1 | Mobile (<768px): Jeder der 3 Switches liegt in einem `div.settings-switch-row`, der ≈ volle Breite von `.settings-general` einnimmt (Stack-Layout).                                                                                                                                                     |
| AK2 | Desktop (≥768px): `.settings-switch-row` ist `flex-direction: row; align-items: center` (Ticket-CSS Abschnitt 3); Switch-Host unteilbar (Shadow-DOM).                                                                                                                                                   |
| AK3 | Touch-Targets der Switches bleiben ≥44px hoch (keine Höhen-/Padding-Reduktion; Mobile-UI-Regel 2).                                                                                                                                                                                                      |
| AK4 | Kein horizontaler Scroll bei 375px (`scrollWidth ≤ clientWidth`).                                                                                                                                                                                                                                       |
| AK5 | ARIA der 3 Switches bleibt erhalten: rollenadressierbar (`switch`/`checkbox` je KoliBri-Version) + checked-Zustand togglebar. KoliBri rendert einen nativen `<input type="checkbox">` mit IMPLIZITEM `aria-checked` (kein wörtliches Attribut) — Zustand via Accessibility-Baum (`toBeChecked`) prüfen. |
| AK6 | Switch-Alerts (`micDenied`, `pushFailed`, `geoDenied`): mobile **unter** dem Switch (Alert-Oberkante ≥ Switch-Unterkante), desktop **rechts neben** dem Switch (`Alert.x > Switch-Rechtecke`, vertikal zur Zeile zentriert).                                                                            |

## Tests (rot bis Umsetzung)

`frontend/e2e/settings-switch-layout.spec.ts` — jeder Test referenziert die obigen AKs. AK3/AK4/AK5 sind Sicherungs-Tests (Schutz vor Regression durch die Layout-Änderung), AK1/AK2/AK6 sind rot bis Wrapper + CSS existieren.

**Test-Pflege-Bedarf (an Impl-Phase):** `frontend/e2e/issue-843.spec.ts` (AK1/AK2) selektiert `.settings-general > kol-input-checkbox` (Direktkinder). Nach Wrapper-Integration fallen die Switches aus dieser Selektormenge — Selektor auf Nachfahren erweitern (`.settings-general kol-input-checkbox`) oder Wrapper mitmessen, sonst werden die #843-Tests für Switches blind (weiterhin grün, aber ohne Aussage).

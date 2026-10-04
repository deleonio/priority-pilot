# Spec #1970 — KI-Anbieter-Konfiguration hinter „Erweitert"

## Ziel

Der Settings-Tab „KI“ zeigt die komplette Anbieter-Konfiguration (Karte „KI-Provider“ inkl. Formulare für eigene Endpunkte/Token) hinter einem Klappbereich **„Erweitert“**. Standardmäßig ist er zu, einmal geöffnet bleibt er gespeichert. Die Access-Token-Karte („Nutzung“) bleibt außerhalb und sichtbar.

## Variante (KI-UX-Entscheidung)

**V1:** ein `KolDetails _label="Erweitert" _level={3}` **innerhalb** der bestehenden KolCard „KI-Provider“, das die beiden bestehenden `KolDetails` „Provider-Auswahl“ und „Provider verwalten“ umschließt (deren `_level` hebt von 3 auf **4**). Kein Panel-`KolAccordion` (Regel 1 der Design-Sprache: keine Karte in Karte, kein Akkordeon in Karte). Die `#2015`-Guard-Selektoren erfassen diese Verschachtelung nicht — ein Test pinnt, dass nur die beabsichtigte Verschachtelung entsteht.

## Verhalten

| AK  | Verhalten                                                                                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AK1 | Ohne geöffnetes „Erweitert“ sind keine Provider-Bedienelemente sichtbar (Radio-Gruppe „KI-Provider“, Modellwahl, „Neuer Provider“, Provider-Liste, Testen/Bearbeiten/Löschen). Der Klappbereich-Kopf selbst bleibt sichtbar (Discoverability).    |
| AK2 | Der Klappzustand persistiert clientseitig im localStorage-Key **`pp-ki-erweitert-open`** (`'1'` offen, `'0'` zu). Standard ohne Eintrag: zu. Geöffnet bleibt nach Neuladen/Remount offen.                                                         |
| AK3 | Bestehende Konfigurationen funktionieren unverändert hinter „Erweitert“: die vorhandene Unit-Suite `LlmSettings.test.tsx` bleibt grün (mit vorangestelltem Öffnen), E2E `llm-settings.spec.ts` öffnet „Erweitert“ vor den Provider-Interaktionen. |
| AK4 | Bei 375 px ist „Erweitert“ ein volle-Breite-Block (KoliBri-Standard, Touch-Target über `--a11y-min-size` abgedeckt), ohne horizontalen Overflow — im zu- UND im offenen Zustand.                                                                  |

## Klapplogik (KI-UX)

- „Erweitert“ klappt **unabhängig** vom Master-Schalter „KI aktivieren“ und ist **nicht** an `useFollowingOpen` gebunden — der Zustand ist eine Nutzpräferenz, nicht ein Unterausschnitt des Masters.
- Die beiden inneren KolDetails behalten `#1903` unverändert: sie folgen weiter `useFollowingOpen(open)` (`SettingsPage.tsx` übergibt `open={aiEnabled}`).
- Persistieren ist ein synchroner localStorage-Schreibvorgang, kein Speichern-Button.

## Testfälle

| TF  | AK       | Ebene/Datei                        | Inhalt                                                                                                                                                                                        |
| --- | -------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TF1 | AK1      | Vitest `LlmSettings.test.tsx`      | KolDetails-Mock `_open`-abhängig; zu → keine Provider-Bedienelemente erreichbar, nach Öffnen schon                                                                                            |
| TF2 | AK2      | Vitest `LlmSettings.test.tsx`      | Öffnen schreibt `pp-ki-erweitert-open`='1', Schließen '0'; Remount stellt Zustand her; ohne Eintrag zu. Zusätzlich: „Erweitert“ folgt nicht dem Master-Schalter, innere Details schon (#1903) |
| TF3 | AK3      | Regression                         | Bestehende Suite bleibt grün (Öffnen vorangestellt); `llm-settings.spec.ts` klickt „Erweitert“ im `openLlmTab`                                                                                |
| TF4 | AK4      | E2E `issue-1970-erweitert.spec.ts` | 375 px: zu → keine Provider-Felder sichtbar, Kopf klickbar/öffnbar, Bounding-Box ohne Overflow (zu und offen, kein `scrollWidth`)                                                             |
| —   | KI-UX/V1 | Vitest `SettingsPage.test.tsx`     | Verschachtelungs-Pin: `kol-details` „Erweitert“ in der Karte, umschließt ausschließlich „Provider-Auswahl“ + „Provider verwalten“, Level 3→4, kein Akkordeon                                  |

## Außerhalb des Scope

- Die übrigen E2E-Specs, die Provider-Interaktionen fahren (`issue-1577-provider-dialog-test`, `ai-disable`, `issue-1526-access-token-gating`, `issue-1525-ki-schalter-paket`, `issue-1105-routes`), müssen in der Implementierung ebenfalls „Erweitert“ vorher öffnen (Kollateral-Pflege, Phase 4).
- Keine Änderung an der Access-Token-Karte, an #1903-Verhalten oder an KoliBri-Styling.

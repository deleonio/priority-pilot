## Kurz und konkret

Ein Satz pro Feld, ein Punkt pro Zeile.

## Was ist das Problem?
Die KI-Features in den Einstellungen können nicht deaktiviert werden. Der Berater und alle Lektoren-Schalter bleiben sichtbar, obwohl sie ohne aktive KI nicht funktionieren. Die Schnellerfassung beim Anlegen neuer Aufgaben ist immer aktiv, auch wenn der Nutzer sie nicht verwenden möchte.

## Wie soll es sein?
In den KI-Einstellungen gibt es einen Hauptschalter, um das gesamte KI-Feature zu deaktivieren. Wenn deaktiviert, werden der Berater und alle Lektoren-Schalter aus den Menüs ausgeblendet. Zusätzlich gibt es eine Option, um die Schnellerfassung beim Anlegen neuer Aufgaben optional zu deaktivieren, selbst wenn LMKI aktiviert ist.

## Wo tritt es auf?
Einstellungen → KI-Einstellungen
Menüs mit Berater und Lektoren-Schaltern
Formular zum Anlegen neuer Aufgaben (Schnellerfassung)

## Woran messen wir das?
- Es gibt einen Hauptschalter in den KI-Einstellungen zum Deaktivieren des gesamten KI-Features
- Wenn KI deaktiviert ist, sind Berater und alle Lektoren-Schalter in den Menüs nicht sichtbar
- Es gibt eine Checkbox in den KI-Einstellungen, um die Schnellerfassung beim Anlegen neuer Aufgaben zu deaktivieren
- Wenn die Schnellerfassung deaktiviert ist, wird sie im Aufgaben-Formular nicht angezeigt
- Die Einstellungen werden persistent gespeichert und beim Neuladen der Anwendung beibehalten

<!-- KI-ANALYSE:START stand=2026-08-28T03:39:49Z -->
### Umsetzungskontext
- Betroffene Dateien: `frontend/src/lib/aiPreferences.ts` (neu), `frontend/src/components/SettingsPage.tsx`, `frontend/src/App.tsx`, `frontend/src/components/TaskForm.tsx`; Tests: `frontend/src/lib/aiPreferences.test.ts` (neu), `frontend/e2e/ai-disable.spec.ts` (neu)
- Betroffene Komponenten: Settings-Tab „KI-Provider“ (`LlmSettings`, SettingsPage.tsx:303) — Hauptschalter + Option Schnellerfassung; Toolbar-Item „Säulen-Berater“ (App.tsx:432) + `PillarAdvisorModal` (App.tsx:685); Lektorat-Buttons „Titel lektorieren“ (TaskForm.tsx:775) und „Beschreibung lektorieren“ (TaskForm.tsx:983); Create-Dialog `QuickCaptureModal` vs. `TaskFormModal` (App.tsx:652)
- Vorhandenes Muster: `frontend/src/lib/voiceAutostart.ts` — localStorage-Präferenz als reine Funktionen + Hook (Best-Effort, Default aus); Switch-Zeilen `.settings-switch-row` in SettingsPage (#971/#272); `TaskFormModal` unterstützt `task: null` + `initialValues` bereits (TaskFormModal.tsx:18-21) — direktes Anlegen ohne Capture-Schritt braucht keinen neuen Dialog
- Persistenz bewusst clientseitig per localStorage (wie Theme und Voice-Autostart): Das AK „beim Neuladen beibehalten“ ist damit erfüllt; kein serverseitiges User-Setting und keine API-Änderung nötig. Server-Endpunkte bleiben unverändert erreichbar — die Deaktivierung ist eine reine Ausblendung in der UI.
- Randbedingungen: Defaults = Status quo (KI aktiv, Schnellerfassung aktiv), damit bestehende e2e (`quick-capture.spec.ts`, `pillar-advisor*.spec.ts`, `lektorat-button.spec.ts`) nicht brechen; der Berater-„Übernehmen“-Flow (#327, `initialText`) muss auch ohne Schnellerfassung funktionieren (`initialText` → `initialValues.description` im `TaskFormModal`); Bearbeiten-Dialog (`kind: 'edit'`) zeigt Lektorat-Buttons ebenfalls nur bei aktivem KI.
- Erwartetes Ergebnis: Zwei unabhängige, persistente Einstellungen im Tab „KI-Provider“; bei deaktivierter KI verschwinden Säulen-Berater-Toolbar-Button und beide Lektorat-Buttons aus der UI; bei deaktivierter Schnellerfassung öffnet das Anlegen direkt das Task-Formular.

### Akzeptanzkriterien
- AK1: Im Settings-Tab „KI-Provider“ existiert ein Hauptschalter zum Deaktivieren der KI-Features (Default: KI aktiv).
- AK2: Ist der Hauptschalter aktiv, werden der Toolbar-Button „Säulen-Berater“ und die Lektorat-Buttons („Titel lektorieren“, „Beschreibung lektorieren“) im Anlege- und Bearbeiten-Formular nicht gerendert.
- AK3: Im Settings-Tab „KI-Provider“ existiert eine zusätzliche, unabhängige Option „Schnellerfassung deaktivieren“ — wählbar auch bei aktivem KI-Hauptschalter.
- AK4: Ist die Schnellerfassung deaktiviert, öffnet „Neuen Task anlegen“ (Toolbar, Empty-State, Unteraufgabe, Berater-Übernahme) direkt das Task-Formular ohne Capture-Schritt.
- AK5: Beide Einstellungen werden persistent gespeichert (localStorage) und nach Neuladen der Anwendung unverändert angewendet.
- AK6 (Mobile-first): Beide Schalter sind bei 375px Viewport-Breite voll sichtbar und bedienbar (Stack-Layout wie bestehende Switch-Zeilen, kein Abschneiden).

### Testfälle
- AK1/AK3: e2e `frontend/e2e/ai-disable.spec.ts` — Einstellungen → Tab „KI-Provider“: beide Schalter sichtbar (`getByRole('switch')`) und umschaltbar.
- AK2: e2e — Präferenz vor dem Laden gesetzt (`page.addInitScript` auf den localStorage-Schlüssel): Toolbar-Button „Säulen-Berater“ und beide „lektorieren“-Buttons sind nicht sichtbar.
- AK4: e2e — Schnellerfassung deaktiviert: „Neuen Task anlegen“ zeigt direkt das Feld „Titel“ statt der Capture-Textarea „Beschreibe deinen Task“.
- AK5: e2e — Schalter umschalten, `page.reload()`, Zustand bleibt unverändert.
- AK6: e2e — Viewport 375×812: Bounding-Box beider Schalter vollständig im Viewport.
- Unit (Vitest, `frontend/src/lib/aiPreferences.test.ts`): reine Lese-/Schreibfunktionen — Default-Werte, Roundtrip, ungültiger/gesperrter `localStorage` → Default (Muster `voiceAutostart.ts`).

### Ampel
- Ampel: 🟢
- Begründung: Rein frontendseitig, Anforderungen eindeutig, alle Muster vorhanden (localStorage-Präferenz, Switch-Zeilen, `TaskFormModal`-Anlege-Flow); in einem PR umsetzbar.

### ❓ Offene Fragen
- keine
<!-- KI-ANALYSE:END -->

<!-- ai-phase-routing:START -->
| Phase | Run | Modell | Effort |
| --- | --- | --- | --- |
| ux | ja | sonnet | low |
| spec | ja | sonnet | medium |
| impl | ja | sonnet | medium |
| review | ja | sonnet | medium |
<!-- ai-phase-routing:END -->


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

<!-- KI-UX:START -->

## UX-Beratung

### Interaktion

- Settings = flache Liste mit sichtbarem Zustand ohne Antippen (Regel 4): Beide Schalter in `.settings-switch-row` (SettingsPage.tsx:153-236), `KolInputCheckbox _variant="switch"` — Zustand sofort lesbar, kein Speichern-Button (localStorage-Autospeichern passt exakt zu Regel 4).
- Deaktivierung wird dadurch sichtbar, dass Bedienelemente **verschwinden** (Toolbar-Button „Säulen-Berater“, Lektorat-Buttons). Das ist korrekt, aber ein Zustand ohne Erklärung: Nach dem Abschalten sollte im Tab „KI-Provider“ ein kurzer Hinweis stehen, was nun ausgeblendet ist (KolAlert `_type="info"` unter dem Hauptschalter) — sonst wirkt die App für die Person „kaputt“ statt „konfiguriert“.
- AK4-Konsequenz positiv: Direktes Öffnen des TaskFormulars ist ein Gewinn (ein Screen, eine Aufgabe, Regel 5) — ein Schritt weniger im Haupt-Flow.

### Mobile-First

- AK6 über das bestehende Muster lösen: `.settings-switch-row` (app.css:1519) ist bereits mobil Stack (<768px) und Desktop-Zeile (≥768px), inkl. Full-Bleed-Trick und ≥44px Touch-Ziel. Kein neues CSS, keine neue Breitenlogik — neue Zeilen in denselben Container hängen.
- Zwei Schalter + evtl. Alert beim 375px-Viewport: Reihenfolge Hauptschalter → Alert → Schnellerfassung-Option; Abstände aus `--pp-space-*` (3/4 innerhalb der Sektion).

### A11y/BITV

- `KolInputCheckbox _variant="switch"` rendert natives Input mit Rolle Switch und implizitem `aria-checked` — Label über `_label`, Erklärtext über `_hint` (nicht Placeholder). Für das Ausblenden von Bedienelementen braucht es keine Zusatz-ARIA (reines Render/Nicht-Render, kein `aria-hidden`-Toggling).
- Information nie allein über Farbe (1.4.1): „ausgeblendet wegen KI aus“ als Text ausdrücken, nicht als graue/deaktivierte Optik.
- Fokus-Ring über `--pp-focus-ring` bleibt KoliBri-seitig erhalten; DOM-Reihenfolge = visuelle Reihenfolge (Hauptschalter zuerst).
- Kontrast der Hint-Texte in **beiden** Themes gegenprüfen (≥4.5:1, Konvention siehe `--pp-text-hint`-Kommentar in app.css).

### KoliBri

- Komponentenwahl korrekt: `KolInputCheckbox _variant="switch"` (KoliBri-Sample `sample/input-checkbox/switch`), Hinweistext als `KolAlert`, keine rohen `<input>`/`<button>`.

### Design-Sprache

- Nur `--pp-space-*`/`--pp-ink*`/`--pp-surface-*`-Tokens, kein Hex; Settings = Operate → Restrained, kein Signalfarb-Einsatz nötig. Gruppierung über `KolHeading _level=3` und Abstand statt Card-Rahmen (Regel 4).

### Offene UX-Fragen

- Advisory, nicht blockierend: Ticket formuliert „Schnellerfassung **deaktivieren**“ — negativ formulierter Switch mit Default=an invertiert das mentale Modell (Switch-an = Funktion-weg). Empfehlung: positiv formulieren („KI-Features aktiv“, „Schnellerfassung aktiv“, beide Default an) und im Spec festnageln.
- Visuelle Behandlung der Schnellerfassungs-Option bei ausgeschaltetem Hauptschalter ist bewusst offen (AK3: unabhängig wählbar). Empfehlung: sichtbar und bedienbar lassen (kein Disable-Grau), damit AK5 die beiden Präferenzen entkoppelt hält.

<!-- KI-UX:END -->

<!-- ai-phase-routing:START -->
| Phase | Run | Modell | Effort |
| --- | --- | --- | --- |
| ux | ja | sonnet | low |
| spec | ja | sonnet | medium |
| impl | ja | sonnet | medium |
| review | ja | sonnet | medium |
<!-- ai-phase-routing:END -->

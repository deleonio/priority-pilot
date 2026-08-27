### Was ist das Problem?

Im Suchen-Dialog startet die Sprachaufnahme beim Öffnen nicht automatisch, obwohl in den Einstellungen „Sprachaufnahme automatisch starten“ aktiviert ist — das Mikrofon muss dort erst manuell über den Mikrofon-Button gestartet werden. In den anderen Eingabeformularen (Aufgabe/Serie, Schnellerfassung, Säulen-Berater) startet das Mikrofon beim Öffnen automatisch.

### Wo tritt es auf?

- Suche-Dialog (globale Suche)
- frontend/src/components/SearchModal.tsx
- Einstellungen → Allgemein → „Sprachaufnahme automatisch starten“

### Wie soll es sein?

Öffnet man den Suchen-Dialog, startet das Mikrofon im Suchfeld automatisch, wenn die Einstellung „Sprachaufnahme automatisch starten“ aktiviert ist — konsistent zum Verhalten der übrigen Eingabeformulare. Bei deaktivierter Einstellung bleibt alles beim Alten (manuelles Starten per Mikrofon-Button).

### Thema

Feature

### Komplexität

Einfach (klar definiert, isolierte Änderung)

### Woran messen wir das?

- Einstellung aktiviert + Suchen-Dialog öffnen → Mikrofon im Suchfeld läuft ohne weiteren Klick
- Einstellung deaktiviert + Suchen-Dialog öffnen → Mikrofon bleibt aus, manuelles Starten per Button unverändert möglich
- Browser ohne Spracherkennungs-Unterstützung → Suchen-Dialog öffnet ohne Fehler

### Screenshots / weitere Hinweise (optional)

![Suche-Dialog mit Mikrofon-Button](https://github.com/user-attachments/assets/436c1cb3-1230-4a50-97fa-c3a2d53bac46)

<!-- KI-ANALYSE:START stand=2026-08-27T13:11:32Z -->

### Umsetzungskontext

- Betroffene Dateien: `frontend/src/components/SearchModal.tsx`, `frontend/e2e/voice-autostart.spec.ts`
- Betroffene Komponenten: `SearchModal` (React-Komponente), das darin gerenderte `VoiceField` um das Suchfeld (`SearchModal.tsx:45-65`)
- Vorhandenes Muster: `frontend/src/components/QuickCaptureModal.tsx:54` + `:140` — liest die Einstellung einmalig per `const [voiceAutostart] = useState(readVoiceAutostartPreference)` (aus `frontend/src/lib/voiceAutostart.ts`) und reicht sie als `autoStart={voiceAutostart}` an das `VoiceField` durch. Identisch in `PillarAdvisorModal.tsx:145` und `TaskForm.tsx:293/728`. `SearchModal.tsx` ist die einzige Call-Site ohne `autoStart`-Prop.
- Randbedingungen:
  - Der Autofokus auf das Suchfeld (`SearchModal.tsx:22-27`, 200 ms Timeout) muss unverändert bleiben.
  - Die Einstellung wird bewusst **einmalig pro Dialog-Instanz** gelesen (kein Live-Update während der Dialog offen ist) — analog zum Kommentar in `TaskForm.tsx:293`.
  - `VoiceField` kapselt den Auto-Start bereits vollständig (`VoiceField.tsx:59-69`, Ein-Schuss-Flag + StrictMode-sicherer Cleanup); ohne Browser-Unterstützung (`isSupported=false`) ist `startRecording` ein No-op. Es darf keine eigene Auto-Start-Logik in `SearchModal` entstehen.
  - Default der Einstellung bleibt **aus** (`voiceAutostart.ts`, `localStorage`-Key `pp-voice-autostart`).
- Erwartetes Ergebnis: Beim Öffnen des Suche-Dialogs läuft die Aufnahme im Suchfeld genau dann automatisch, wenn die Einstellung aktiv ist; sonst unverändertes Verhalten.

### Akzeptanzkriterien

- AK1: Ist `pp-voice-autostart` = `true`, startet beim Öffnen des Suche-Dialogs die Spracherkennung im Suchfeld ohne weiteren Klick (Mikrofon-Button zeigt den Aufnahme-Zustand).
- AK2: Ist die Einstellung aus (Default), startet beim Öffnen keine Aufnahme; ein Klick auf den Mikrofon-Button startet sie weiterhin manuell.
- AK3: Ist die Einstellung an, der Browser unterstützt aber keine Spracherkennung (kein `SpeechRecognition`), öffnet der Suche-Dialog fehlerfrei; das Suchfeld ist bedienbar, kein Mikrofon-Button.
- AK4: Bei 375 px Viewport gilt AK1 unverändert; der Mikrofon-Button bleibt sichtbar und es entsteht kein horizontaler Überlauf im Dialog.

### Testfälle

Ebene: Akzeptanz-e2e (Playwright) in `frontend/e2e/voice-autostart.spec.ts` — neuer `test.describe`-Block „Suche-Dialog: Voice-Autostart im Suchfeld“, analog zu den bestehenden Blöcken „#281 Schnellerfassung“ (`:432`) und „Säulen-Berater“ (`:511`). Wiederverwendet werden das vorhandene `buildInitScript` (Mock der Web Speech API, Flag `window.__speechRecognitionStarted`) und das Setzen des `localStorage`-Keys `pp-voice-autostart`.

- Zu AK1: Einstellung auf `true` vorbelegen, Suche-Dialog über den Toolbar-Button „Suche“ öffnen (Muster: `frontend/e2e/search-modal.spec.ts:21/62`) → `window.__speechRecognitionStarted === true`, ohne Klick auf den Mikrofon-Button.
- Zu AK2: Ohne `localStorage`-Eintrag Dialog öffnen → `window.__speechRecognitionStarted === false`; danach Klick auf den Mikrofon-Button → `true`.
- Zu AK3: Init-Script mit `speechSupported: false`, Einstellung `true`, Dialog öffnen → Dialog-Heading „Suche“ sichtbar, Suchfeld vorhanden, kein Konsolen-/Page-Error (Muster: AK6 in `voice-autostart.spec.ts:339` und AK3 im Berater-Block `:552`).
- Zu AK4: Viewport 375x667, Einstellung `true`, Dialog öffnen → `window.__speechRecognitionStarted === true`, Mikrofon-Button sichtbar und vollständig im Viewport (Bounding-Box: `x + width <= 375`).

### Ampel

- Ampel: 🟢
- Begründung: Einzige Änderung ist das Durchreichen der bereits existierenden Einstellung an das bereits existierende `autoStart`-Prop des `VoiceField` in `SearchModal.tsx` — Muster an drei anderen Call-Sites vorhanden, Akzeptanzkriterien und Testfälle prüfbar, ein PR.

### ❓ Offene Fragen

- keine

<!-- KI-ANALYSE:END -->

<!-- ai-phase-routing:START -->
| Phase | Run | Modell | Effort |
| --- | --- | --- | --- |
| ux | nein | - | - |
| spec | ja | sonnet | low |
| impl | ja | sonnet | low |
| review | ja | sonnet | medium |
<!-- ai-phase-routing:END -->

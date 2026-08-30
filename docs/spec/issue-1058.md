# Spec #1058 — Suche-Dialog: Sprachaufnahme beim Öffnen automatisch starten

**Stand:** 2026-08-30

## Ziel

Der Suchen-Dialog verhält sich beim Öffnen konsistent zu TaskForm, QuickCaptureModal und
PillarAdvisorModal: ist die Einstellung „Sprachaufnahme automatisch starten“
(`localStorage`-Key `pp-voice-autostart`) aktiv, startet die Spracherkennung im Suchfeld
automatisch — ohne Klick auf den Mikrofon-Button.

## Vorbedingung

- App ist geladen (Dashboard sichtbar).
- Web Speech API ist per Init-Script gemockt (`window.__speechRecognitionStarted`).

## AK1 — Einstellung an → Auto-Start im Suchfeld

### Schritte

1. `pp-voice-autostart` vor dem Laden auf `true` setzen.
2. Suchen-Dialog über den Toolbar-Button „Suche“ öffnen.

### Erwartetes Ergebnis

- `window.__speechRecognitionStarted === true`, ohne Klick auf den Mikrofon-Button.
- Mikrofon-Button des Suchfelds zeigt den Aufnahme-Zustand (`aria-pressed="true"`).

## AK2 — Einstellung aus (Default) → kein Auto-Start

### Schritte

1. Kein `pp-voice-autostart`-Eintrag in `localStorage`.
2. Suchen-Dialog öffnen.

### Erwartetes Ergebnis

- `window.__speechRecognitionStarted === false` nach dem Öffnen.
- Ein anschließender Klick auf den Mikrofon-Button startet die Aufnahme weiterhin manuell
  (`window.__speechRecognitionStarted === true`).

## AK3 — Keine Spracherkennungs-Unterstützung → kein Absturz

### Schritte

1. `pp-voice-autostart` auf `true` setzen.
2. Init-Script ohne `SpeechRecognition` (Browser ohne Unterstützung) laden.
3. Suchen-Dialog öffnen.

### Erwartetes Ergebnis

- Dialog öffnet fehlerfrei (keine `pageerror`-Events).
- Suchfeld ist sichtbar und bedienbar; kein Mikrofon-Button vorhanden.

## AK4 — Mobile-First (375px)

### Schritte

1. Viewport auf 375×667 setzen.
2. `pp-voice-autostart` auf `true` setzen, Suchen-Dialog öffnen.

### Erwartetes Ergebnis

- AK1 gilt unverändert (`window.__speechRecognitionStarted === true`).
- Mikrofon-Button ist sichtbar und liegt vollständig im Viewport (`x + width <= 375`).
- Kein horizontaler Überlauf im Dialog.

## Randbedingungen

- Einstellung wird **einmalig pro Dialog-Instanz** gelesen (kein Live-Update, während der Dialog
  offen ist) — konsistent über alle Felder mit Sprachaufnahme.
- Autofokus liegt auf dem Suchfeld (200 ms nach dem Öffnen).
- Default der Einstellung ist aus (`localStorage`-Key `pp-voice-autostart`).

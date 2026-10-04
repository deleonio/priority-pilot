# Spec: #1972 — Installations-Aufforderung erst nach einem Aha-Moment + PWA-Grenzen-Hinweis bei der Standorterfassung

## Ziel

Die Installations-Aufforderung trifft erst nach einem erlebten Erfolg ein (Aha-Gate: mindestens eine erledigte Aufgabe), nicht beim ersten, noch wertlosen Aufruf. Beim Aktivieren der Standorterfassung erklärt ein Hinweis direkt am Schalter die PWA-Grenze (Nähe-Alarme nur zuverlässig bei geöffneter App) und empfiehlt die Installation. Bestehende Gating-Regeln (dauerhaft geschlossen, installiert/standalone, nativer Kanal nach ADR 0016) bleiben unangetastet; `beforeinstallprompt` bleibt weiterhin `preventDefault()`-iert.

## Vorbedingungen

- App geladen; Aufgabenbestand (`tasks`) liegt bereits im App-State vor (keine Server-/API-Änderung, Muster `DayDoneHint`).
- Aha-Moment = mindestens eine Aufgabe mit Status „Done“ im geladenen Bestand.

## Verhalten

### AK1 — Keine Installations-Aufforderung ohne erledigte Aufgabe

Solange keine Aufgabe als erledigt markiert ist, rendert die App keine Installations-Aufforderung:

- Standard-Browser: auch nachdem `beforeinstallprompt` gefeuert hat, rendert `InstallPrompt` `null`; das Browser-eigene Prompt-Fenster bleibt weiterhin unterdrückt (`preventDefault()`).
- iOS-Safari-Fallback: zeigt auch beim ersten Laden (ohne Event) keine Anleitung.

### AK2 — Mit erledigter Aufgabe gelten die bestehenden Regeln

Nach mindestens einer erledigten Aufgabe erscheint die Installations-Aufforderung gemäß den bestehenden Gates:

- nicht installiert (kein Standalone-Modus) **und** nicht dauerhaft geschlossen (`pwa-install-dismissed`) **und** kein nativer Kanal → Prompt sichtbar.
- dauerhaft geschlossen → auch mit erledigter Aufgabe kein Prompt.

### AK3 — PWA-Grenzen-Hinweis am Schalter „Standort erfassen“

Wird die Standorterfassung aktiviert (`geoEnabled` = true), ist unter dem Schalter ein `KolAlert _type="warning"` sichtbar (Rolle wie der `geoDenied`-Hinweis, kein Toast, kein Fokus-Raub):

- Label: **„Nähe-Alarm nur bei geöffneter App“**
- Text: nennt die Grenze („… nur zuverlässig, solange die App geöffnet ist“) und empfiehlt die Installation (Text, kein zweiter Install-Button — die Aktion bleibt beim InstallPrompt-Flow).
- Bei deaktivierter Erfassung wird kein solcher Knoten gerendert (vollständiges Entfernen, nicht nur versteckt).

### AK4 — 375 px (und 320 px, KI-UX-Ergänzung)

Dasselbe Verhalten bei 375 px Viewport: Hinweis sichtbar, kein horizontaler Überlauf — geprüft über die Bounding-Box (die App-Shell clippt mit `overflow-x: hidden`; `scrollWidth` ist ungeeignet). Der gleiche Check läuft ergänzend bei 320 px, sonst hat er bei schmalen Geräten keinen Biss.

## Testfälle

| AK  | Ebene          | Datei                                                                                                                                        |
| --- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| AK1 | Vitest Unit    | `frontend/src/components/InstallPrompt.test.tsx` (ohne Done-Task: Standard-Browser + iOS-Fallback)                                           |
| AK2 | Vitest Unit    | ebenda (mit Done-Task + Event → sichtbar; dismissed → unsichtbar)                                                                            |
| AK3 | Vitest Unit    | `frontend/src/components/SettingsPage.test.tsx` (Alert bei enabled=true mit Label + Grenz-/Installationstext, bei enabled=false kein Knoten) |
| AK4 | Playwright e2e | `frontend/e2e/issue-1972-install-aha.spec.ts` (375 px + 320 px Bounding-Box; erster Load ohne Done-Task → kein Install-Alert)                |

## Offene Punkte

- Keine.

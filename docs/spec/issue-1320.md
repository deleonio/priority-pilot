# Issue 1320 — Einstellungen und Hilfe als normale Seite statt Fullscreen-Overlay mit Zurück-Button

Spezifikation (Stufe 1 TDD, rote Tests): `docs/spec/issue-1320.md`.
Basis: Issue #1320 + KI-ANALYSE-Block + KI-UX-Block (Harness-Kommentar, stand 2026-09-09T17:35:11Z).

## Ziel

`/settings/:tab` und `/hilfe` sind heute frühe Returns **vor** dem App-Layout
(`frontend/src/App.tsx:600` `if (showSettings) return <SettingsPage …>`, `:614`
`if (showHelp) return <HelpPage …>`) — beide Seiten rendern ein eigenes `<main>` und
ersetzen dadurch Header, Toolbar-„Kopf-Aktionen" und Ansichten-Tabs vollständig. Nach
dem Umbau bleiben Header (Logo, Toolbar, Avatar) und Footer auf allen drei Ansichten
(Dashboard/Aufgaben/Serien/Wald, Einstellungen, Hilfe) sichtbar; nur der Seiteninhalt
wechselt. Die Zurück-Buttons in `SettingsPage.tsx` und `HelpPage.tsx` entfallen; der
Rückweg läuft über den bereits aktiven Toolbar-Button „Einstellungen"/„Hilfe" (Klick
darauf = Umschalter zurück zur zuletzt aktiven Hauptansicht, Fallback `/`). Ein Klick
auf den jeweils anderen Toolbar-Button wechselt direkt zwischen Einstellungen und
Hilfe, ohne Zwischenschritt über das Dashboard. Aktiver Zustand app-seitig über
`aria-current="page"` (KoliBri bietet kein natives Pressed-Prop, KI-UX).

## Voraussetzungen

- Routen `/settings/:tab` und `/hilfe` inkl. Deep-Link, Tab-Ableitung und Browser-Back
  bleiben unverändert (#1105); Navigation weiter über `navigate()`.
- Genau ein `<main>` und genau eine `<h1>` pro Ansicht — `SettingsPage`/`HelpPage`
  verlieren ihr eigenes `<main>`-Element, die `<h1 class="visually-hidden">Dashboard</h1>`
  aus `App.tsx:646` wird je Ansicht durch den passenden Seitentitel ersetzt.
- App-State lebt außerhalb des Routers; `SettingsPage` behält ihre eigenen
  Hook-Instanzen (`App.tsx:525-527`) — der Umbau darf keinen Remount der App
  auslösen.

## Akzeptanzkriterien

### AK1 — Header bleibt auf `/settings/*` sichtbar

- Ablauf (e2e): `/settings/general` öffnen.
- Erwartetes Ergebnis: `header[role="banner"]` mit Logo, die Toolbar „Kopf-Aktionen"
  und der Avatar sind sichtbar; der Einstellungen-Inhalt steht darunter.

### AK2 — Header bleibt auf `/hilfe` sichtbar

- Ablauf (e2e): `/hilfe` öffnen.
- Erwartetes Ergebnis: Header und Toolbar sind ebenso sichtbar; die Hilfe-Tabs
  (Handbuch/Changelog) stehen darunter.

### AK3 — Kein „Zurück"-Button mehr

- Ablauf (e2e): `/settings/general` bzw. `/hilfe` öffnen.
- Erwartetes Ergebnis: Es existiert kein Button mit dem zugänglichen Namen „Zurück".
  Ersetzt den bisherigen #270-Test „Zurück-Button führt von /settings/pillars zurück
  zum Dashboard" (`settings-page.spec.ts`) und den #256-Test „Zurück-Button auf der
  Hilfe-Seite führt zurück zur Haupt-App" (`help.spec.ts`) — beide widersprechen AK3
  und werden durch den AK5-Test ersetzt (Test-Pflege-Bedarf).

### AK4 — Direktwechsel Einstellungen ↔ Hilfe über die Toolbar

- Ablauf (e2e): Auf `/settings/general` den Toolbar-Button „Hilfe" klicken; Gegenrichtung
  auf `/hilfe` den Button „Einstellungen" klicken.
- Erwartetes Ergebnis: Die URL wechselt direkt (`/hilfe` bzw. `/settings/general`),
  ohne Zwischenschritt über `/`.

### AK5 — Aktiver Toolbar-Button schaltet zur vorherigen Hauptansicht zurück

- Ablauf (e2e): `/aufgaben` öffnen, Toolbar „Einstellungen" klicken (→
  `/settings/general`), erneut „Einstellungen" klicken. Zusätzlich: Kaltstart direkt auf
  `/settings/general` (keine vorherige Hauptansicht in der Session), dann
  „Einstellungen" klicken.
- Erwartetes Ergebnis: Erster Fall führt zurück zu `/aufgaben`; Kaltstart-Fall führt zu
  `/` (Fallback).

### AK6 — Browser-Zurück und Deep-Links bleiben erhalten

- Ablauf (e2e): Von `/settings/general` zu `/settings/llm` wechseln, dann
  `page.goBack()`; separat `/settings/standort` direkt aufrufen (Deep-Link).
- Erwartetes Ergebnis: `goBack()` stellt `/settings/general` mit aktivem
  „Allgemein"-Tab wieder her; der Deep-Link-Aufruf zeigt den Standort-Tab mit
  sichtbarem `header[role="banner"]` (kein leeres/falsches Layout beim Kaltstart).

### AK7 — Genau ein `<main>` und eine `<h1>` je Ansicht

- Ablauf (Vitest, `App.test.tsx`): `App` auf Route `/settings/general` bzw. `/hilfe`
  rendern.
- Erwartetes Ergebnis: `document.querySelectorAll('main')` hat Länge 1; genau eine
  `h1` mit einem Text, der die geöffnete Seite benennt (nicht „Dashboard").

### AK8 — Mobile-First (375 px): kein Element ragt über den Viewport

- Ablauf (e2e): Viewport 375×812, `/settings/general` bzw. `/hilfe` öffnen.
- Erwartetes Ergebnis: Header und Seiteninhalt sind sichtbar; für Header und
  Seiteninhalt gilt `x + width <= 375` (Bounding-Box statt `scrollWidth` — die
  App-Shell clippt mit `overflow-x: hidden`, MEMORY 2026-08-24).

### AK9 — Bestandstests bleiben grün

- Kein eigener neuer Test; betrifft die Test-Pflege bestehender Dateien
  (`SettingsPage.test.tsx`, `HelpPage.test.tsx` ohne `onBack`-Prop;
  `ai-disable.spec.ts:224` Rückweg über die Toolbar statt „Zurück"-Klick) — Aufgabe der
  Implementierungsphase, siehe PR-Body „Test-Pflege-Bedarf".

## Abgrenzungen / bewusst nicht getestet

- Exakte `_variant`-Farbwahl des aktiven Toolbar-Zustands (KI-UX-Empfehlung
  `ghost`/`secondary`) — visuelle Gestaltung, kein prüfbares AK.
- Fokus-Management beim Umschalten (KI-UX: `:focus-visible`-Ring darf nicht verdeckt
  werden) — keine automatisierte Prüfung, visuelle Verifikation in der Impl-Phase.

# Spec 972 — LLM-Einstellungen: Layout vereinheitlichen & X-Icon im Key-löschen-Button

Issue: #972 · Status: Spec-Phase (rote Tests) · Format-Referenz: `user-journeys.md`

## Ziel

Der LLM-Tab der Einstellungen ist auf Mobile (≤767px) und Desktop (≥1024px) einheitlich
ausgerichtet (analog dem Tab „Allgemein"), und der Entfernen-Schalter für API-Keys zeigt ein
echtes Icon statt des Unicode-Zeichens „✕" (U+2715), das je nach Systemfont unsichtbar bleibt.

## Vorbedingung

- Nutzer ist eingeloggt und öffnet `/settings/pillars`, Tab „LLM".
- Mindestens ein API-Key-Status ist gesetzt oder ein Key-Feld enthält eine Eingabe — nur dann
  erscheint der X-Button (`LlmSettingsForm.tsx`, Bedingung `status.hasMistralApiKey ||
mistralKeyInput !== ''`).
- Write-only-Semantik der Key-Felder bleibt unangetastet (leer = unverändert, Löschen nur via
  `clearField` → PUT mit Leerstring).

## Schritte

1. **Container-Rhythmus (AK1):** Der Inhalt von `<div slot="tab-2">` erhält eine eigene
   Container-Klasse (analog `.settings-general`, app.css:1380: flex column + einheitlicher
   `gap` aus der 4/8/12/16/24/32/48px-Skala), sodass Provider-Toggle, Hinweistext, Key-Felder,
   Modell-Auswahl und Aktionen vertikal im gleichen Rhythmus stehen — identisch auf Mobile und
   Desktop. (Reines Layout: kein eigener Test erzwungen; per e2e-Overflow-Test indirekt
   abgesichert, visuelle Begründung im PR-Body.)
2. **Volle Feldbreite ohne Overflow (AK2):** `.llm-key-input-group` (app.css:1860) bekommt
   `flex: 1; min-width: 0` für das Eingabefeld, damit Key-Felder und Modell-Select die
   verfügbare Breite ausfüllen, ohne horizontal zu überlaufen. Die #886-Fixes am Modell-Select
   (`width: 100%` + `min-width: 0`) und die #727-Regressionssicherheit an `.form-grid`
   (geteilt von sieben Formularen — keine globalen Änderungen) bleiben wirksam.
3. **X-Icon statt Unicode (AK3):** Der Button mit `aria-label="API-Key löschen"`
   (`LlmSettingsForm.tsx:154/178`) rendert `✕` nicht länger als Textinhalt, sondern ein
   Icon-Element (kolicon-cross via `KolIcon`/`KolButton-_icons` oder Inline-SVG; Muster:
   `DependencyModal.tsx:124`). Das Icon ist rein dekorativ (`aria-hidden`), der accessible
   name bleibt „API-Key löschen" (e2e-Vertrag aus #788).
4. **Touch-Target & Zustände (AK4):** Der X-Button behält sein 44×44px-Touch-Target
   (WCAG 2.5.5); Hover/Focus-/Disabled-Zustände von `.llm-key-x-button` funktionieren
   unverändert. Idealgröße laut KI-UX-Block: 48dp via Padding.

## Erwartetes Ergebnis

- **E1 (AK3, Vitest `frontend/src/components/LlmSettingsForm.test.tsx`):** Bei gesetztem
  Key-Status rendern beide X-Buttons je ein Icon-Element (`kol-icon` oder Inline-SVG) — der
  Textinhalt enthält nicht länger „✕" (U+2715) — und behalten `aria-label="API-Key löschen"`.
- **E2 (AK2, e2e Mobile 375×667):** Kein horizontaler Overflow des LLM-Tabs
  (`scrollWidth ≤ clientWidth` auf `.settings-page`); Key-Eingabegruppe und Modell-Select
  füllen die verfügbare Breite.
- **E3 (AK3/AK4, e2e Desktop 1280×800):** Nach Eingabe in ein Key-Feld ist der X-Button
  sichtbar mit einem Icon messbarer Größe und einem Touch-Target von ≥44×44px; der
  „Speichern"-Button liegt vollständig im Viewport.

## Abgrenzungen

- Keine Änderung an Speicher-/Lösch-Logik der Keys (nur Darstellung).
- Keine Änderungen an `.form-grid` global (dokumentierte #727-Regression).
- Das durch #971 hinzugekommene Switch-Layout in `.settings-general` bleibt unbeeinflusst.

# Spec #2474 — Demo-Hinweis (#2471) als schließbare KolCard statt KolAlert

## Ziel

Der Demo-Hinweis für das Play-Prüfkonto (`DemoHint`, #2471) wird von `KolAlert` auf `KolCard`
umgestellt — Look wie die `missed-section`-Nachbarkarte (`MissedTasksSection.tsx`), ohne
Signal-/Statusfarbe. Verhalten aus #2471 bleibt unverändert: sessionStorage-Marker
`pp_demo_hint_dismissed`, kein localStorage, Reset beim Prüf-Login (LoginPage),
`data-testid="demo-hint"` stabil. Bauteilfrage aus der Triage (KI-UX-Block, ursprünglich eigener
Close-KolButton) ist durch die **Autoren-Entscheidung 2026-10-11** entschieden: **eingebauter
Closer `KolCard._hasCloser`** — das X oben rechts liefert KoliBri (Grid-Area der Card), der
zugängliche Name kommt aus der KoliBri-i18n („Schließen", auch im EN-Modus). Die frühere
App-Sprache-Anforderung an den Closer-Namen ist damit laut Autor abgelöst.

## Voraussetzungen

- Mount `Dashboard.tsx:323` (`<DemoHint enabled={demoHint === true} />`) und der
  sessionStorage-Reset in `LoginPage.tsx` bleiben unberührt.
- i18n-Schlüssel `demoHint.title/text` existieren (de/en), keine neuen Schlüssel nötig — ein
  eigener Closer-Name (`demoHint.close`) wird mit `_hasCloser` nicht mehr gebraucht.

## Ablauf / erwartetes Verhalten

- **AK1** `DemoHint` rendert eine `KolCard` (nicht mehr `KolAlert` — kein Alert-Role/Status-Panel
  mehr), Titel aus `demoHint.title` als Card-`_label`, Hinweistext aus `demoHint.text` im
  Card-Body. Nachbarmuster `MissedTasksSection.tsx` (KI-UX): `_level={2}`, `role="region"` mit
  zugänglichem Namen; keine Signal-/Statusfarbe (kein `_type`-Äquivalent, neutrale Card-Fläche
  via KolCard-Theme).
- **AK2** Schließen über den eingebauten Card-Closer (`_hasCloser`, X oben rechts in der Grid-
  Area der Card) — kein eigener `KolButton`; zugänglicher Name aus der KoliBri-i18n: „Schließen"
  (statisch, auch im EN-Modus — Autoren-Entscheidung 2026-10-11). Touch-Target ≥ 44 px (KoliBri
  `--a11y-min-size`), abgesichert per E2E-Bounding-Box.
- **AK3** Klick auf X setzt `sessionStorage['pp_demo_hint_dismissed']='1'` und blendet die Card
  aus; nach Reload nicht sichtbar; nach erneutem Prüf-Login wieder sichtbar; kein
  localStorage-Eintrag. (Vertrag aus #2471 unverändert.)
- **AK4** Bei 375 px Viewport liegt die Card vollständig im Viewport ohne horizontalen Überlauf
  (Bounding-Box-Assertions, keine scrollWidth-Checks — App-Shell clippt overflow-x).

## Test-Dokumentation

| AK                        | Testebene           | Datei                                                                                                                                                                                                                | Rot/Bestand                                             |
| ------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| AK1                       | Vitest              | `frontend/src/components/DemoHint.test.tsx` — KolCard-Mock (Props-Weiterleitung `...rest` + Prop-Spy), prüft Card-Render statt KolAlert-Selektoren; Nachbarmuster-Props (`_level`, `role="region"`, kein `_type`)    | **neu, rot** (Ist: KolAlert)                            |
| AK2 (Closer)              | Vitest              | ebenda — Guard gegen Rückfall auf den eigenen Close-KolButton (PR #2475): `_hasCloser` gesetzt, Name „Schließen" **auch im EN-Modus** (KoliBri-i18n, kein `Close`), kein eigener Button (`demo-hint-close` abwesend) | **neu** (ersetzt die EN-„Close"-Erwartung der Erstspec) |
| AK2 (44 px) + AK4         | Playwright          | `frontend/e2e/issue-2471-demo-hint.spec.ts` — Test „AK6: bei 375 px vollständig sichtbar, X ≥ 44 px Touch-Target“ (Bounding-Box, kein scrollWidth)                                                                   | **Dedup: bereits abgedeckt**, kein neuer Test           |
| AK3 (+ kein localStorage) | Vitest + Playwright | Unit: Marker-Klick/Remount/localStorage-Tests in `DemoHint.test.tsx`; E2E: AK3/AK4/AK5-Flow in `issue-2471-demo-hint.spec.ts`                                                                                        | **Dedup: bereits abgedeckt**, bleiben grün              |

Visual-Verifikation (PR-Body-Begründung, kein Test): „Look analog missed-section“ ist reines
Styling; die Position des X liefert der eingebaute Closer (Grid-Area der KolCard), eigenes CSS
für den Kopfzeilen-Slot entfällt. Die testbaren Anteile (Card-Typ, Props, Closer-Name,
Bounding-Box) decken die Tests oben.

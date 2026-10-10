# Spec #2474 — Demo-Hinweis (#2471) als schließbare KolCard statt KolAlert

## Ziel

Der Demo-Hinweis für das Play-Prüfkonto (`DemoHint`, #2471) wird von `KolAlert` auf `KolCard`
umgestellt — Look wie die `missed-section`-Nachbarkarte (`MissedTasksSection.tsx`), ohne
Signal-/Statusfarbe. Verhalten aus #2471 bleibt unverändert: sessionStorage-Marker
`pp_demo_hint_dismissed`, kein localStorage, Reset beim Prüf-Login (LoginPage),
`data-testid="demo-hint"`/`"demo-hint-close"` stabil. Bauteilfrage aus der Triage (KI-UX-Block):
**eigener Close-KolButton, nicht `KolCard._hasCloser`** — das eingebaute X folgt der KoliBri-i18n
und verletzt AK2 (App-Sprache); Präzedenz `PushToast.tsx:29`.

## Voraussetzungen

- Mount `Dashboard.tsx:323` (`<DemoHint enabled={demoHint === true} />`) und der
  sessionStorage-Reset in `LoginPage.tsx` bleiben unberührt.
- i18n-Schlüssel `demoHint.title/text/close` existieren (de/en), keine neuen Schlüssel nötig.

## Ablauf / erwartetes Verhalten

- **AK1** `DemoHint` rendert eine `KolCard` (nicht mehr `KolAlert` — kein Alert-Role/Status-Panel
  mehr), Titel aus `demoHint.title` als Card-`_label`, Hinweistext aus `demoHint.text` im
  Card-Body. Nachbarmuster `MissedTasksSection.tsx` (KI-UX): `_level={2}`, `role="region"` mit
  zugänglichem Namen; keine Signal-/Statusfarbe (kein `_type`-Äquivalent, neutrale Card-Fläche
  via KolCard-Theme).
- **AK2** Schließen-Knopf (eigener `KolButton`, `_hideLabel`, Icon `kolicon-cross`) oben rechts,
  zugänglicher Name in App-Sprache: `demoHint.close` — DE „Schließen“ / EN „Close“ (react-i18next,
  nicht KoliBri-i18n). Touch-Target ≥ 44 px (KoliBri `--a11y-min-size`), abgesichert per
  E2E-Bounding-Box.
- **AK3** Klick auf X setzt `sessionStorage['pp_demo_hint_dismissed']='1'` und blendet die Card
  aus; nach Reload nicht sichtbar; nach erneutem Prüf-Login wieder sichtbar; kein
  localStorage-Eintrag. (Vertrag aus #2471 unverändert.)
- **AK4** Bei 375 px Viewport liegt die Card vollständig im Viewport ohne horizontalen Überlauf
  (Bounding-Box-Assertions, keine scrollWidth-Checks — App-Shell clippt overflow-x).

## Test-Dokumentation

| AK                        | Testebene           | Datei                                                                                                                                                                                                             | Rot/Bestand                                                                        |
| ------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| AK1                       | Vitest              | `frontend/src/components/DemoHint.test.tsx` — KolCard-Mock (Props-Weiterleitung `...rest` + Prop-Spy), prüft Card-Render statt KolAlert-Selektoren; Nachbarmuster-Props (`_level`, `role="region"`, kein `_type`) | **neu, rot** (Ist: KolAlert)                                                       |
| AK2 (Name)                | Vitest              | ebenda — Button-Name je App-Sprache: DE „Schließen“ (Bestand, fortgeführt), **EN „Close“ neu** (Sicherung gegen `_hasCloser`-Rückfall: dessen Name käme aus der KoliBri-i18n)                                     | EN-Test **neu**; gegen den IST-Code bereits grün (Verhalten besteht, Spiegel-Test) |
| AK2 (44 px) + AK4         | Playwright          | `frontend/e2e/issue-2471-demo-hint.spec.ts` — Test „AK6: bei 375 px vollständig sichtbar, X ≥ 44 px Touch-Target“ (Bounding-Box, kein scrollWidth)                                                                | **Dedup: bereits abgedeckt**, kein neuer Test                                      |
| AK3 (+ kein localStorage) | Vitest + Playwright | Unit: Marker-Klick/Remount/localStorage-Tests in `DemoHint.test.tsx`; E2E: AK3/AK4/AK5-Flow in `issue-2471-demo-hint.spec.ts`                                                                                     | **Dedup: bereits abgedeckt**, bleiben grün                                         |

Visual-Verifikation (PR-Body-Begründung, kein Test): „Look analog missed-section“ und Button-
Position oben rechts (minimales eigenes CSS, Ausnahme-Regel Design-Sprache §4 — KolCard hat
keinen Kopfzeilen-Slot) sind reines Styling; die testbaren Anteile (Card-Typ, Props, Name,
Bounding-Box) decken die Tests oben.

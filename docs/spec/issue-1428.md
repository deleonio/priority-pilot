# Spec #1428 — Kopfzeilen-Position (Oben/Unten)

## Ziel

Die Nutzerin kann in den Einstellungen (Tab „Allgemein") wählen, ob die Kopfzeile oben oder
unten am Bildschirm steht. Die Wahl gilt global (alle Ansichten), wirkt sofort und übersteht
einen Reload. Muster: Darstellungs-Umschalter (`AppearanceSetting.tsx`, `theme.ts`, #285).

## Vorbedingungen

- Eingeloggt, Allgemein-Tab `/settings/general` geöffnet.
- localStorage-Key `pp-header-position`, Werte `top` | `bottom`, Default `top`, ungültige
  Werte → `top` (Getter/Setter/Hook in neu `frontend/src/lib/headerPosition.ts`, Muster
  `theme.ts`).
- Header bleibt DOM-first (`role="banner"` bleibt erstes Element — KI-UX: Lesereihenfolge
  unverändert); die Verschiebung passiert rein per Layout (`.app` Flex-Column + Klasse im
  Bottom-Modus, z. B. `header-bottom`).

## Schritte und erwartetes Ergebnis

1. **AK1 — Bedienelement:** Allgemein-Tab zeigt eine benannte Radiogruppe „Kopfzeile"
   (`KolInputRadio`, `_orientation="horizontal"`, `_hint` wieAppearanceSetting) mit den
   Optionen „Oben"/„Unten"; ohne gespeicherte Wahl ist „Oben" gewählt.
2. **AK2 — Wirkung:** „Unten" rendert `.app-header` visuell unter dem Inhalts-Container
   (Bounding-Box `header.y > content.y`); „Oben" stellt den heutigen Zustand her. Wirkung
   sofort (reaktiv), nicht erst nach Reload (KI-UX: Rückmeldung < 100 ms).
3. **AK3 — Persistenz:** Wahl wird unter `pp-header-position` gespiegelt (Muster `pp-theme`)
   und nach `page.reload()` weiterhin angewandt.
4. **AK4 — Default unverändert:** Ohne Wahl ändert sich nichts — bestehende Verträge
   (mobile-shell, Home-Schalter, App-Unit) bleiben grün; die Bottom-Klasse fehlt.
5. **AK5 — Mobile-first (375×812):** Im Bottom-Modus bleibt die Kopf-Toolbar im Viewport:
   kein horizontaler Overflow (Bounding-Box-Messung, die App-Shell clippt `overflow-x`),
   Unterkante ≤ Viewport-Höhe — `env(safe-area-inset-bottom)` im Header-Padding enthalten.

## Abgrenzungen

- Kein i18n (Labels fest deutsch wie `AppearanceSetting`), keine neue Farbe; Abstände nur
  Skalen-Tokens + `env(safe-area-inset-*)` (KI-UX).
- Kein eigener Bottom-Nav-Balken; die bestehende `KolToolbar` wird nur verschoben.
- Bekannte, akzeptierte Folge von `order`: visuelle Reihenfolge ≠ Tab-Reihenfolge
  (WCAG 2.4.3) — bewusste Entscheidung (Bottom-Nav-Pattern), siehe PR-Body.

## Testfälle (rot vor Impl)

| TF  | Datei                                             | Deckt                                                                                  |
| --- | ------------------------------------------------- | -------------------------------------------------------------------------------------- |
| TF1 | `frontend/src/lib/headerPosition.test.ts`         | AK1 (Default), AK3 (Roundtrip, ungültig, Storage-Fail)                                 |
| TF3 | `frontend/src/App.test.tsx` (neuer describe)      | AK2 (Klasse `header-bottom`), AK4 (Default ohne Klasse)                                |
| TF4 | `frontend/e2e/issue-1428-header-position.spec.ts` | AK1 (Radiogruppe + Default), AK2 (BoundingBox oben/unten), AK3 (Reload), AK5 (375×812) |

TF2 (Unit-Test der Setting-Komponente) ist bewusst in TF4 aufgegangen — Radiogruppen-Rendering
und localStorage-Schreibtrieb werden dort end-to-end geprüft; ein zusätzlicher Unit-Test mit
KoliBri-jsdom-Mocks hätte keinen eigenen Biss (dedup).

# Spec: Tab-Leisten nebeneinander statt untereinander (auch mobil) — #968

Status: rot (Spec-Phase) · Revidiert [#703](./issue-703.md) (P2-7 „Mobile-First: eine primäre Aktion pro Zeile") für Tab-Leisten.

## Ziel

Beide Tab-Leisten der App — die App-Ansichten („Dashboard / Aufgaben / Serien / Wald", `App.tsx:518`, Host `.app-tabs`) und die Settings-Bereiche („Allgemein / Säulen / LLM", `SettingsPage.tsx:143`, Host `.settings-tabs`) — werden auf Viewports < 768 px horizontal nebeneinander in einer Zeile dargestellt statt vertikal gestapelt. Die Tabs passen auch mobil nebeneinander; bei echtem Platzmangel bricht die Leiste sauber um (`flex-wrap: wrap`, KoliBri-Default), ohne horizontalen Seitenüberlauf. Desktop (≥ 768 px) bleibt unverändert.

## Vorbedingung

- App läuft, Hauptansicht `/` und `/settings/pillars` sind erreichbar (e2e-Fixture mockt `/auth/me`).
- Ursache des Ist-Zustands: `app.css:1367-1372` setzt im Media-Query `@media (max-width: 767px)` auf beiden Hosts `--button-group-flex-direction: column` — KoliBri-Default ohne Override wäre `row` + `flex-wrap: wrap`.

## Schritte

1. Viewport auf 375×812 setzen und `/settings/pillars` öffnen.
2. Viewport auf 375×812 setzen und `/` öffnen.
3. Viewport auf 768×1024 setzen und beide Seiten öffnen (Kontrollschritt: Desktop unverändert).

## Erwartetes Ergebnis

- **E1 (Settings-Tabs mobil):** Auf 375 px stehen „Allgemein", „Säulen" und „LLM" nebeneinander: `boundingBox().y` der Tabs ist identisch, `x` streng aufsteigend — kein gestapeltes Vollbreiten-Layout. Kein horizontaler Seitenüberlauf (`document.body.scrollWidth ≤ window.innerWidth + 1`).
- **E2 (App-Tabs mobil):** Auf 375 px stehen „Dashboard", „Aufgaben", „Serien", „Wald" in derselben Zeile (`y` identisch, `x` aufsteigend); kein horizontaler Seitenüberlauf. Fällt der Platz echtes Mal zu knapp aus, umbricht die Leiste (Wrap), statt zu überlaufen oder zu stapeln.
- **E3 (Desktop unverändert):** Bei ≥ 768 px gelten weiterhin die bestehenden Checks: Tabs nebeneinander ohne Umbruch (tabs-viewport.spec.ts AK2), kein Überlauf bei 375 px (settings-tabs.spec.ts AK5) — beide Specs bleiben grün. Der bisherige #703-Mobile-Check „alternatives Layout" (tabs-viewport.spec.ts AK1) wird durch E1 abgelöst: Nebeneinander ist das Soll, nicht mehr das Alternative.

## Abgrenzungen / Randbedingungen

- `llm-provider-toggle.spec.ts:164` testet vertikales Stapeln der LLM-Provider-**Radio-Optionen** — bleibt von #968 unberührt (nur Tab-Leisten ändern sich).
- Der Erklärkommentar in `app.css` (verweist auf #703) ist mitzupflegen, da #968 diese Entscheidung revidiert.
- Umsetzung (Entfernen des Media-Query-Overrides) ist Phase 4 — dieser Spec enthält nur das erwartete Verhalten.

# Spec #1017 — Aktions-Buttons „Push testen" + „Standort jetzt ermitteln" vereinheitlichen

**Issue:** [#1017](https://github.com/deleonio/priority-pilot/issues/1017) · **Typ:** UI-Layout (Frontend, kein Server-Kontakt)
**Format-Referenz:** `docs/spec/user-journeys.md` · **Betroffen:** `frontend/src/components/SettingsPage.tsx`, `frontend/src/app.css`, `frontend/src/components/SettingsPage.test.tsx`, `frontend/e2e/settings-action-buttons.spec.ts`

## Ziel

Die beiden sekundären Aktions-Buttons im Tab „Allgemein" der Einstellungen — `KolButton _label="Push testen"` (nur bei `pushEnabled`) und `KolButton _label="Standort jetzt ermitteln"` (nur bei `geoEnabled`) — bekommen ein **einheitliches, responsives Breiten-Layout**:

- **Mobile (<768px):** Jeder Button füllt die **Container-Innenbreite** von `.settings-general` (Flex-Default `stretch` statt `align-self: flex-start`) und bleibt in seiner eigenen Zeile (der Container ist bereits `flex-direction: column` mit 16dp-Gap).
- **Desktop (≥768px):** Beide Buttons sind **inhaltsbreit und linksbündig** (`align-self: flex-start`) am linken Container-Innenrand.

**Verbindlich für die Umsetzung (AK1):** Beide `KolButton`-Instanzen tragen **dieselbe, nicht leere Layout-Klasse** — die heutige Einzelregel `.push-test-btn` (nur Push-Button, app.css) wird durch die gemeinsame Regel ersetzt (generalisieren oder umbenennen). Ein reiner CSS-Nachfahren-Selektor ohne Klassen am Button ist **nicht** der vereinbarte Vertrag; die Klasse ist Teil des Spec (sie erlaubt den Klassen-Spiegel-Test und greift nicht versehentlich zukünftige Dritt-Buttons an).

**Abgrenzung (verbindlich, aus Issue-Analyse + UX-Beratung):**

1. **Full-Bleed mobil ist optional** (KI-UX: „Container-Innenbreite reicht") — verbindlich ist die Innenbreite, nicht der Full-Bleed-Trick über `margin-inline: -1.5rem` wie bei `.settings-switch-row`.
2. **#932-AK1 wird zum Desktop-Zweig:** „keine volle Flex-Breite" gilt ab jetzt nur noch ≥768px; mobile Vollbreite ist bewusst gewollt. Der #932-Kommentar in `app.css` ist entsprechend anzupassen.
3. **`_inline` bleibt verboten** (Mobile-UI-Regel 2: 44px-Touch-Target); KoliBri-Default-Paddings und -Höhen bleiben unangetastet — die Breitenschaltung läuft ausschließlich über `align-self` am Host-Element.
4. **Unverändert bleiben:** `sendTestPush`-Wirkung + Ergebnis-Alerts, `_disabled` bei `geoPending`, Remount-Key `geoPending` (SettingsPage.tsx), die Reihenfolge Switch-Zeile → Aktions-Button → `.geo-address`, die #971-Switch-Zeilen und die bestehenden Selektoren `kol-button[_label="Standort jetzt ermitteln"]` (SettingsPage.test.tsx) — nur die Klasse wird ergänzt, das `_label` nicht angetastet.

## Vorbedingung

- Angemeldeter Nutzer, `/settings/general` geöffnet, Tab „Allgemein" aktiv.
- **Push-Button sichtbar:** Fake-ServiceWorker-Init-Script mit aktiver Subscription (Muster `frontend/e2e/push-test-button.spec.ts`) + `push/vapid-public-key` → 200.
- **Geo-Block sichtbar:** `navigator.geolocation` mit `granted`-Permission gemockt (Muster `frontend/e2e/geolocation.spec.ts`) + `localStorage['pp-geolocation-enabled'] = 'true'` (Hook liest die Wahl beim Mount, `useGeolocation.ts` STORAGE_KEY) + `reverse-geocode`-Route gemockt.
- Container `.settings-general`: `padding-inline: 1.5rem` (24dp je Seite) → **Container-Innenbreite = boundingBox().width − 48px**.

## Schritte

1. Viewport **375px** öffnen: Beide Buttons messen (Bounding-Box) und mit der Container-Innenbreite vergleichen; Zeilen-Trennung über y-Positionen prüfen.
2. Viewport **1280×800** öffnen: Beide Buttons messen; Breite < 90 % der Container-Innenbreite und linker Rand ≈ Container-Innenrand (±8px).
3. Viewport **320px** öffnen: Für beide Buttons gilt `x + width ≤ viewportWidth` (kein Clipping; nicht `scrollWidth` — die App-Shell clippt mit `overflow-x: hidden`).
4. Im Komponenten-Test (Vitest) beide `kol-button`-Instanzen rendern (push + geo aktiv) und Klassen-Gleichheit prüfen.

**Messtechnik (verbindlich):** Gemessen wird das **Host-Element** `kol-button` (Repo-Konvention wie `issue-843.spec.ts`) — `align-self` wirkt auf den Host, nicht auf das Shadow-DOM-Innere. Die Container-Innenbreite/der linke Innenrand werden aus dem Computed Style von `.settings-general` gelesen (padding-inline), nicht im Test hartkodiert.

## Erwartetes Ergebnis (Akzeptanzkriterien)

| AK  | Erwartetes Verhalten                                                                                                                                                                                                                                                                                                                                |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AK1 | Beide `KolButton`-Instanzen tragen **dieselbe nicht-leere Layout-Klasse**; die Einzelregel `.push-test-btn` existiert nicht mehr als per-Button-Sonderregel (generalisiert/ersetzt). Komponenten-Spiegel: Klasse des Push-Buttons == Klasse des Geo-Buttons ≠ leer.                                                                                 |
| AK2 | Mobil (<768px, referenz 375px): Beide Buttons je **≥ 90 % der Container-Innenbreite** breit und in **getrennten Zeilen** (Geo-Button-`y` ≥ Push-Button-`y + height`, inkl. Gap).                                                                                                                                                                    |
| AK3 | Desktop (≥768px, referenz 1280px): Beide Buttons **inhaltsbreit** (`width < 90 %` der Container-Innenbreite) und **linksbündig** (`x` ≈ Container-`x + 24px`, Toleranz ±8px).                                                                                                                                                                       |
| AK4 | Touch-Target beider Buttons bleibt **≥ 44px** hoch (KoliBri-Default-Paddings unverändert, kein `_inline`); #932 bleibt auf Desktop erfüllt (decken AK3). **Invarianz-AK:** Der Test ist heute grün und muss grün bleiben (Schutz vor schleichender Touch-Target-Reduktion durch die Layout-Änderung).                                               |
| AK5 | Kein horizontales Clipping bei **320px und 375px**: für beide Buttons gilt `boundingBox().x + width ≤ viewportWidth` (Bounding-Box-Prüfung statt `scrollWidth`, da die App-Shell clippt).                                                                                                                                                           |
| AK6 | Funktionalität unverändert: `sendTestPush` → Ergebnis-Alerts, `_disabled`/Remount bei `geoPending`, Reihenfolge Switch-Zeile → Button → `.geo-address`. **Regressionsschutz durch bestehende Tests** (`SettingsPage.test.tsx` #933-Block, `useGeolocation.test.ts`, `push-test-button.spec.ts`) — kein neuer Test, keine bestehenden Tests brechen. |

## Test-Abdeckung (rote Spec-Tests)

| Test (Datei)                                                                                                | deckt | Begründung                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/e2e/settings-action-buttons.spec.ts` — AK2 „mobile Vollbreite + getrennte Zeilen" (375px)         | AK2   | Auswertung: Bounding-Box-Relationen, die nicht wörtlich im CSS stehen.                                                                   |
| `frontend/e2e/settings-action-buttons.spec.ts` — AK3 „desktop inhaltsbreit linksbündig" (1280px)            | AK3   | Auswertung: Geometrie gegen Container-Innenmaß; deckt zugleich #932-Desktop-Zweig (AK4).                                                 |
| `frontend/e2e/settings-action-buttons.spec.ts` — AK4 „Touch-Target ≥ 44px" (375px, beide Buttons)           | AK4   | Schutz vor stillen Touch-Target-Regressionen durch die Layout-Änderung.                                                                  |
| `frontend/e2e/settings-action-buttons.spec.ts` — AK5 „kein Clipping bei 320px"                              | AK5   | Schutz: 375px-Breite (AK2) könnte bei 320px clippen — der schmale Viewport ist der eigentliche Biss.                                     |
| `frontend/src/components/SettingsPage.test.tsx` — #1017-Block „beide Buttons tragen dieselbe Layout-Klasse" | AK1   | Spiegel: Sollwert (Push-Button-Klasse) aus der führenden Quelle gelesen und auf den Geo-Button gespiegelt; kein Klassen-Literal im Test. |

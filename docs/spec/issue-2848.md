# Spec #2848 — Push-Ziel mit Anker: Sprung zur Karte, In-App-„Öffnen", gelöschte Aufgabe

Quellen: `docs/push-konzept.md` §2.1 (11 Anker) / §2.2 (Sprungverhalten), KI-UX-Block im
Harness-Kommentar. Umsetzung laut Analyse in `Dashboard.tsx` (Anker auf Karten-Host/Wrapper),
`PushToast.tsx` (`url` im Payload + Aktion „Öffnen"), `App.tsx` (Deep-Link-Effekt) und i18n.

## Ziel

Ein Push mit Ziel-URL landet in der App auf der richtigen Stelle: Dashboard-Anker sprun-gen zur
Karte (sichtbar + Fokus), der In-App-Hinweis bietet „Öffnen", und ein Link auf eine gelöschte
Aufgabe meldet sich statt still zu schweigen.

## Voraussetzungen

- Authentifizierter Nutzer (e2e: Session-Fixture), mind. eine offene Aufgabe (Damit Dashboard-Tabs
  gerendert werden, Muster `dashboard-cards.spec.ts`), Säulen vorhanden (Default-Seed).

## Verhalten

### AK1 — Anker-Sprung mit Fokus

Öffnet der Browser `/app/#karte-<name>`, springt das Dashboard (Standard-Tab) nach dem ersten
Rendern der Zielkarte dorthin: der Kartenanfang liegt im sichtbaren Bereich (375-px-Viewport,
oben inklusive — `scroll-margin-top` gegen den Sticky-Header), und der Fokus liegt auf dem
Anker-Ziel der Karte (Screenreader liest die Karte, Vorbild `dashboard-next-task-empty` mit
`tabIndex={-1}`). Sprung erst, wenn die Karte gerendert ist — kurz nachhalten, nicht sofort
aufgeben; `prefers-reduced-motion` schaltet die Animation ab (Impl-Detail, nicht testisolierbar).

### AK2 — Anker danach entfernt

Nach dem Sprung enthält die Adresse keinen `#karte-…`-Anker mehr (`history.replaceState` — kein
History-Eintrag, Matomo `trackPageView` am pathname unberührt). Ein Neuladen springt nicht erneut
und verschiebt den Fokus nicht auf die Karte.

### AK3 — Fehlende Karte bleibt oben

Ein Anker auf eine nicht gerenderte Karte (datumabhängige Rückblicke, Fürsorge ohne Hinweis,
Meilensteine ohne Daten) lässt das Dashboard oben stehen: kein Sprung, kein Alert, keine Meldung,
kein Leerelement mit der Anker-ID.

### AK4 — In-App-Hinweis mit „Öffnen"

Enthält die Push-Payload eine `url` (Web: `client.postMessage` aus `push-sw.js:51`; nativ:
FCM-Datenpayload), zeigt `PushToast` zusätzlich zur „Schließen"-Aktion die Aktion „Öffnen"
(nativer Button im Slot, DOM-Vertrag `push-toast-open`, 44-px-Tap-Fläche wie `push-toast-close`).
Klick navigiert zum Ziel (Vertrag: `window.location.assign(url)` — Push-Ziele sind seltene
Nutzeraktionen, der frische App-Zustand entspricht dem Web-Neueinstieg) und schließt den Hinweis.
Web und nativer Kanal verhalten sich gleich. Ohne `url` erscheint „Öffnen" nicht.

### AK5 — Gelöschte Aufgabe meldet sich

`/app/tasks/<unbekannte id>` zeigt auf dem Dashboard den dauerhaft sichtbaren Hinweis „Diese
Aufgabe gibt es nicht mehr." (KolAlert-Card, Text im Slot — kein Toast-Only, keine
Entschuldigung, keine erzwungene Aktion) statt still aufzumachen. Der Gefunden-Fall
(`geo-push-deeplink.spec.ts`) bleibt unverändert.

### AK6 — Alle 11 Anker sitzen

Jede der 11 Karten aus §2.1 trägt ihre Anker-ID (`karte-balance`, `karte-willkommen`,
`karte-fuersorge`, `karte-freie-zeit`, `karte-top-aufgaben`, `karte-streak`, `karte-wochenrueckblick`,
`karte-monatsrueckblick`, `karte-jahresrueckblick`, `karte-meilensteine`, `karte-deadlines`) am
Karten-Host bzw. Light-DOM-Wrapper — bei bedingt gerenderten Karten nur im Sichtbarkeitsfall.
Jede ID höchstens einmal im DOM. Im Seed-Zustand verpflichtend vorhanden: `karte-balance`
(Säulen) und `karte-top-aufgaben` (immer gemountet).

## i18n

Neue Schlüssel („Öffnen", „Diese Aufgabe gibt es nicht mehr.") in allen Sprachen — Parität prüft
der bestehende `locales.test.ts` (kein eigener neuer Test, keine Duplikation).

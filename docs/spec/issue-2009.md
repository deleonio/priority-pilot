# Spec: Zifferblatt-Auswahl auf allen Geräten einheitlich (#2009)

## Ziel

Die Bildwahl der Startseite („Zifferblatt", einer der neun Schlüssel aus `BALANCE_VARIANTS`)
wird **am Konto** gespeichert statt nur im Gerät (`localStorage` `pp-balance-variant`). Auf
jedem Gerät, auf dem der Account angemeldet ist, zeigt die Startseite nach dem Laden dasselbe
Bild; die Wahl überlebt Ab-/Anmeldung — der Server ist Quelle, nicht Sitzung oder Gerät.
Das Theme bleibt bewusst gerätelokal (Autoren-Entscheidung im Issue). `herz` bleibt Default
(bestehenden Nutzern die Startseite nicht umbauen). localStorage-Zugriffe bleiben Best-Effort:
Ein gesperrter Storage oder ein unerreichbarer Server darf App-Start und Rendering nie brechen.

## Voraussetzungen

- `frontend/src/lib/balanceVariant.ts`: `BALANCE_VARIANTS` (neun Schlüssel: `herz`, `blasen`,
  `scheiben`, `ringe`, `strahlen`, `bluete`, `kristall`, `segmente`, `zeiger`), Hook
  `useBalanceVariant`, `readBalanceVariant`/`storeBalanceVariant` (Best-Effort, Key
  `pp-balance-variant`).
- `server/src/express/routes/careConfig.ts` als Route-Muster: GET/PUT einer Pro-User-Einstellung
  über `resolveGeoUser` (Dev-/E2E-Pass-Through #207, funktioniert auch ohne Login), Validierung
  → `400` ohne Persistenz, Defaults im Code.
- `server/src/models/user.ts`: neue Spalte `balanceVariant` (string, nullable) wie
  `carePushEnabled`/`sprache` — derselbe Sync-Weg wie #1098, keine eigene Migrationstruktur.
- Radiogruppe in `BalanceVariantSetting.tsx` (Einstellungen → Allgemein) bleibt unangetastet —
  nur die Persistenz unter dem `_on.onChange` wandert.

## Vertrag API (AK1–AK3) — `GET/PUT /balance-variant` (Muster `careConfig.ts`)

- DTO beidseitig `{ variant: BalanceVariant-Schlüssel }`.
- `PUT /balance-variant` speichert die Wahl **nur am eigenen Konto**; Schlüssel muss genau
  einem der neun `BALANCE_VARIANTS`-Werte entsprechen — jeder andere Wert (unbekannt, leer,
  falscher Typ, fehlend) → `400`, **nichts persistiert** (AK1).
- `GET /balance-variant` liefert die gespeicherte Wahl; für Konten ohne gespeicherte Wahl
  `{ variant: 'herz' }` (AK2).
- Ohne Session → `401` (GET und PUT).
- Kontoisolation: Die Wahl von Nutzer A ist für Nutzer B nicht sichtbar — B erhält seinen
  Default bzw. seine eigene Wahl (AK3).

## Vertrag Frontend (AK4/AK5) — `useBalanceVariant`

- Beim Mount zieht der Hook die serverseitige Wahl nach (`GET /balance-variant`) und
  **überschreibt** den localStorage-Spiegel damit — ein früherer Gerätewert verliert gegen das
  Konto (AK4).
- `setVariant` schreibt weiterhin sofort den lokalen State + Spiegel (Erst-Paint-Muster,
  `push.ts`) und sendet die Wahl per `PUT /balance-variant` ans Konto. Der PUT ist
  **Best-Effort**: Fehler (Netzwerk, 4xx/5xx) werden geschluckt — nichts wirft, die lokale Wahl
  bleibt aktiv (AK4-Randbedingung „gesperrter Storage/App-Start nie brechen", auf den Server
  übertragen).
- `readBalanceVariant`/`storeBalanceVariant` bleiben unverändert Best-Effort.

## UI (AK6)

- Radiogruppe „Bild der Lebensbalance" (Allgemein-Tab) bleibt unangetastet; Auswahl und
  Übernahme der serverseitigen Wahl funktionieren bei 375 px (mobile-first Leitfall).

## AK → Testfälle

| AK          | TF  | Test                                                                                                                                                                                                                                                                               |
| ----------- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AK1         | TF1 | `server/src/express/balance-variant.test.ts` — je Varianten-Schlüssel (alle neun) PUT → 200, GET liefert ihn; Unfug (`'seifenblasen-3000'`, `''`, Typzahl, fehlend) → 400, GET unverändert                                                                                         |
| AK2         | TF2 | dieselbe Datei — GET ohne gespeicherte Wahl → `{ variant: 'herz' }`; nach PUT die gespeicherte Wahl                                                                                                                                                                                |
| AK3         | TF3 | dieselbe Datei — A wählt, B liest Default bzw. eigene Wahl, nie die von A                                                                                                                                                                                                          |
| AK4         | TF4 | `frontend/src/lib/balanceVariant.test.ts` — Server-Wert überschreibt Spiegel/State beim Laden (GET gemockt)                                                                                                                                                                        |
| AK4         | TF5 | dieselbe Datei — setVariant sendet PUT mit der Wahl; unerreichbarer Server wirft nicht, lokale Wahl + Spiegel bleiben                                                                                                                                                              |
| AK4/AK5/AK6 | TF6 | `frontend/e2e/issue-2009-balance-variant.spec.ts` — Kontext A wählt bei 375 px in den Einstellungen, Kontext B (frischer Storage, echte Anmeldung, 375 px) zeigt auf der Startseite dasselbe Bild, ohne dort zu wählen; nach Ab-/Anmeldung (POST /auth/logout + Login) unverändert |
| —           | TF7 | E2E-Registrierung über `POST /auth/register` (säht die fünf Standard-Säulen, Muster `zifferblatt-shots.spec.ts`); Observability über `.heart-balance-stage[data-variante]`                                                                                                         |

Router-Registrierung in `server/src/express/index.ts` bleibt unverdrahtungs-getestet (ADR 0001).
OpenAPI/Client-Typen (`server/src/api.d.ts`, `client/src/schema.d.ts`) regeneriert die
Impl-Phase mit.

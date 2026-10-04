# Spec #1989 — KPI-Kennzahlen: Aktivierung, Tag-7, Share, Einladungen (Server)

Zweck: Admin sieht Aktivierung (Tag 0), Tag-7-Rückkehr, Wochenkarten-Share-Rate und Einladungen je Zeitraum als Raten. Nur Server (Admin-API, Präzedenz #1798); einziger Frontend-Touch ist der Share-Ping der Wochenkarte. Muster durchgehend: `logics/careWirkung.ts`.

## Ereignis-Protokoll (anonym)

- Tabelle `kpi_events` (Modell `models/kpiEvent.ts`, Default-Export `KpiEvent`): `tag` (UTC-Kalendertag, `YYYY-MM-DD`), `art` ∈ `aktivierung` | `aktivitaet` | `wochenkarte` | `einladung`, `dedupKey` (unique). **Genau diese Felder (+ `id`), keine `userId`-Spalte, keine Aufgabeninhalte.**
- Dedup über HMAC-SHA256 aus `SESSION_SECRET` (Fallback `'kpi'`), `bulkCreate`/`create` mit `ignoreDuplicates`:
  - `aktivierung`: `userId|aktivierung` — einmal je Nutzer.
  - `aktivitaet`: `userId|aktivitaet|tag` — je Nutzer und Tag einmal.
  - `wochenkarte`: `userId|wochenkarte|<Montag 00:00 UTC der Woche>` (`wochenStart`-Muster) — je Nutzer und Woche einmal.
  - `einladung`: `einladenderUserId|einladung|eingeladenerUserId|tag` — je Paar und Tag einmal; eine Einladung an ein anderes Konto zählt separat.
- Protokollierung läuft synchron beim Ereignis (kein Scheduler); Fehler werden nur geloggt, der Nutzer-Request scheitert nicht daran.

## Protokollierpunkte

- **Erledigung** (`protokolliereErledigung` in `logics/kpiKennzahlen.ts`): Tag 0 (UTC-Kalendertaggleichheit mit `User.createdAt`) → `aktivierung`, jeder spätere Tag → `aktivitaet`. Hook im echten Done-Übergang von `PATCH /tasks/:id` (gleiche Bedingung wie `awardScoreOnDone`, Nutzer = Task-Eigentümer nachClaim); Reopen löscht den `ScoreEntry`, ein erneutes Done am selben Tag zählt dank Dedup nicht doppelt.
- **Wochenkarten-Share**: neuer Endpunkt `POST /kpis/wochenkarte` (Session-Pflicht, 401 anonym) → `wochenkarte`, Antwort 204. Frontend: `WeeklyBalanceCard` ruft ihn fire-and-forget **nach** erfolgreichem `navigator.share` auf; Download-Fallback und Abbruch (`AbortError`) rufen ihn nicht.
- **Einladung**: `POST /groups/:id/invitations` protokolliert je angelegter `GroupInvitation` ein `einladung` — vor der Antwort abgewartet (Nebenwirkung beobachtbar), nach dem `create`.

## Auswertung `GET /admin/kpis?zeitraum=woche|monat` (nur Admin)

- 401 ohne Session, 403 für Member, 400 bei fehlendem/falschem `zeitraum`.
- Antwort: `{ zeitraum, zeilen: [{ periode, neueNutzer, aktivierung, tag7, wochenkarte, einladungen }] }`. Perioden sind die Kalenderwochen (Montag, `YYYY-MM-DD`) bzw. Monate (`YYYY-MM`) der Registrierungen, aufsteigend; ohne Registrierungen eine leere Liste.
- Zelle `{ zaehler, nenner, quote }`:
  - `aktivierung` = Nutzer mit Erledigung am Tag 0 / neue Nutzer der Periode.
  - `tag7` = Nutzer mit Erledigung am Tag 7 / Nutzer der Periode, deren Tag 7 (UTC) vergangen ist.
  - `wochenkarte`, `einladungen` = Ereignisse mit `tag` in der Periode / neue Nutzer der Periode.
- Zelle mit `nenner` < 5 → String `"unterdrueckt"` (`MIN_ZELLE`-Muster).
- Tag-7-Auswertung liest `ScoreEntry.zeitpunkt` + `Task.userId` + `User.createdAt` (careWirkung-Bindungsmuster), nicht die anonyme Tabelle; nach außen nur Summen und Quoten.
- Reine Auswertung `berechneKpis(eingabe, zeitraum, jetzt)` mit injizierbarer Eingabe und Uhr; Loader `ladeKpis` liest die Rohdaten.

## Datenschutz

- Modell und Antworten führen nur Zählgrößen: keine Nutzer-IDs, E-Mails, Namen, Aufgabeninhalte. `openapi.yml` + `pnpm --filter server build:api` mitführen (Impl-Phase).

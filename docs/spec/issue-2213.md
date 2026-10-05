# Spec #2213 — Journal-Statistik: Eintragsanzahl und Balance-Verlauf je Säule über Zeitraum

Teil 2 von 2 aus #1933 (PO-Entscheidung 2026-10-05, Option A): Die Statistik zählt
Journal-Einträge je Säule und gesamt über einen wählbaren Zeitraum (Tag/Woche) und zeigt
daneben den vorhandenen Balance-Verlauf (#1424) als zweite Reihe. Kein Bewertungsfeld, kein
Paket-Limit (ADR 0018).

## API — `GET /journal/stats`

Route in `server/src/express/routes/journal.ts` (neben dem CRUD aus #2212), Aggregationslogik in
`server/src/logics/journalStats.ts` (reine Funktion, Muster `balanceHistory.ts`).

Query-Parameter:

| Parameter       | Bedeutung                                                                       |
| --------------- | ------------------------------------------------------------------------------- |
| `von`, `bis`    | Pflicht, `YYYY-MM-DD`, existierendes Kalenderdatum (Muster `istGueltigesDatum`) |
| `granularitaet` | `tag` (Default) oder `woche`                                                    |
| `tz`            | optionale IANA-Zeitzone, Fallback Serverzone (Muster `/scores/balance/history`) |

Fehler: keine Session → 401; fehlende Parameter, ungültiges Datum, `bis` < `von`, Zeitraum
über 366 Tage (Grenze wie `MAX_BALANCE_HISTORY_TAGE`), unbekannte Granularität → 400.

Antwort 200:

| Feld                    | Inhalt                                                                                                                                        |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `fenster[]`             | je Kalendertag (`tag`) bzw. Kalenderwoche mit Montag-Beginn (`woche`), auf `[von, bis]` geschnitten, aufsteigend; Fenster ohne Einträge mit 0 |
| `fenster[].von`/`.bis`  | Fenstergrenzen als `YYYY-MM-DD` (bei `tag` identisch)                                                                                         |
| `fenster[].proSaeule[]` | je Säule des Nutzers — **alle**, auch mit 0 — als `{ pillarId, anzahl }`, aufsteigend nach `pillarId`                                         |
| `fenster[].ohneSaeule`  | Anzahl Einträge ohne Säule im Fenster                                                                                                         |
| `fenster[].gesamt`      | Summe aller Einträge im Fenster                                                                                                               |
| `balanceVerlauf[]`      | exakt die Antwort von `GET /scores/balance/history?von&bis&tz` für denselben Zeitraum (AK3, Parität)                                          |

Isolation: nur Einträge des angemeldeten Nutzers zählen (`getUserId`, Muster Journal-CRUD); der
Balance-Teil wird wie `/scores/balance/history` über `ownerScope` geladen. Bestehende
Journal-CRUD-Routen und -Tests bleiben unverändert.

## UI (KI-UX-Block #2213)

1. Tab „Journal" → unter der Eintragsliste öffnet der `KolDetails`-Block „Statistik" (Standard
   zu, damit „Neuer Eintrag" Primäraktion des Tabs bleibt).
2. Zeitraum „Von"/„Bis" (2× `KolInputDate`, vorbelegt mit den letzten 28 Tagen) plus
   Granularität „Täglich"/„Wöchentlich" (`KolInputRadio`). Jede Änderung lädt neu — kein
   separater Button.
3. Gestaltete Zustände: Laden → `KolSpin`, Fehler → `KolAlert` mit Wiederhol-Hinweis, kein
   Eintrag im Zeitraum → Leerzustand-Text als Einladung.
4. Je Fenster mit Einträgen ein Block (aufsteigend; Fenster ohne Einträge werden nicht als
   leere Blöcke wiederholt — der API-Vertrag liefert sie trotzdem mit 0): Label (Datum bzw.
   „Woche vom <Datum>"), `Gesamt: n`, `Ohne Säule: n`, je Säule mit Einträgen
   `<Name>: n Eintrag/Einträge · <punkte> Punkte`, Balance-Zeile `Füllstand: <p> %` — Punkte und
   Füllstand aus `balanceVerlauf` zum Fensterende (Tag = `fenster.bis`). Säulennamen als Text
   neben dem Wert (Relief-Regel der Säulen-Rampe), Zahlen mit `tabular-nums`.
5. 375 px: kein horizontaler Überlauf (Bounding-Box-Assertion, App-Shell clippt), Bedienelemente
   ≥ 44 px hoch.

Keine Diagramm-Bibliothek, keine Tabelle — Zahlen als Textliste (KI-UX #2213).

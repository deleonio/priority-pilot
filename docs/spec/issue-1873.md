# Spec #1873 — KI-Vorschlag im Fürsorge-Hinweis

Erweitert `docs/spec/issue-1804.md` (KI-Vorschlag in `GET /scores/care-suggestions`) und `issue-1793.md` (`CareHint`).

## Server (`GET /scores/care-suggestions`, Plus/Pro)

- AK1: Ohne Überlast steht der `typ: 'ki'`-Eintrag an Position 0 der Liste.
- AK2: Bei Überlast (Erholungsvorschläge vorhanden) wird der Berater nicht aufgerufen, es wird nichts gebucht.
- AK3: Parallele Abrufe am selben Tag teilen einen Beraterlauf: Berater 1×, eine Buchung.
- AK4: Der Berater erhält die Titel der 20 zuletzt angelegten Aufgaben (Sortierung nach `createdAt`).

## Frontend (`CareHint`)

- AK5: `typ: 'ki'` trägt eine sichtbare Kennzeichnung (`data-testid="care-hint-ki"`), andere Typen nicht.
- AK6: „Vorschlag ablehnen" bei KI: kein `dismissCareSuggestion`, lokale Unterdrückung bis Tagesende.
- AK7: „Vorschlag übernehmen" bei KI: `createTask` mit Titel, Beschreibung, Säulenbeitrag.
- AK8: Bei 375 px kein horizontaler Überlauf (Bounding-Box).

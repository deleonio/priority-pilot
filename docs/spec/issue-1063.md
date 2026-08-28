# Spec #1063 — Geo-Badge (Globus) für Aufgaben und Serien mit Ortsbezug

**Stand:** 2026-08-28

## Ziel

Einträge mit Ortsbezug (`address` und/oder Koordinaten) sind auf den ersten Blick erkennbar: In
der Serienliste (`SeriesTab`), im TaskTree (offene Aufgaben) und in der Erledigt-Liste
(`CompletedTasksTable`) zeigt ein Globus-Badge (Font Awesome `fa-solid fa-globe`, kein Emoji),
dass die Serie bzw. der Task einen Ortsbezug trägt. Der Datenbestand dafür wird geschaffen, indem
das Serien-Modell — analog zum Task-Modell — um ein optionales `address`-Feld erweitert und an
generierte Instanzen vererbt wird (bindende Produktentscheidung „Option B", Issue-Body
2026-08-27).

## Preconditions

- Tasks haben `address` (String ≤ 255 oder `null`; `server/src/models/task.ts`,
  Roundtrip-Tests in `server/src/express/tasks-address.test.ts`).

## Verhalten (Akzeptanzkriterien)

### AK1 — `address` an der Serien-API

`POST /series` und `PATCH /series/:id` akzeptieren `address` (String ≤ 255 Zeichen oder `null`);
`GET /series` und `GET /series/:id` geben es zurück. Ohne Angabe gilt `address === null`.
Validierung analog Tasks: Zahl → 400, mehr als 255 Zeichen → 400, `null` löscht einen
bestehenden Ortsbezug, leerer String wird wie `null` behandelt.

### AK2 — Snapshot-Vererbung an generierte Instanzen

`generateDueInstances` schreibt `address: series.address ?? null` als Snapshot auf jede neu
generierte Instanz (Semantik wie `description`, #295). Nachträgliche Template-Änderungen wirken
nur auf künftige Instanzen — bestehende behalten ihren Snapshot.

### AK3 — Kaskade `applyToInstances=true`

`PATCH /series/:id` mit `applyToInstances=true` übernimmt ein geändertes `address` auf alle
offenen (nicht erledigten) Instanzen mit `seriesId = :id`; erledigte Instanzen bleiben
unverändert (wie #555). Ohne `applyToInstances` bleiben alle Instanzen unangetastet.

### AK4 — Globus-Badge in der Serienliste

Jede Serie mit Ortsbezug (`address` und/oder Koordinaten) zeigt in ihrer Zeile
(`series-tree-item-<id>`) ein Globus-Badge; Serien ohne Ortsbezug zeigen keins. Das Badge ist rein
informativ (nicht klickbar), icon-only und transportiert seine Bedeutung für assistive
Technologien über `aria-label` (enthält „Standort“, BITV — siehe KI-UX-Block im Issue).
Verankerung für Tests: `data-testid="geo-badge"`.

### AK5 — Globus-Badge in der Erledigt-Liste und im TaskTree

Jeder Task mit Ortsbezug zeigt in seiner Zeile der Erledigt-Tabelle sowie im TaskTree (offene
Aufgaben) das Globus-Badge (`data-testid="geo-badge"`); Tasks ohne Ortsbezug zeigen keins.

### AK6 — Mobile (375px) ohne Layout-Bruch

Bei 375px Viewport verursacht das Badge in allen drei Listen (Serienliste, TaskTree, Erledigt-
Liste) keinen horizontalen Überlauf: Zeile bzw. Tabellen-Host bleiben vollständig in der
Viewport-Breite (Bounding-Box-Messung — die App-Shell clippt mit `overflow-x: hidden`,
`scrollWidth` wäre strukturell grün; Messtechnik wie `docs/spec/issue-1020.md`).

## Abgrenzung / Nicht-Ziele

- `TaskTable.tsx` ist ungenutzt (tot) und wird nicht angefasst.
- Die Adress-UI im Serien-Modus des TaskForm (`useAddressSearch`-Integration) hat keinen eigenen
  Test — das Adressfeld selbst ist durch #1061-Tests abgedeckt, die Serien-Anbindung ist ein
  Analog-Schritt ohne eigenen testbaren Vertrag darunter.

## Tests (rot, aus dieser Spec abgeleitet)

| Testdatei                                               | AK       | prüft                                                                                                                |
| ------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------- |
| `server/src/express/series-address.test.ts` (neu)       | AK1      | POST/PATCH-Roundtrip mit `address`, Default `null`, 255-Limit → 400, Zahl → 400, `null` löscht, GET liefert das Feld |
| `server/src/logics/series.test.ts` (erweitert)          | AK2      | Serie mit `address` → Instanz erbt sie; ohne → `null`; Template-Änderung wirkt nur auf künftige Instanzen            |
| `server/src/express/series.cascade.test.ts` (erweitert) | AK3      | `applyToInstances=true` übernimmt `address` auf offene Instanzen, erledigte bleiben unverändert                      |
| `frontend/e2e/issue-1063-geo-badge.spec.ts` (neu)       | AK4, AK5 | Badge in Serienzeile / TaskTree-Zeile / Erledigt-Zeile nur bei Ortsbezug; `aria-label` „Standort"                    |
| `frontend/e2e/issue-1063-geo-badge.spec.ts` (neu)       | AK6      | 375px: Zeile (Serienliste/TaskTree) und Tabellen-Host (Erledigt) bleiben in der Viewport-Breite trotz Badge          |

Die Task-`address`-API selbst ist durch `tasks-address.test.ts` gedeckt — kein Duplikat.

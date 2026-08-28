# Spec #1066 — Dashboard-Card „In der Nähe“: max. 10 Tasks nach Geo-Distanz

Ziel: Wege-Erledigungen sichtbar machen. Ein Standort wird ausschließlich als Koordinate
(`latitude`/`longitude`) gespeichert (bindende Entscheidung, Ticket-Autor 27.08.) und im UI immer
aus den Koordinaten per Reverse-Geocoding aufgelöst. Das Dashboard erhält eine Card „In der
Nähe“ mit den bis zu 10 nächsten offenen Tasks.

## Datenmodell & Persistenz

- Tasks und Serien erhalten die nullable Spalten `latitude` (REAL) und `longitude` (REAL) neben
  `address`; Migrations-Nachzug analog `address` (`server/src/logics/migrate.ts`). Bestand bleibt
  `NULL` (kein Bulk-Geocoding — kein Scope).
- **AK1** Task-Anlage/Änderung mit Koordinaten: POST/PATCH `/tasks` akzeptieren `latitude`/
  `longitude` als Zahl (lat ∈ [-90, 90], lon ∈ [-180, 180], sonst 400), speichern beide Werte und
  liefern sie in GET/POST/PATCH-Responses zurück. `address` bleibt dabei unangetastet — es gibt
  **keinen** Adress-String als Geo-Datensatz.
- **AK1** Leeren des Standorts (`latitude: null` und/oder `longitude: null`) setzt **beide** Werte
  auf `NULL`.
- **AK10** Freitext-Adresse ohne gewählten Vorschlag: `address` gesetzt, keine Koordinate → Task
  lässt sich speichern (kein Validierungsfehler), trägt `latitude === null` und erscheint nicht in
  der Card.
- **AK6** `generateDueInstances` schreibt die Template-Koordinaten als Snapshot auf jede generierte
  Instanz (Semantik wie der `address`-Snapshot, #1063); eine spätere Template-Änderung ändert
  bestehende Instanzen nicht.

## Endpoint `GET /api/v1/tasks/nearby`

- **AK7** auth-geschützt (ohne Session → 401) und owner-scoped: liefert ausschließlich Tasks des
  eigenen Users (Muster `api-auth-protection.test.ts`, #207/#244).
- Parameter: `lat` und `lon` (Zahlen, Query-Parameter) — die aktuelle Position des Nutzers.
- **AK2** liefert maximal 10 Tasks mit Koordinaten und offenem Status (`Open`/`In process`),
  **aufsteigend** sortiert nach Distanz zur übergebenen Position (Haversine). Tasks ohne
  Koordinaten und erledigte Tasks erscheinen nie.
- **AK3** jeder Eintrag trägt `distanceKm` in Kilometern, gerundet auf eine Nachkommastelle.

## Dashboard-Card „In der Nähe“

Platzierung (KI-UX): unterhalb von „Was ist jetzt dran?“, oberhalb von „Wichtigste Tasks“.
`KolCard _label="In der Nähe" _level={0}` nach dem Muster der Nachbar-Cards; Liste statt Tabelle,
eine Spalte; jede Zeile ist ein fokussierbares Link-artiges Element mit vollständigem sichtbaren
Namen (`#12 – Post abgeben, 2,4 km`) und mindestens 44px Höhe. Keine Primäraktion, keine
Signalfarbe — „Nächste Aufgabe“ bleibt die einzige.

Test-Anker (Vertrag für Impl und Tests): `data-testid="nearby-card"` (Card),
`nearby-item` (Eintrag), `nearby-empty` (Leerzustand), `nearby-denied` (AK4),
`nearby-preference-off` (AK8).

- **AK2/AK3** Einträge zeigen `#id`, Titel und Distanz in km mit einer Nachkommastelle direkt am
  Eintrag (tabellarische Ziffern, rechtsbündig). **Die Card zeigt bewusst KEINE Adresse**
  (KI-UX-Entscheidung zu offener Frage 1: Datensparsamkeit; die aufgelöste Adresse gehört ins
  Task-Detail).
- **AK9** keine Tasks mit Koordinaten → klare Leer-Aussage (`nearby-empty`, Einladung zum
  Handeln); weniger als 10 → entsprechend weniger Einträge. Kein Fehlerzustand. Zwei Fälle,
  ein Wortlaut-Anker: es gibt keine offenen Tasks mit Koordinaten (unterschieden wird nicht —
  der zustandsunabhängige Wortlaut lädt zum Setzen eines Standorts ein).
- **AK4** Browser verweigert die Freigabe oder Position nicht verfügbar → Text-Hinweis
  `nearby-denied`, der sagt, dass die Freigabe **im Browser** erteilt werden muss; kein
  `KolAlert` in Danger-Optik, Rest-Dashboard voll nutzbar („Nächste Aufgabe“ bleibt sichtbar).
- **AK8** Geolocation-Präferenz aus (Default) → keine Positionsabholung (`getCurrentPosition`
  wird nicht aufgerufen), dezenter Hinweis `nearby-preference-off` mit Verweis auf die
  Einstellung.
- **AK5** bei 375px kein Layoutbruch (Bounding-Box-Prüfung `el.x + el.width ≤ Viewport` — die
  Shell clippt mit `overflow-x: hidden`, `scrollWidth` ist kein Indikator). Die Position wird
  erst geholt, wenn die Präferenz an ist **und** die Card gerendert ist — kein Prompt beim
  reinen Dashboard-Aufruf, kein 5-Minuten-Intervall auf dem Dashboard.
- **AK11** Adressen im UI stammen aus Reverse-Geocoding der Koordinaten. Für `GeoBadge`
  (`aria-label`) gilt: niemals Rohkoordinaten — bei erfolgreicher Auflösung der Kurzort, sonst
  neutrales „Standort gesetzt“/„Adresse nicht verfügbar“; kein Fehlerzustand.

## Vorbedingungen

- Geolocation-Präferenz (`pp-geolocation-enabled`) und `useGeolocation` existieren (#845);
  `/api/v1/reverse-geocode` existiert (#866); `address`-Spalten und -Snapshot existieren (#1063).

## Testabbildung

| AK                            | Test                                                                    |
| ----------------------------- | ----------------------------------------------------------------------- |
| AK1, AK10                     | `server/src/express/tasks-coordinates.test.ts`                          |
| AK2, AK3, AK7                 | `server/src/express/tasks-nearby.test.ts`                               |
| AK6                           | `server/src/logics/series.test.ts` (Snapshot-Block)                     |
| AK1 (Frontend)                | `frontend/src/lib/useAddressSearch.test.ts` (Vorschläge tragen lat/lon) |
| AK2, AK4, AK5, AK8, AK9, AK11 | `frontend/e2e/issue-1066-nearby-card.spec.ts`                           |

## Offene Fragen (an Impl/Review)

- Wortlaut der Leer-/Hinweistexte (Anker sind die `data-testid`s, nicht die Texte) — final in der
  Implementierung, im Zweifel mit UX abstimmen.

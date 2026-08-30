# Dashboard-Card „In der Nähe": max. 10 Tasks nach Geo-Distanz

**Stand:** 2026-08-30

Wege-Erledigungen sichtbar machen: Ein Standort wird ausschließlich als Koordinate (`latitude`/`longitude`) gespeichert und im UI immer aus den Koordinaten per Reverse-Geocoding aufgelöst. Das Dashboard zeigt eine Card „In der Nähe" mit den bis zu 10 nächsten offenen Tasks.

## Datenmodell & Persistenz

- Tasks und Serien haben die nullable Spalten `latitude` (FLOAT) und `longitude` (FLOAT) neben `address`; Bestand ohne Koordinaten bleibt `NULL` (kein Bulk-Geocoding).
- POST/PATCH `/tasks` akzeptieren `latitude`/`longitude` als Zahl (lat ∈ [-90, 90], lon ∈ [-180, 180], sonst 400), speichern beide Werte und liefern sie in GET/POST/PATCH-Responses zurück. `address` bleibt dabei unangetastet — es gibt **keinen** Adress-String als Geo-Datensatz.
- `latitude`/`longitude` sind ein Paar: Ein POST/PATCH, das nur eines der beiden Felder sendet (als `null` oder als Zahl), normalisiert **beide** Werte auf `NULL` — nur ein Request mit gültigen Werten für beide Felder speichert eine Koordinate.
- Freitext-Adresse ohne gewählten Vorschlag: `address` gesetzt, keine Koordinate → Task lässt sich speichern (kein Validierungsfehler), trägt `latitude === null` und erscheint nicht in der Card.
- `generateDueInstances` schreibt die Template-Koordinaten als Snapshot auf jede generierte Instanz (Semantik wie der `address`-Snapshot); eine spätere Template-Änderung ändert bestehende Instanzen nicht.

## Endpoint `GET /api/v1/tasks/nearby`

- auth-geschützt (ohne Session → 401) und owner-scoped: liefert ausschließlich Tasks des eigenen Users.
- Parameter: `lat` und `lon` (Zahlen, Query-Parameter) — die aktuelle Position des Nutzers.
- Liefert maximal 10 Tasks mit Koordinaten und offenem Status (`Open`/`In process`), **aufsteigend** sortiert nach Distanz zur übergebenen Position (Haversine). Tasks ohne Koordinaten und erledigte Tasks erscheinen nie.
- Jeder Eintrag trägt `distanceKm` in Kilometern, gerundet auf eine Nachkommastelle.
- Die Liste enthält nur Tasks innerhalb der gespeicherten Anzeige-Entfernung des Users (Server-Filter, Default 5 km, siehe Geo-Einstellungen).

## Dashboard-Card „In der Nähe"

Platzierung: unterhalb von „Was ist jetzt dran?", oberhalb von „Wichtigste Tasks". Liste statt Tabelle, eine Spalte; jede Zeile ist ein fokussierbares Link-artiges Element mit vollständigem sichtbaren Namen (`#12 – Post abgeben, 2,4 km`) und mindestens 44px Höhe. Keine Primäraktion, keine Signalfarbe — „Nächste Aufgabe" bleibt die einzige.

- Einträge zeigen `#id`, Titel und Distanz in km mit einer Nachkommastelle direkt am Eintrag, in Klammern und deutsch formatiert („(2,4 km)"). **Die Card zeigt bewusst KEINE Adresse** (Datensparsamkeit; die aufgelöste Adresse gehört ins Task-Detail).
- Der Card-Titel nennt die gespeicherte Anzeige-Entfernung: `In der Nähe (5 km)`; der Wert kommt aus `GET /geo-config` und ändert sich mit, wenn er in den Einstellungen verstellt wird.
- Keine offenen Tasks mit Koordinaten → klare Leer-Aussage mit Einladung zum Handeln (der Wortlaut ist zustandsunabhängig und lädt zum Setzen eines Standorts ein); weniger als 10 Treffer → entsprechend weniger Einträge. Kein Fehlerzustand.
- Browser verweigert die Freigabe → Text-Hinweis, der sagt, dass die Freigabe **im Browser** erteilt werden muss; kein `KolAlert` in Danger-Optik, Rest-Dashboard voll nutzbar („Nächste Aufgabe" bleibt sichtbar).
- Geolocation-Präferenz aus → die Card wird **gar nicht** gerendert; es findet keine Positionsabholung statt (kein Prompt beim reinen Dashboard-Aufruf, kein 5-Minuten-Intervall auf dem Dashboard).
- Bei 375px kein Layoutbruch; die Position wird erst geholt, wenn die Präferenz an ist **und** die Card gerendert ist.
- Adressen im UI stammen aus Reverse-Geocoding der Koordinaten. Für `GeoBadge` (`aria-label`, Format `Standort: <Adresse>`) gilt: niemals Rohkoordinaten — bei erfolgreicher Auflösung der Kurzort, sonst neutrales „Adresse nicht verfügbar"; kein Fehlerzustand.

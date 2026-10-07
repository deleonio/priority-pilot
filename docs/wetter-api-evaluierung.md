# Wetter-API: Open-Meteo vs. DWD (Evaluierung, #1931)

Bewertung zweier öffentlicher Wetterquellen als Basis einer geplanten Wetterfunktion, plus
Integrationskonzept. Reine Doku, kein Produktivcode. Teil von
[#2016](https://github.com/deleonio/priority-pilot/issues/2016).

Stand der Angaben: 07.10.2026 aus den Primärquellen unten. Vor der Umsetzung Limits und
Bedingungen erneut prüfen, sie ändern sich.

## Vergleich

| Kriterium                       | Open-Meteo                                                                                                                             | DWD Open Data                                                                                                                             |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Kosten                          | Kostenlos nur für nicht-kommerzielle Nutzung; kommerzielle Nutzung braucht einen kostenpflichtigen Plan ([Preise][om-pricing])         | Kostenlos, auch kommerziell ([GeoNutzV][dwd-nutz])                                                                                        |
| API-Schlüssel                   | Frei: nein. Bezahlplan: ja                                                                                                             | Nein                                                                                                                                      |
| Abdeckung                       | Weltweit, Punktabfrage per Koordinate (JSON)                                                                                           | Schwerpunkt Deutschland/Europa (MOSMIX-Stationsvorhersagen, ICON-Gitter); Punktabfrage nur über Stationen oder Gitter-Aufbereitung        |
| Vorhersagequalität und Takt     | Mischt mehrere Wettermodelle (u. a. DWD ICON), stündliche Werte bis 16 Tage, Modelle je nach Region mehrmals täglich ([Docs][om-docs]) | Primärquelle der ICON-Modelle, MOSMIX stündlich bis 10 Tage, Aktualisierung mehrmals täglich ([Open Data][dwd-od])                        |
| Nutzungsbedingungen, Ratenlimit | Frei: unter 10.000 Aufrufe/Tag, 5.000/Stunde, 600/Minute; Daten CC BY 4.0, Namensnennung nötig ([Terms][om-terms])                     | GeoNutzV: Quellenvermerk nötig, keine Ratenlimits für Dateien, Abruf über statische Dateien, Last selbst begrenzen ([GeoNutzV][dwd-nutz]) |
| Datenschutz                     | Koordinaten gehen an einen Dritten; auf ca. 0,1° runden                                                                                | Server lädt Dateien herunter, nutzerbezogene Koordinaten verlassen den Server nicht                                                       |
| Aufwand für die App             | Gering: ein HTTP-Aufruf je Ort                                                                                                         | Höher: Dateien (MOSMIX-KMZ, Gitter) herunterladen, parsen, cachen, Ort auf Station/Gitterzelle abbilden                                   |

[om-pricing]: https://open-meteo.com/en/pricing
[om-terms]: https://open-meteo.com/en/terms
[om-docs]: https://open-meteo.com/en/docs
[dwd-od]: https://opendata.dwd.de/weather/
[dwd-nutz]: https://www.dwd.de/DE/leistungen/opendata/nutzungsbedingungen.html

## Empfehlung: DWD Open Data

Balamentum ist ein Bezahlprodukt (Plus/Pro, [ADR 0018](./adr/0018-preismodell-free-plus-pro.md)).
Der kostenlose Open-Meteo-Zugang ist nur für nicht-kommerzielle Nutzung freigegeben, ein
produktiver Einsatz bräuchte einen Bezahlplan samt Schlüssel und laufenden Kosten. DWD Open Data
ist ohne Schlüssel und ohne Kosten kommerziell nutzbar, die Datenqualität kommt direkt von der
Primärquelle, und es fließen keine Nutzerkoordinaten an Dritte. Der Mehraufwand (Parsen,
Cachen) fällt einmal an und lässt sich hinter einer Funktion `logics/weather.ts` kapseln.
Grenze: Abdeckung außerhalb Europas ist schwach; das ist für die heute deutschsprachige
Hauptzielgruppe vertretbar. Wird Weltabdeckung zum Ziel, ist Open-Meteo mit Bezahlplan der
Ausweg, die Kapselung macht den Wechsel lokal.

## Integrationskonzept

Beide Punkte laufen serverseitig. Der Server holt Wetterdaten selten und cacht sie je Gitterzelle
bzw. Station (Abruftakt: stündlich, nicht je Nutzeranfrage).

| Integrationspunkt                                                                                                    | Nutzen                                                                                                                                                           | Datenumfang                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `server/src/logics/geo-background-job.ts` (Orts-Push „Aufgaben in der Nähe“)                                         | Push bei Dauerregen/Sturm unterdrücken oder anpassen; Position liegt serverseitig vor (`User.lastGeoLatitude/lastGeoLongitude`, `server/src/models/user.ts`)     | Temperatur, Niederschlag (mm/h), Windböen; Zeithorizont 0–3 h; Abruf je Lauf aus dem Cache, Quelle stündlich erneuert  |
| `server/src/logics/careSuggestionData.ts` (Draußen-Vorschläge, z. B. `koerper-1` „Spaziergang an der frischen Luft“) | Draußen-Vorschläge bei Regen/Frost/Hitze ausblenden oder durch Drinnen-Alternativen ersetzen; ausdrückliche Wetterbezüge gibt es dort heute nicht, sie wären neu | Tagesvorhersage: Temperatur min/max, Niederschlagswahrscheinlichkeit, Wettercode; Zeithorizont heute; Abruf je Tag/Ort |

Nicht-Ziele dieses Dokuments: Umsetzung, Datenmodell, UI. Folgetickets entstehen unter #2016.

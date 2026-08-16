# Issue 742: Free Models Selection

## Ziel

Benutzer können im Frontend aus einer aktuellen Liste der kostenlosen Modelle von OpenRouter auswählen.

## Vorbedingung

- Frontend ist geladen
- OpenRouter API ist erreichbar

## Schritte

1. Benutzer öffnet Model-Selection-Dialog
2. Frontend lädt aktuelle Free-Models-Liste von OpenRouter API
3. Liste wird im UI angezeigt (nicht hartcodiert)
4. Default-Modell `openrouter/free` ist vorselektiert
5. Benutzer kann ein anderes Free Model auswählen

## Erwartetes Ergebnis

- Free-Models-Liste ist aktuell (dynamisch geladen)
- `openrouter/free` ist Default
- Auswahl funktioniert für alle verfügbaren Free Models
- Liste ist nicht veraltet/statisch

## Testbare Aspekte

1. Free Models werden von API geladen (nicht hartcodiert)
2. Default ist `openrouter/free`
3. Andere Free Models können ausgewählt werden
4. Liste ist aktuell

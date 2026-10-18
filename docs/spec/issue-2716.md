# Spec: #2716 — Suche: KI darf Kategorie-Filter nicht selbst setzen

## Ziel

Der Kategorie-Filter der globalen Suche wird ausschließlich durch die Kategorie-Auswahl im
Such-Modal bestimmt. Die KI-Zerlegung (`POST /tasks/parse-search`) trägt nur noch den Suchbegriff
bei — eine vom Modell erkannte `categoryId` überschreibt die Auswahl der Maske nie (auch nicht
die Nicht-Auswahl `null`), damit die Suche nicht „ständig auf Hobby" filtert.

## Vorbedingungen

- KI-Features freigeschaltet (Gate `ai_assist` erlaubt), Kategorien vorhanden.
- Die Sprachsuche (Transkript → `fromVoice`) löst die Zerlegung aus; getippte Suchen bleiben
  ohne Zerlegung.

## Schritte

1. Nutzer diktier(t) eine Anfrage („offene Sachen zum Hausbau") und startet die Suche,
   **ohne** eine Kategorie in der Maske zu wählen.
2. Wie Schritt 1, aber der Nutzer wählt vorher eine Kategorie in der Maske.
3. Die Zerlegung liefert nur eine `categoryId` und keinen `text`.
4. Nutzer tippt den Suchbegriff (kein Transkript) und startet die Suche.

## Erwartetes Ergebnis

| #   | AK  | Erwartet                                                                                                 |
| --- | --- | -------------------------------------------------------------------------------------------------------- |
| 1   | AK1 | `onSearch(parsedText, null)` — Modell-`categoryId` wird verworfen, nicht nach Kategorie gefiltert        |
| 2   | AK2 | `onSearch(parsedText, <Auswahl der Maske>)` — Modell-`categoryId` überschreibt die Auswahl nie           |
| 3   | AK3 | `onSearch(<gesprochener Text>, <Auswahl der Maske>)` — nie leerer Suchbegriff, Kategorie aus der Maske   |
| 4   | AK4 | Getippte Suche ruft `parseSearch` nicht auf und verhält sich unverändert (`onSearch(query, categoryId)`) |

Nicht-Zerlegungspfade (Modell erkennt nichts, Exception, KI aus) suchen bereits mit dem
Feld-Zustand und bleiben unverändert — ihr Verhalten wird zum Normalfall.

## Abgedeckte Tests

- `frontend/src/components/SearchModal.test.tsx` — Vitest Unit (Mock-Double für `api.parseSearch`,
  `VoiceField`, KoliBri-Hosts): je ein Test je AK1–AK3, bestehender Test für AK4 bleibt.

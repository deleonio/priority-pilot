# Spec — Issue #2542: Provider-Test bucht KI-Kontingent und ist gedrosselt

Quelle: KI-ANALYSE-Block im Harness-Kommentar von #2542 (AK1-AK5). Baut auf #1459/#1783
(`meterAiQuota`, Fair Use) und #1548 (eigener Provider kostet nichts) auf.

## Ziel

`POST /llm-providers/:id/test` löst einen bezahlten Upstream-Aufruf aus. Ein Test über einen
instanzweiten Schlüssel zählt wie jede andere KI-Route auf das Monatskontingent des Nutzers; die
Route ist zusätzlich pro Nutzer gedrosselt.

## Buchung (AK1-AK4)

- Entscheidend ist die **getestete Zeile**, nicht die Provider-Auswahl des Nutzers: eigener Provider
  (`userId` = Nutzer) mit eigenem Key bucht nichts und wird nie durch das Kontingent blockiert;
  instanzweite Zeile (`userId` null) bucht genau 1, auch wenn der Nutzer sonst einen eigenen Provider wählt.
- Gebucht wird nur bei echtem Upstream-Aufruf. Keine Buchung bei 400 (ungültige ID), 404, `ok:false`
  ohne API-Key bzw. ohne Modell und bei Cache-Treffer (`testResultsCache`). `ok:false` nach Upstream-Aufruf zählt.
- Kontingent erschöpft (Fair-Use-Drossel): Status, Body und `Retry-After` wie `POST /lektorat` im
  selben Zustand (`429`, `code: 'ai_throttled'`); der Upstream wird nicht aufgerufen.

## Rate-Limit (AK5)

Eigener Limiter nur für diese Route, Schlüssel `ip:userId`, kleine Grenze (Vorschlag 5 Tests / 60 s).
Überschreitung: `429`, Body `THROTTLED_MESSAGE` (`{ message }`), Header `Retry-After`. Ein anderer Nutzer
im selben Fenster bleibt unberührt. Wie die übrigen Limiter nur in Produktion aktiv.

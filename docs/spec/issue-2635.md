# Spec #2635 — Nachfrage bei überfälligen Aufgaben verständlich formulieren

## Ziel

Der MissedCompleteDialog stellt die Entscheidung als Frage mit zwei vollständigen Antworten dar
(keine Ja/Nein-Doppelverneinung) und nennt die Punkte-/Streak-Folge der Wahl. Die Antwort-Semantik
bleibt unverändert: `onAnswer(true)` = Erledigung zählt zum Fälligkeitstag (volle Punkte),
`onAnswer(false)` = jetzt erledigt (verspätet, halbe Punkte); der Fälligkeitstag zählt in beiden
Fällen für den Streak (#1820, `server/src/logics/streak.ts:82-89`). Nur de und en (`frontend/src/i18n/locales/`).

## Vertrag (`tasks:missedComplete` in `frontend/src/i18n/locales/{de,en}/tasks.json`)

- `question` beginnt mit „Wann“ (de) bzw. „When“ (en), endet mit „?“ und nennt damit die
  Entscheidung; `<title/>`-Platzhalter bleibt.
- `onTime` / `now` sind vollständige Antworten ohne Ja/Nein-Partikel (kein „Ja,…“/„Nein,…“/„Yes,…“/„No,…“);
  `onTime` beginnt mit „pünktlich“ (de) bzw. „on time“ (en), `now` mit „erst jetzt“ (de) bzw. „just now“ (en).
- `consequence` (neu): Folge-Halbsatz zwischen Frage und Buttons, sichtbarer Absatz; nennt Punkte,
  „halb“/„half“ für „jetzt“ und Streak (Fälligkeitstag zählt trotzdem — kein Streak-Verlust behaupten).
- Referenzformulierungen (Impl darf within-Vertrag feinjustieren; Abweichung = Test-Pflege mit Begründung):
  de „Wann wurde die Aufgabe <title/> erledigt?“ / „Pünktlich erledigt“ / „Erst jetzt erledigt“,
  en „When was <title/> completed?“ / „On time“ / „Just now“.

## Tests (rot bis zur Umsetzung)

- `frontend/src/i18n/locales.test.ts` — je Sprache: Frage-Antwort-Einheit (s. Vertrag) +
  `consequence` existiert, nicht leer, nennt Punkt(e), halb/half und Streak.
- `frontend/e2e/issue-1964-missed-area.spec.ts` — die beiden Erledigt-Tests nutzen die neuen
  Frage-/Button-Texte; Halbsatz im Dialog sichtbar (auf `kol-dialog` gescoped); neuer
  375-px-Test: Dialog inkl. Halbsatz ohne horizontalen Überlauf (Bounding-Box des nativen
  `<dialog>`, die App-Shell clippt `overflow-x: hidden`).
- `frontend/e2e/issue-2526-complete-inline.spec.ts` — Locator `Nein, pünktlich` → `Pünktlich erledigt`.

# Balance-Bild urteilt erst ab der Mindestmenge

**Stand:** 2026-10-15
**Ziel:** Das Balance-Bild auf dem Dashboard urteilt (Stufe, konkreter Schieflage-Hinweis) erst, sobald
die Überlast-Mindestmenge an Erledigungen erreicht ist. Vorher (`erledigungenImFenster < mindestErledigungen`,
z. B. nach einer einzelnen Erledigung) zeigt es den Leerzustand statt „Aus der Balance … 80 %“ direkt
neben „Gut gemacht“. Auf leerem Konto (0 Erledigungen) steht der Einstiegssatz genau einmal.

## Vorbedingungen

- `GET /scores/balance` liefert seit #2633 additiv `erledigungenImFenster` und `mindestErledigungen`
  (`server/src/express/routes/scores.ts:281-282`, Mindestmenge = `UEBERLAST_MINDEST_ERLEDIGUNGEN` = 3) —
  der Server bleibt nicht geändert; das Frontend vergleicht nur die beiden Felder (kein zweites Literal).
- Schwellen und Stufen (`HEALTH_STEPS` 0.85/0.65/0.4/0) bleiben ab Urteilsreife unverändert.

## Verhalten

1. **Urteilsreife als Vertrag zwischen Dashboard und Bild (#2645/AK1)**
   - `Dashboard` leitet aus der Balance-Antwort die Urteilsreife ab (Zähler ≥ Mindestmenge) und reicht
     sie als **optionale Prop** `urteilsreif?: boolean` an `HeartBalance` durch; `undefined` (Felder
     fehlen, z. B. Server-Fehler) = bisheriges Verhalten. Die Einstellungs-Vorschau
     `BalanceVariantSetting.tsx` rechnet lokal ohne Serverdaten und bleibt nicht berührt.
   - `heartHealth` nimmt einen optionalen zweiten Parameter `urteilsreif` (Default `true`) und liefert
     bei `!hasPoints || urteilsreif === false` den Leerzustand: `state: 'leer'`, Leer-Label
     („Noch leer“), Leer-Hinweis („Erledige Aufgaben, damit sich das Bild füllt.“) — kein Stufenlabel,
     kein konkreter Schieflage-Hinweis („kommt am kürzesten“/„zieht davon“ erscheint nicht).
2. **Schwellen ab Urteilsreife unverändert (#2645/AK2)**
   - Mit `urteilsreif: true` (oder ohne Angabe) gilt die bisherige `HEALTH_STEPS`-Reihe unverändert;
     die Bestands-Stufentests (`heartBalance.test.ts`, `stateAt` 0.95/0.7/0.5/0.2) bleiben grün.
3. **Einstiegssatz genau einmal (#2645/AK3)**
   - Zeigt der Fürsorge-Hinweis den Einstiegssatz (`anlass: 'einstieg'`, CareHint-Zweig ohne
     Aktionsreihe — Mechanik bleibt), unterdrückt das Dashboard die inhaltsgleiche Begründungszeile
     der nächsten Aufgabe (`reasons.einstieg`). Ohne diesen Hinweis bleibt die Begründungszeile stehen
     (Bestandsvertrag #2527, TF3).
4. **Mobile-First (#2645/AK4)**
   - Bei 375 px bleiben Einstiegssatz-Karte (`.care-hint`) und „Nächste Aufgabe“ (`.dashboard-next-task`)
     in der Seitenbreite (Bounding-Box-Messung — `scrollWidth` ist durch `overflow-x: hidden` der
     App-Shell strukturell beschnitten, Memory 2026-08-24).

## Erwartetes Ergebnis

- Nach einer einzelnen Erledigung: Leerzustand statt Prozent-Urteil, ohne dass „Gut gemacht“ oder die
  übrigen Karten sich ändern.
- Ab der Mindestmenge: Stufen und Hinweise exakt wie bisher.
- Leeres Konto: der Einstiegssatz steht genau einmal im gerenderten Dashboard (CareHint), die
  doppelte Begründungszeile entfällt.

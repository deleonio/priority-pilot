# Spec #1997 — Balamentum Wrapped (Jahresrückblick)

## Ziel

Im Januar zeigt das Dashboard einen Jahresrückblick auf das Vorjahr: erledigte Aufgaben, investierte Stunden, längster Streak, stärkste Säule, abgeschlossene Projekte — als PNG teilbar, ohne Aufgabeninhalte. Struktur und Bedienung folgen dem Monatsrückblick (#1995). Kein Push (PO-Entscheidung 4).

## Vertrag AK1–AK4 — `GET /scores/yearly-recap` (neu in `server/src/express/routes/scores.ts`)

- Query: `jahr=JJJJ` (Pflicht, vierstellig, sonst **400** mit `message`), `tz=` IANA-Zeitzone (optional, Fallback Serverzone). Ohne Session **401**. Alles strikt über `ownerScope` (Datenisolation).
- Jahresfenster = Kalenderjahr in `tz`; Erledigt-Zeitpunkt = `ScoreEntry.zeitpunkt`.
- Antwort 200 `YearlyRecapDto`:
  - `jahr`: angefragtes Jahr (Zahl);
  - `erledigteAufgaben`: Anzahl `Done`-Tasks mit Zeitpunkt im Jahr;
  - `stunden`: Summe `actualEffort ?? estimatedEffort` dieser Tasks (PO 2a);
  - `laengsterStreak`: `berechneStreak(...).best` nur über Zeitpunkte im Jahr (AK3);
  - `staerksteSaeule`: `{ id, name, punkte }` mit größter Punkte-Differenz aus `berechneBalanceVerlauf` (31.12. Vorjahr → 31.12. Jahr, eine Dezimalstelle); `null` ohne Punkte;
  - `abgeschlosseneProjekte`: Anzahl im Jahr erledigter Tasks mit mindestens einer Unteraufgabe (`getDependencies()`, PO 1a) (AK4).

## Vertrag AK6 — `frontend/src/lib/yearlyShareCard.ts` (neu, Muster `monthlyShareCard.ts`)

- `erzeugeJahresKarteSvg({ jahr, label, erledigteAufgaben, stunden, laengsterStreak, staerksteSaeule, abgeschlosseneProjekte })` → SVG-String mit allen Kennzahlen als Text und dem Label; keine Aufgabentitel/-inhalte; Säulenname XML-escapen; `staerksteSaeule: null` → keine Säulenzeile.
- `jahresDateiname(jahr: number): string` → `balamentum-jahr-<JJJJ>.png`.

## Vertrag AK5/AK7 — `frontend/src/components/YearlyRecapCard.tsx` (neu), Mount in `Dashboard.tsx` über `<MonthlyBalanceCard />`

- Rendert nur im Januar (lokaler Monat), mit `api.getYearlyRecap({ jahr: <Vorjahr>, tz })` (neue api-Methode); sonst nichts rendern und nichts laden.
- Test-IDs: `yearly-recap-card`, `yearly-share` (Web Share mit PNG), `yearly-download` (Fallback, Datei `balamentum-jahr-<JJJJ>.png`). Kennzahlen zusätzlich als Text im Card-DOM.
- 375 px: Karte im Viewport, Teilen/Speichern ≥ 44 px hoch (UX: gestapelt, volle Breite).

## Offen (nicht testbar festgelegt)

- Säulenname im Teilbild per Schalter ausblendbar und Leerjahr-Darstellung (UX-Empfehlungen, keine AK) — nicht Teil des Vertrags.

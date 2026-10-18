# Spec #2695 — Gemeinsamer Share-Card-Hook `useShareCard`

**Stand:** 2026-10-17

## Journey: Bilanz-Karten erzeugen, herunterladen, speichern, teilen (Refactoring)

### Ziel

Die gemeinsame Klickpfad-Logik der drei Bilanz-Karten (`WeeklyBalanceCard`, `MonthlyBalanceCard`,
`YearlyRecapCard`) — Erzeugen mit Fehlerzustand, Herunterladen über Object-URL, Speichern, Teilen
per `navigator.canShare` samt Download-Fallback — liegt genau einmal im Hook
`frontend/src/lib/useShareCard.ts`. Von außen verhalten sich alle drei Karten unverändert
(DOM, Test-IDs, i18n-Keys, Abläufe — AK1/AK2).

### Vorbedingung

- Karte gerendert, Daten geladen; der Klickpfad läuft erst auf Nutzeraktion (Rasterisierung im
  Klickpfad — bloßes Ansehen rasterisiert nichts).
- `navigator.share`/`navigator.canShare` sind Plattform-Fähigkeiten, die fehlen können.

### Vertrag des Hooks

Jede Karte liefert dem Hook ihre Karten-Erzeugung sowie die Share-Texte; der Hook kapselt den Rest:

- **Injektion je Karte:** `erzeugeSvg(): { svg: string; dateiname: string }` (SVG- und
  Dateiname-Funktionen bleiben je Karte in `lib/weeklyShareCard.ts`, `lib/monthlyShareCard.ts`,
  `lib/yearlyShareCard.ts`), `titel`/`text` für `navigator.share`, optional `onGeteilt`
  (nur Wochenkarte: Share-Ping `api.postWochenkarteShare()`, #1989, fire-and-forget).
- **Rückgabe:** `{ rastert, fehler, speichern, teilen }`.
- **Karte erzeugen (intern):** `rastert = true` während der Rasterisierung (`rasterisiere` aus
  `lib/karteRasterisieren.ts`), danach `false`; wirft die Karten-Erzeugung, ist `fehler = true`
  und weder Download noch Share starten.
- **`speichern()`:** bei Erfolg genau ein Download — Object-URL auf den Blob, Anker mit
  `download = dateiname` und Blob-`href`, Klick, `revokeObjectURL`.
- **`teilen()`:** Karte erzeugen; Fehler → nur Fehlerzustand. Erfolgreich: Datei
  (`image/png`, Name = `dateiname`); `canShare({ files })` wahr → genau ein
  `navigator.share({ files, title, text })`, danach `onGeteilt` genau einmal. `AbortError` ist
  kein Fehlerzustand (kein Fallback, kein `onGeteilt`, kein Fehler-Alert). Ohne `canShare` oder
  bei nicht-abort Share-Fehler → Download-Fallback (kein Fehlerzustand, kein `onGeteilt`).

### Erwartetes Ergebnis

- AK1: Keine der drei Karten enthält eigenen Code mit `URL.createObjectURL`, `navigator.share`
  oder `navigator.canShare`; die Logik existiert genau einmal im Hook.
- AK2: Verhalten unverändert — der bestehende Unit-Test-Satz der drei Karten und die E2E-Specs
  (`issue-1968-weekly-card`, `monthly-balance-card`, `yearly-recap-card`,
  `dashboard-layout-shift`) bleiben ohne Abschwächung grün; Weekly-Share-Ping nur nach echtem
  System-Share (#1989).
- AK3: Der Hook ist eigenständig getestet (siehe Testabbildung).

### Testabbildung

- TF1 (AK1+AK3, Unit): `frontend/src/lib/useShareCard.test.tsx` — Hook mit injizierter
  Karten-Funktion; Download, Share, Fallbacks, Fehlerzustand, Spinner-Zustand.
- TF2 (AK2, Unit): bestehende `WeeklyBalanceCard.test.tsx`, `MonthlyBalanceCard.test.tsx`,
  `YearlyRecapCard.test.tsx` bleiben unverändert grün (kein neuer Test — Gate/CI).
- TF3 (AK2, E2E): bestehende E2E-Specs bleiben unverändert grün (kein neuer Test — Gate/CI).

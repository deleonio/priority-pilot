# Issue 1985 — „Warum jetzt?“ an der empfohlenen Aufgabe

## Ziel

Die Karte „Nächste Aufgabe“ auf dem Dashboard beantwortet die Frage „Warum jetzt dran?“ in
normaler Sprache: bis zu vier kurze Begründungssätze unter dem Titel, absteigend nach Anteilshöhe,
plus ein Fallback-Satz, wenn keine Begründungsanteile vorliegen.

## Voraussetzungen

- Bewertungslogik `bewerteKandidaten`/`toScoreBreakdown` in `server/src/logics/find.ts` liefert je
  Task die Beiträge der fünf Faktoren (#2043/#2044); `GET /next` (Top-1) ist verdrahtet.
- Karte in `frontend/src/components/Dashboard.tsx` (`.dashboard-next-task-*`-Klassen, Przedenz
  #1168/#1447/#1465/#1793).
- KI-UX-Block (Issue-Kommentar): Sätze rein informativ, ohne Technik-Werte (keine Anteile/Prozente/
  Scores); Liste `ul`/`li`; Basis-Fontsize (nicht `--pp-font-size-sm`); `overflow-wrap: anywhere`;
  keine Signal-Farbe, kein Icon, kein `KolDetails`, keine `aria-live`-Region.

## Vertrag (Server, additiv)

`GET /next` liefert neben dem unveränderten `scoreBreakdown` ein optionales Feld `reasons` —
strukturierte Begründungswerte je Faktor **mit Beitrag > 0** (Spiegel der #2044-Konvention
„Beitrag 0 ⇒ Schlüssel fehlt“; kein Anteil ⇒ `reasons` fehlt komplett):

```yaml
TaskReasons:
  balance:  { pillars: string[] }              # Namen der Defizit-Säulen (Soll > Ist) des Tasks
  unlock:   { openCount: integer }             # Anzahl offener Nachfolger
  deadline: { date: string(date), daysUntil: integer }  # Frist; auf ganze Tage gerundete Differenz zum heutigen Kalendertag
  priority: { priority: integer }              # Prioritätswert des Tasks
```

- `reasons` additiv an `TaskRecommendation` in `openapi.yml`; bestehende Felder, Endpunkte und der
  numerische `scoreBreakdown`-Vertrag (#2044) bleiben unverändert.
- `GET /suggestions` und `next_task` (#2044) werden nicht angefasst.

## UI-Vertrag (Karte „Nächste Aufgabe“)

- Liste `<ul class="dashboard-next-task-reasons">` mit je einem `<li>` je Begründungssatz, im DOM
  unterhalb der Prioritätszeile (`.dashboard-next-task-priority`) und vor der Aktionszeile
  (UX-Lesefluss: Titel → Priorität → Gründe → Aktionen).
- Reihenfolge der `<li>`: absteigend nach `scoreBreakdown`-Beitrag des jeweiligen Faktors
  (stärkster Grund zuerst = DOM-Reihenfolge, A11y).
- Satzbaukarten (hartkodiert deutsch, i18n-Variante darf die Impl wählen — dann gleiches Muster):
  - balance (1 Säule): `Säule <Name> kam diese Woche zu kurz.` — mehrere:
    `Säulen <A> und <B> kamen diese Woche zu kurz.`
  - unlock: `Schaltet <N> offene Aufgaben frei.` (N = 1: `… 1 offene Aufgabe frei.`)
  - deadline (daysUntil ≥ 1): `Fällig am <D.M.YYYY> (in <N> Tagen).` — daysUntil = 0: `Fällig heute.`
    — daysUntil < 0: `Überfällig seit <N> Tagen.`
  - priority: `Priorität <P>.`
- Fallback (AK4 — kein `reasons` bzw. leer, `scoreBreakdown` fehlt oder nur `total`): **genau ein**
  `<li>` in derselben Liste: `Priorität <P>, fällig am <D.M.YYYY>.` — ohne Frist: `Priorität <P>.`
- Maximal vier Sätze; kein Aufklappen, kein Klick-Target, kein Farb-/Gewichts-Akzent.

## Tests (rote Spec-Tests)

| TF  | AK  | Datei                                        | Inhalt                                                                                                                                                                                                                                                  |
| --- | --- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TF1 | AK1 | `server/src/express/suggestions.test.ts`     | Task mit 2 offenen Nachfolgern, Defizit-Säule, Frist, Prio 3 → `reasons.balance/unlock/deadline/priority` korrekt; Task ohne Anteile → kein `reasons`, `scoreBreakdown`-Vertrag unverändert (Rest durch #2044-Tests gedeckt — bewusst nicht dupliziert) |
| TF2 | AK2 | `frontend/src/components/Dashboard.test.tsx` | vier Anteile → genau vier Sätze, absteigend, unter dem Titel                                                                                                                                                                                            |
| TF3 | AK3 | `frontend/src/components/Dashboard.test.tsx` | andere Anteile → andere Sätze in anderer Reihenfolge                                                                                                                                                                                                    |
| TF4 | AK4 | `frontend/src/components/Dashboard.test.tsx` | ohne Anteile → genau ein Fallback-Satz (mit/ohne Frist)                                                                                                                                                                                                 |
| TF5 | AK5 | `frontend/e2e/dashboard-cards.spec.ts`       | 375 px **und** 320 px: Karte innerhalb des Viewports (Bounding-Box, nicht `scrollWidth`), Aktionszeile bricht nicht um; Begründungsliste sichtbar (echte Kette Server→Karte)                                                                            |

## Erwartetes Ergebnis

Unter der Empfehlung stehen bis zu vier kurze Sätze (stärkste Anteile zuerst); wechselt die
Empfehlung, wechseln die Sätze; ohne Anteile genau ein Fallback-Satz aus Priorität und Frist; bei
375 px und 320 px Breite läuft die Karte nicht aus dem Viewport und die Aktionszeile bleibt in
einer Zeile.

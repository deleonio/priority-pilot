# ADR 0024 — Erledigen direkt mit „Rückgängig“ statt Bestätigungsdialog

- **Status:** Accepted (2026-10-13)
- **Datum:** 2026-10-13
- **Kontext:** löst den Vertrag „Dashboard-Signal-Panel: „Erledigt“ mit Bestätigungsdialog“ aus [docs/spec/issue-1168.md](../spec/issue-1168.md) (#1168) ab

## Kontext

Seit #1168 öffnet „Erledigen“ auf dem Dashboard einen nicht-destruktiven Bestätigungsdialog. Der
Klick ist aber der häufigste positive Moment der App — genau dort fällt ein zusätzlicher Tipp am
meisten ins Gewicht, und ein Modal ohne eigene Fokus-Begründung gilt nach der Design-Sprache als
Refuse-Fall ([ux-design.md](../../.ai-knowledge/ux-design.md) §7). Eine Zusatzfrage ist nur dort nötig, wo die
Erledigung wirklich etwas nachfragt: Checkliste oder Pünktlichkeit. Alle anderen Erledigungen
brauchen keine Bestätigung, sondern eine Rückmeldung.

## Entscheidung

**1. Ohne offene Checkliste wird direkt erledigt.** Der Klick auf „Erledigt“ setzt `status: Done`
ohne Zwischenschritt. Mit offenen Checklisten-Einträgen bleibt der Bestätigungsdialog
(`CompleteTaskDialog` mit Checklisten-Sektion, #1583); bei verpassten Aufgaben bleibt die
Pünktlich-Nachfrage (`MissedCompleteDialog` — „pünktlich“ bucht zur Deadline mit vollen Punkten).
Diese beiden Fälle sind die einzigen Dialoge vor dem Erledigen.

**2. Die Rückmeldung erscheint an der Tipp-Stelle, nicht als Toast.** Die Karte beziehungsweise das
Panel „Nächste Aufgabe“ zeigt nach der Erledigung einen kurzen Erfolgszustand mit den Zahlen aus
Punkt 4 und dem Knopf „Rückgängig“. Ein globales Overlay würde die Aufmerksamkeit von der Stelle
wegziehen, an der getippt wurde, verdeckt mobil Inhalte und stapelt schlecht; der Inline-Zustand
nutzt denselben Platz, der durch das Verschwinden der Aufgabe frei wird.

**3. „Rückgängig“ wird 7 Sekunden lang angeboten.** Nach Ablauf der 7 Sekunden — oder früher bei
Navigation/Neuladen — ist die Erledigung endgültig; im Dashboard-Panel erscheint danach die nächste
Aufgabe. Das Fenster ist so lang, dass ein Fehltipp auffällt und korrigierbar bleibt, und so kurz,
dass der Arbeitsfluss nicht stockt. „Rückgängig“ nutzt denselben Pfad wie das bestehende
„Wieder öffnen“ erledigter Aufgaben.

**4. Die Rückmeldung zeigt die vergebenen Punkte und den Streak.** Angezeigt werden die neu
vergebenen Punkte (Basiswert `estimatedEffort × priority`, verspätet reduziert — `score.ts`) und
der Streak-Stand nach der Erledigung (Kalendertage in Folge mit mindestens einer Erledigung —
`streak.ts`), kurz etwa „+3 Punkte · Streak 4 Tage“. Beide Zahlen ändern sich durch genau diese
Aktion und verstärken den positiven Moment; mehr Zahlen oder eine Aufschlüsselung gehören nicht in
die Rückmeldung, sondern in die vorhandenen Karten (Punkte, Streak).

**5. Fehlerfall inline an derselben Stelle.** Schlägt die Erledigung fehl, erscheint die
Fehlermeldung an der Tipp-Stelle, die Aufgabe bleibt offen — der heutige Dialog-Fehlerpfad
(`KolAlert _type="error"`) wandert entsprechend mit in den Inline-Zustand.

## Verworfene Alternativen

- **Toast als Rückmeldeform:** löst die Rückmeldung von der Tipp-Stelle, verdeckt mobil Inhalte und
  bietet für „Rückgängig“ ein Ziel außerhalb der Daumenzone ([mobile-ui-rules.md](../mobile-ui-rules.md)).
- **Bestätigungsdialog behalten, Hauptknopf vorbefüllen:** spart keinen Tipp — genau der
  zusätzliche Tipp ist der Kostenpunkt (Issue-Begründung).
- **Ganz ohne „Rückgängig“-Fenster:** nimmt die Fehltipp-Absicherung weg, die der Dialog bisher
  bot; direkt ohne Korrekturmöglichkeit ist nur bei klar bestätigter Absicht vertretbar.

## Konsequenzen

- Der Code-Umbau („Erledigt“ direkt, Inline-Rückmeldung, Dialog nur noch für die beiden
  Ausnahmen aus Entscheidung 1) folgt in eigenen Tickets aus #2519; bis dahin bleibt der Stand aus
  #1168 im Code. Dieser ADR ändert keinen Code.
- [docs/spec/issue-1168.md](../spec/issue-1168.md) bleibt als Historie stehen und ist durch eine
  Superseded-Zeile als abgelöst markiert.
- Folgetickets implementieren die 7-Sekunden-Fenster und die Zahlenanzeige ohne erneute
  Produktentscheidung; Abweichungen davon laufen über ein neues ADR.

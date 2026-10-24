# Spec #2941 — Ansichten Teil 4: Einstiege und Umleitung

Ziel: Jeder Aufgaben-Titel (Baum, vier Dashboard-Karten, Graph-Auswahl) öffnet die Aufgaben-Ansicht
`/aufgaben/<id>` (#2938) als Leseseicht statt des Bearbeiten-Dialogs; `/tasks/<id>` (Alt-Pushes)
leitet dauerhaft mit `replace` dorthin um; alle neuen Task-Push-URLs zeigen auf `/aufgaben/<id>`.

## AK1 — Baum-Titel als Link

- **Ziel:** Der Titel im Aufgabenbaum (`TaskTree.tsx`) ist ein echter `KolLink` mit `_href`
  `${import.meta.env.BASE_URL}aufgaben/<id>` (Muster `TaskView.tsx:82`) — Mittelklick/neuer Tab
  funktionieren, kein onClick-Navigieren.
- **Schritte:** Aufgaben-Tab öffnen → auf den Titel einer Aufgabe tippen.
- **Erwartet:** Navigation zu `/app/aufgaben/<id>`; die Ansicht zeigt den `h1` mit dem Titel; kein
  „Aufgabe bearbeiten“-Dialog. Die Zielfläche ist die ganze Titelzeile (mind. 44 px hoch,
  ≥8 px Abstand zu den Icon-Buttons derselben Zeile); langer Titel umbrochen, nicht geclippt.
  Heading-Semantik bleibt erhalten (Link in der bestehenden Heading-Ebene); GeoBadge bleibt
  eigenes Ziel außerhalb des Link-Targets.

## AK2 — Dashboard-Karten-Titel als Links

- **Ziel:** Die Titel der vier Karten „Nächste Aufgabe“, „Top-Aufgaben“, „Deadlines“ und
  „Verpasst“ sind Links auf `/app/aufgaben/<id>`.
- **Schritte:** Dashboard-Tab öffnen → Titel-Klick je Karte.
- **Erwartet:** Je Klick Navigation in die Aufgaben-Ansicht der Aufgabe; die bestehenden
  Erledigen-/Bearbeiten-Aktionen der Karten bleiben funktionsfähig („Erledigen“ bleibt einzige
  Primäraktion der „Nächste Aufgabe“-Karte, Präzedenz #1465).

## AK3 — Serien-Tab-Titel (Nachzug in #2942)

- Link auf `/serien/<id>` gemäß Konzept §6. Die Route liefert Teil 5 (#2942, parallel) — der Test
  und die Umsetzung erfolgen erst mit/nach #2942 (Merge-Reihenfolge ist PO-Entscheid), sonst
  hängt der Link ins Leere.

## AK4 — Graph-Auswahl „Ansehen“

- **Ziel:** Die Knoten-Auswahl-Karte (`TaskGraphPanel.tsx`) erhält „Ansehen“ mit Ziel
  `/aufgaben/<id>` als zweite, klar abgegrenzte Aktion neben „Abhängigkeiten bearbeiten“; der
  Knoten-Klick öffnet unverändert die Abhängigkeiten.
- **Erwartet:** „Ansehen“ trägt das Link-Ziel `/app/aufgaben/<id>` (echtes href); die
  Abhängigkeiten-Aktion bleibt Callback-getrieben.

## AK5 — Umleitung `/tasks/<id>` → `/aufgaben/<id>`

- **Schritte:** Deep-Link einer Alt-Push öffnen (`/app/tasks/<id>`); danach mit gelöschter ID.
- **Erwartet:** Sofortige Weiterleitung mit `replace` auf `/app/aufgaben/<id>` — die
  Aufgaben-Ansicht steht, kein „Aufgabe bearbeiten“-Dialog, kein `/tasks`-Eintrag in der
  History (Back führt zur Ursprungsseite). Bei gelöschter Aufgabe bleibt die URL stehen und die
  Ansicht zeigt „Diese Aufgabe gibt es nicht mehr.“ mit Link zu den Aufgaben (TaskView
  `notFound`); der Dashboard-Alert `deepLinkTaskGone` (#2848) entfällt.

## AK6 — Push-URLs

- `PUSH_TARGETS.dueTask.eine`, `PUSH_TARGETS.dailyTopTasks.eine`, `PUSH_TARGETS.taskCreated`,
  `PUSH_TARGETS.taskCompleted`, der Einzel-Aufgabe-Fall in `dailyDigest.ts` und beide Fälle in
  `geo-background-job.ts` senden `/aufgaben/<id>` als `url`. Alt-Pushes mit `/tasks/<id>`
  bleiben über die Umleitung (AK5) abgedeckt.

## AK7 — Bestandstest-Pflege

- e2e/Unit-Tests, die das Alt-Verhalten festhalten (Deep-Link → Bearbeiten-Dialog,
  `/tasks/<id>`-Push-URLs), sind im Spec-PR auf den neuen Vertrag umgeschrieben; die Stellen
  sind mit file:line im PR-Body unter „Test-Pflege-Bedarf“ dokumentiert.

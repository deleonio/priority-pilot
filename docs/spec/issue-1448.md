# Issue #1448 — Task-ID im Dashboard nicht anzeigen

## Ziel

Die Dashboard-Widgets „Nächste Aufgabe" und „Was ist jetzt dran?" zeigen den Aufgabentitel ohne
führendes `#<ID> – `-Präfix an. Andere Stellen (z. B. „Wichtigste Tasks", „Anstehende Deadlines",
„In der Nähe") sind nicht Teil dieses Tickets (siehe Offene Frage im Analyse-Block).

## Vorbedingung

`Dashboard` wird mit einer `nextTask` bzw. mit `suggestions` gerendert, deren `title` keinen
`#`-artigen Text enthält.

## AK1 — „Nächste Aufgabe" ohne ID-Präfix

**Schritte:** `Dashboard` mit `nextTask = { id: 114, title: 'Wondershare Filmora kündigen', … }` rendern.

**Erwartetes Ergebnis:** `.dashboard-next-task-title` enthält den Text „Wondershare Filmora
kündigen", aber nicht `#114`.

## AK2 — „Was ist jetzt dran?" ohne ID-Präfix

**Schritte:** `Dashboard` mit mehreren `suggestions` rendern (IDs ungleich `nextTask.id`).

**Erwartetes Ergebnis:** Jeder `.dashboard-suggestion-title`-Eintrag zeigt nur den Titel, ohne
`#<ID> – `-Präfix.

## AK3 — Priorität bleibt sichtbar

**Schritte:** Dieselben Renderings wie AK1/AK2.

**Erwartetes Ergebnis:** `.dashboard-next-task-priority` zeigt weiterhin „Priorität …“;
`.dashboard-suggestion-meta` zeigt weiterhin „(Priorität …)“.

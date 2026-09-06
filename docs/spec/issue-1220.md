# Spec #1220 — Balance-Priorisierung in der Aufgabenliste

Quelle: Issue #1220 (AK1–AK5) + KI-UX-Block (Harness-Kommentar) + Analyse #1220.
Rot-Tests: `frontend/src/lib/balancePriority.test.ts` (TF1–TF3),
`frontend/e2e/issue-1220-balance-mode.spec.ts` (TF4, TF5).

## Ziel

Die offene Aufgabenliste (Tab „Aufgaben") erhält einen Schalter **„Balance-Priorisierung"**
(`KolInputCheckbox _variant="switch"`, neben „Erledigte Aufgaben anzeigen" in der Filterleiste)
und einen Button **„Neu berechnen"** (`KolButton _variant="secondary"`). Im aktivierten Zustand
wird die Liste nach einer **virtuellen Balance-Priorität** sortiert, die aus dem
Säulen-Defizit berechnet wird — ohne jeglichen Schreibzugriff auf Tasks. Die Server-`priority`
bleibt unangetastet; Dashboard-Scoring („Was ist jetzt dran?", Vorschläge) bleibt unberührt.

Die Zuständigkeiten der beiden Bedienelemente sind getrennt (AK6): Der Schalter wechselt nur die
Sicht, der Button setzt nur den Stand neu. Der Button erscheint deshalb erst im aktivierten
Modus — außerhalb hätte ein Klick keine sichtbare Wirkung.

## Rechenkern (verbindlich für die Implementierung)

Neue reine Client-Lib `frontend/src/lib/balancePriority.ts` (React-frei, Vorbild
`heartBalance.ts`), Client-Übertragung der Defizit-Mathematik aus `server/src/logics/find.ts`:

- **Ist je Säule** (0–1): `doneEffortByPillar` = erledigter `estimatedEffort` je Säule, anteilig
  nach `share/100` — dieselbe Quelle wie das Dashboard (`buildPillarSummaries.doneEstimatedEffort`,
  konsistent zur Herz-Anzeige). `ist_i = doneEffort_i / Σ doneEffort` (0, wenn die Summe 0 ist).
- **Soll je Säule** (0–1): `weight_i / Σ weights` über alle Säulen; bei Gesamtgewicht 0 gilt
  Gleichverteilung (Muster `heartBalance.ts`).
- **Defizit** `nDefizit_i = soll_i > 0 ? max(0, soll_i − ist_i) / soll_i : 0` (Säule ohne Soll
  kann kein Defizit haben).
- **balanceScore je offenem Task**: `Σ (share_i/100) · nDefizit_i` über die Säulen-Beiträge des
  Tasks; Task ohne Säulen-Beitrag → 0 (neutral).
- **Virtuelle Priorität** (1–5, 5 = am dringendsten, gleiche Skala wie die Original-Prio):
  `virtualPriority = 1 + round(balanceScore · 4)` — score 1 → P5, 0,75 → P4, 0,5 → P3, 0,25 → P2,
  0 → P1. Rein vom eigenen Score abhängig (kein Rang unter Nachbarn).
- **Sortierung** (`sortTasksByBalance`): absteigend nach `balanceScore`, bei Gleichstand
  absteigend nach Original-`priority`, sonst stabil (keine Gleichstands-Umsortierung). Beide
  Kriterien stammen aus dem Snapshot (`originalPriority`), nicht aus den übergebenen
  Task-Objekten — sonst bliebe der Gleichstand live und die eingefrorene Liste sortierte sich um,
  sobald jemand die Prio eines score-gleichen Tasks ändert. Nur wo ein Task im Stand fehlt, zählt
  sein eigener Wert.
- **Badge-Label**: virtuelles Badge heißt `~P{n}` (Tilde-Präfix, KI-UX-Empfehlung: virtuelle und
  echte Prio nie ununterscheidbar); Original-Badge bleibt `P{n}` aus `priorityBadge`.

Vertrag (Exporte): `buildBalancePriorities(pillars, doneEffortByPillar, tasks)` →
`Map<taskId, { balanceScore, virtualPriority, originalPriority }>`,
`sortTasksByBalance(tasks, priorities)` → neu sortiertes Array (Input wird nicht mutiert),
`balancePrioritiesEqual(a, b)` → inhaltlicher Vergleich zweier Stände (trägt die
Veraltet-Erkennung; vergleicht alle drei Felder), `virtualPriorityLabel(virtualPriority)` →
`` `~P${n}` ``.

## Snapshot-Semantik (AK2)

Der Stand ist abgeleiteter Datenwert, nicht Ergebnis eines Klicks: Solange der Modus **aus** ist,
läuft er mit der Datenlage mit (sichtbar ist nichts, also springt auch nichts). Mit dem
**Einschalten friert er ein** und bleibt bis zum Klick auf „Neu berechnen" stehen — auch dann,
wenn die App die Daten zwischenzeitlich neu lädt. Genau dort schützt das Einfrieren: Die Liste
sortiert sich nicht um, während man sie abarbeitet.

Damit rechnet der Schalter nie selbst und zeigt trotzdem sofort einen aktuellen Stand. Der Klick
auf „Neu berechnen" lädt die Datenbasis frisch und ersetzt den Stand; er wird per
`aria-live="polite"` angekündigt (KI-UX, WCAG 4.1.3). Weicht der eingefrorene Stand von der
aktuellen Datenlage ab, weist der Hinweis ihn als veraltet aus („Daten haben sich geändert") —
ohne dieses Signal wäre nicht erkennbar, wann eine Neuberechnung überhaupt etwas ändert.
Der Schalter-Zustand ist session-lokal (keine Persistenz).

## AK1 — Sortierung nach Balance-Priorität

- **Vorbedingung:** Aufgaben-Tab, offene Aufgaben; mindestens eine Säule unterversorgt
  (erledigter Aufwand liegt fast ausschließlich in anderen Säulen).
- **Schritte:** Schalter „Balance-Priorisierung" aktivieren.
- **Erwartet:** Ein Task niedriger Original-Prio (z. B. P1), der voll in eine unterversorgte
  Säule einzahlt, steht **über** einem Task hoher Original-Prio (z. B. P5) in einer versorgten
  Säule. Sind alle Säulen ausgeglichen (Defizit überall 0), folgt die Sortierung der
  Original-Prio (Sekundärkriterium).

## AK2 — „Neu berechnen" ersetzt den eingefrorenen Stand sichtbar

- **Vorbedingung:** Balance-Modus aktiv, Reihenfolge nach letzter Berechnung.
- **Schritte:** Datenbasis extern ändern (Task per API erledigen, der die Defizit-Lage kippt);
  Anzeige bleibt eingefroren; dann „Neu berechnen" klicken.
- **Erwartet:** Vor dem Klick unveränderte Reihenfolge; nach dem Klick die der neuen Datenlage
  entsprechende Reihenfolge (und Badges). Der Schalter bleibt dabei an.
- **Veraltet-Hinweis:** Ändert sich die Datenlage innerhalb der App (z. B. Aufgabe über die Liste
  erledigen), trägt der Stand-Hinweis „Daten haben sich geändert"; nach der Neuberechnung ist der
  Zusatz weg. Eine geänderte Original-Prio zählt dazu, auch wenn kein Score sich rührt — sie
  bricht den Gleichstand und verschiebt damit die Reihenfolge.
- **Ladezustand:** Während „Neu berechnen" lädt, ist der Button deaktiviert und heißt
  „Berechne neu …", damit er nicht tot statt beschäftigt wirkt.

## AK3 — Virtuelles Badge, keine Schreibzugriffe

- **Schritte:** Im Balance-Modus Badges betrachten (Netzwerk-Mitschnitt läuft); zurückschalten.
- **Erwartet:** P-Badge zeigt `~P{n}` (virtuelle Prio); während Aktivieren/Betreiben des Modus
  geht **kein** Schreibrequest auf `/api/v1/tasks` (kein PATCH/POST/PUT/DELETE) raus; nach dem
  Zurückschalten zeigt das Badge wieder die Original-`P{n}`.

## AK4 — Getrennte Werte bei wiederholtem Umschalten

- **Schritte:** Modus mehrfach ein-/ausschalten.
- **Erwartet:** Jedes Mal die richtige Sortierung/Badges — Balance-Werte und Original-Werte
  bleiben getrennt erhalten (kein Vermischen oder Verlust).

## AK5 — Mobile-First (375 px)

- **Schritte:** Aufgaben-Tab bei 375 px Breite, Balance-Modus einschalten.
- **Erwartet:** Schalter, Stand-Hinweis und „Neu berechnen"-Button sichtbar und bedienbar; kein
  horizontales Clipping der Filterleiste (Bounding-Box-Prüfung, die App-Shell clippt `overflow-x`,
  daher keine `scrollWidth`-Assertion).

## AK6 — Getrennte Zuständigkeiten von Schalter und Button

- **Schritte:** Aufgaben-Tab; Button ohne aktiven Modus suchen; Schalter anschalten (Netzwerk-
  Mitschnitt läuft); „Neu berechnen" klicken; Schalter ausschalten.
- **Erwartet:** Ohne aktiven Modus ist der Button nicht vorhanden. Der Schalter sortiert um, ohne
  einen `GET` auf `/api/v1/tasks` auszulösen. Der Button lädt die Datenbasis nach und lässt den
  Schalter dabei angeschaltet. Ausschalten blendet den Button wieder aus.

## Test-Pflege / dedup

Keine bestehenden Tests decken Balance-Sortierung oder den Schalter ab (grep über
`frontend/src` / `frontend/e2e` nach `balancePriority`/`Balance-Prio` = 0 Treffer) — keine
Dubletten, keine Widersprüche.

# Spec #1220 — Balance-Priorisierung in der Aufgabenliste

Quelle: Issue #1220 (AK1–AK5) + KI-UX-Block (Harness-Kommentar) + Analyse #1220.
Rot-Tests: `frontend/src/lib/balancePriority.test.ts` (TF1–TF3),
`frontend/e2e/issue-1220-balance-mode.spec.ts` (TF4, TF5).

## Ziel

Die offene Aufgabenliste (Tab „Aufgaben") erhält einen Schalter **„Balance-Priorisierung"**
(`KolInputCheckbox _variant="switch"`, neben „Erledigte Aufgaben anzeigen" in der Filterleiste)
und einen Button **„Ausbalancieren"** (`KolButton _variant="secondary"`). Im aktivierten Zustand
wird die Liste nach einer **virtuellen Balance-Priorität** sortiert, die aus dem
Säulen-Defizit berechnet wird — ohne jeglichen Schreibzugriff auf Tasks. Die Server-`priority`
bleibt unangetastet; Dashboard-Scoring („Was ist jetzt dran?", Vorschläge) bleibt unberührt.

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
  absteigend nach Original-`priority`, sonst stabil (keine Gleichstands-Umsortierung).
- **Badge-Label**: virtuelles Badge heißt `~P{n}` (Tilde-Präfix, KI-UX-Empfehlung: virtuelle und
  echte Prio nie ununterscheidbar); Original-Badge bleibt `P{n}` aus `priorityBadge`.

Vertrag (Exporte): `buildBalancePriorities(pillars, doneEffortByPillar, tasks)` →
`Map<taskId, { balanceScore, virtualPriority }>`, `sortTasksByBalance(tasks, priorities)` →
neu sortiertes Array (Input wird nicht mutiert), `virtualPriorityLabel(virtualPriority)` →
`` `~P${n}` ``.

## Snapshot-Semantik (AK2)

Berechnet wird **beim Aktivieren des Schalters** und **auf Klick „Ausbalancieren"**. Die
angezeigte Reihenfolge/Badges sind bis zum nächsten Klick **eingefroren**: Ändert sich die
Datenbasis (z. B. Task wird erledigt), hält die Anzeige den letzten Stand — auch dann, wenn die
App die Daten zwischenzeitlich neu lädt. Der Klick löst Neuberechnung (und den dafür nötigen
Refresh der Datenbasis) aus und wird per `aria-live="polite"` angekündigt (KI-UX, WCAG 4.1.3).
Der Schalter-Zustand ist session-lokal (keine Persistenz).

## AK1 — Sortierung nach Balance-Priorität

- **Vorbedingung:** Aufgaben-Tab, offene Aufgaben; mindestens eine Säule unterversorgt
  (erledigter Aufwand liegt fast ausschließlich in anderen Säulen).
- **Schritte:** Schalter „Balance-Priorisierung" aktivieren.
- **Erwartet:** Ein Task niedriger Original-Prio (z. B. P1), der voll in eine unterversorgte
  Säule einzahlt, steht **über** einem Task hoher Original-Prio (z. B. P5) in einer versorgten
  Säule. Sind alle Säulen ausgeglichen (Defizit überall 0), folgt die Sortierung der
  Original-Prio (Sekundärkriterium).

## AK2 — „Ausbalancieren" stößt die Neuberechnung sichtbar an

- **Vorbedingung:** Balance-Modus aktiv, Reihenfolge nach letzter Berechnung.
- **Schritte:** Datenbasis extern ändern (Task per API erledigen, der die Defizit-Lage kippt);
  Anzeige bleibt eingefroren; dann „Ausbalancieren" klicken.
- **Erwartet:** Vor dem Klick unveränderte Reihenfolge; nach dem Klick die der neuen Datenlage
  entsprechende Reihenfolge (und Badges).

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

- **Schritte:** Aufgaben-Tab bei 375 px Breite.
- **Erwartet:** Schalter und „Ausbalancieren"-Button sichtbar und bedienbar; kein horizontales
  Clipping der Filterleiste (Bounding-Box-Prüfung, die App-Shell clippt `overflow-x`, daher keine
  `scrollWidth`-Assertion).

## Test-Pflege / dedup

Keine bestehenden Tests decken Balance-Sortierung oder den Schalter ab (grep über
`frontend/src` / `frontend/e2e` nach `balancePriority`/`Balance-Prio` = 0 Treffer) — keine
Dubletten, keine Widersprüche.

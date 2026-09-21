# Issue 1582 — Aufgaben anpinnen

Issue: #1582 · Spec-Phase (rote Tests als ausführbarer Vertrag)

## Ziel

Jede Aufgabe lässt sich über einen Pin-Schalter an- und abpinnen. Angepinnte Aufgaben stehen
in Tabelle und Dashboard immer über der restlichen Liste — unabhängig von Sortierung — bleiben
nach Neuladen angepinnt und sind visuell (Icon) erkennbar. Abgepinnte Aufgaben kehren sofort in
die normale Sortierung zurück (siehe KI-UX-Block: eigener „Angepinnt"-Abschnitt, `pinned`

- `pinnedAt` auf dem Task-Modell, `kol-input-checkbox _variant="button"` als Pin-Schalter).

## Vertrag Server

- Neue Task-Spalten `pinned: boolean` (Default `false`) und `pinnedAt: Date | null`
  (`server/src/models/task.ts`, analog zum bestehenden Flag `isException`).
- `PATCH /tasks/:id` validiert und übernimmt `pinned` (Boolean, sonst 400) — beim Setzen von
  `pinned: true` setzt der Server `pinnedAt` auf den aktuellen Zeitpunkt, beim Setzen von
  `pinned: false` wird `pinnedAt` auf `null` zurückgesetzt (serverseitig, nicht vom Client
  vorgebbar — `pinnedAt` ist rein abgeleitet).
- `serializeTask` gibt `pinned` und `pinnedAt` (ISO-String oder `null`) im DTO aus.
- Bestehende Tasks ohne explizites Pinnen bleiben `pinned: false` (Backward-Kompatibilität,
  analog Checklisten-Feld #531).

## Vertrag Frontend

- `frontend/src/lib/task.ts`: neue reine Funktion `sortPinnedFirst(tasks: Task[]): Task[]` —
  stabile Sortierung, die angepinnte Tasks (nach `pinnedAt`, neueste zuerst) vor alle
  unangepinnten stellt und die relative Reihenfolge innerhalb beider Gruppen sonst unverändert
  lässt. Wird auf das Array angewendet, **bevor** es an `TaskTable`/Dashboard-Widgets geht —
  macht AK2 unabhängig von der (Client-seitigen) Spaltensortierung der Tabelle.
- `TaskTable`: neue Spalte/Zellzustand mit Pin-Icon (`fa-solid fa-thumbtack`) je Zeile, per
  `kol-input-checkbox`-Button toggelbar (`onPinToggle`-Callback), sichtbar unterschiedlich für
  gepinnte vs. ungepinnte Zeilen (AK4).
- Dashboard: neuer „Angepinnt"-Abschnitt unterhalb „Nächste Aufgabe" (nur sichtbar, wenn
  mindestens ein Task gepinnt ist).

## Testfälle (rote Tests)

| TF  | Datei                                               | Deckt    |
| --- | --------------------------------------------------- | -------- |
| TF1 | `server/src/express/tasks-pinned.test.ts` (neu)     | AK1, AK3 |
| TF2 | `frontend/src/lib/task.test.ts` (erweitert)         | AK2, AK5 |
| TF3 | `frontend/src/components/TaskTable.test.tsx` (erw.) | AK4      |

## Offene Fragen

- Dashboard-„Angepinnt"-Abschnitt (AK2 im Dashboard-Kontext) und E2E-Vollzyklus (Pin → Reload →
  Reihenfolge) sind in dieser Spec-Runde nicht als eigener roter Test verankert — die
  Kernvertragspunkte (Server-Persistenz TF1, Sortierlogik TF2, Tabellen-UI TF3) decken die
  Akzeptanzkriterien schon durchgängig ab; ein Dashboard-Komponententest würde denselben
  `sortPinnedFirst`-Vertrag nur ein zweites Mal prüfen (Dedup-Regel). Die Impl-Phase kann bei
  Bedarf einen E2E-Test ergänzen, falls die Kreuzverhör-Phase eine Lücke sieht.

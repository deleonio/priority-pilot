# #2715 — Serien pausieren und fortsetzen

## Ziel

Aus der Serien-Verwaltung (`SeriesTab`) lässt sich jede eigene Automatik-Serie ohne
Bestätigungsdialog pausieren (`PATCH /series/:id`, `active: false`) und jederzeit wieder
fortsetzen (`active: true`). Pausierte Serien erzeugen keine neuen Instanzen mehr; bestehende
Instanzen bleiben unberührt; beim Fortsetzen läuft die Serie ab heute weiter, ohne das
Pause-Fenster nachzutragen. Der Server ändert sich nicht — `Series.active`, PATCH-Validierung
und Generierungssperre stehen bereits (`routes/series.ts:303-308`, `logics/series.ts:302,380`).

## Ablauf und erwartetes Ergebnis

### AK1 — Aktionen je Zustand

- Eigene Serie mit `active: true` → Toolbar-Aktion „Serie pausieren"; `active: false` →
  „Fortsetzen" (Icon-Button mit sprechendem `_label`, `_hideLabel`, `_variant="secondary"` —
  exakt das Muster der Nachbar-Aktionen in derselben `KolToolbar`).
- Ausnahme (KI-UX): bei `autoCreate: false` („Vorlage", #2358) entfällt die Aktion — die Serie
  erzeugt ohnehin nichts, ein Zustandswechsel wäre sinnlos (gleiche Bedingungslogik wie
  „Aufgabe anlegen").
- Touch-Target ≥ 44 px (KoliBri `--a11y-min-size` trägt das), bedienbar im 375px-Viewport; die
  Toolbar darf umbrechen, aber nicht horizontal überlaufen.

### AK2 — Pausieren wirkt

- Klick „Serie pausieren" sendet `api.updateSeries({ id, seriesUpdate: { active: false } })`;
  der Button ist während des PATCH deaktiviert (Doppel-Tap-Schutz), Erfolg zeigt sich sofort
  (Badge + Button-Wechsel).
- Danach erzeugen `generate-all` und der tägliche Job für diese Serie 0 neue Instanzen
  (Server-Vertrag, bereits gesichert durch `series.test.ts` „materializeDueSeries … keine für
  inaktive" und `groups-series-resting.api.test.ts:184` — der Spec-PR testet die fehlende
  Paarung „Pausieren setzt genau dieses Flag" nur im Frontend).

### AK3 — Bestand bleibt

- Bereits angelegte Instanzen bleiben nach dem Pausieren im Aufgabenbestand sichtbar —
  Pausieren löscht nichts (die `applyToInstances`-Kaskade fasst `active` bewusst nicht an,
  `routes/series.ts:655`).

### AK4 — Fortsetzen ohne Nachtrag

- Klick „Fortsetzen" sendet `{ active: true }`. Der nächste Generierungslauf erzeugt wieder
  Instanzen nach Rhythmus, beginnend ab heute (UTC) — die Pause-Wochen werden nicht nachgelegt
  (bewusstes Verhalten des „nur zukünftig"-Pfads, `logics/series.ts:296-330`).
- Logik-Vertrag neu in `server/src/logics/series.test.ts`: pausierte Serie → 0 Instanzen;
  nach Reaktivierung → nur Termine ≥ heute.

### AK5 — Zustand erkennbar

- Serie mit `active: false` trägt das bestehende Text-Badge „Ruhend" (`seriesTab.badgeDormant`,
  #1251). Label bleibt „Ruhend" (KI-UX-Entscheidung: zwei Ursachen — Gruppen-Ruhe #1251 und
  eigenes Pausieren — teilen ein Badge; „Pausiert" würde Gruppen-Fälle falsch ausweisen).
  Farblos wie #1251, Pause ist kein Warn-Status.

### AK6 — Direkt und umkehrbar (ADR 0024)

- Beide Aktionen laufen ohne Bestätigungsdialog/Modal und sind jederzeit gegenseitig
  zurücknehmbar; kein Datenverlust. Fehler beim PATCH erscheinen inline als `KolAlert`
  (bestehendes `actionFailed`-Muster des SeriesTab), nie nur als Toast; der Fokus bleibt nach
  dem Button-Wechsel auf der Toolbar (KI-UX).

## Randbedingungen

- Kein Nachtrag verpasster Termine (Issue will „läuft wieder wie zuvor").
- Keine Server-Änderung; `SeriesUpdate` führt `active` bereits (Client-Schema).
- i18n nur de+en: neue Keys `seriesTab.pause` („Serie pausieren") und `seriesTab.resume`
  („Fortsetzen") in `capture.json`.
- Fürsorge-Satz im Erfolgskontext (de+en, KI-UX-Empfehlung): „Bereits angelegte Termine
  bleiben bestehen.“ — genauer Umsetzungsort (Alert-Text beim Badge-Wechsel) ist
  Impl-Entscheidung.

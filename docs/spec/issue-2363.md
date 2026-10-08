# Spec #2363 — Aus Vorlage erfassen (Schnellerfassen)

Vertrag: `GET /series` + `POST /series/{id}/instances` (#2359, unverändert). Frontend-only.

## Button „Aus Vorlage" (AK1)

- Vierter Button im Capture-Schritt (`modal-actions`), `secondary` wie die Nachbarn, gesperrt während `parsing`/`advising`. Die eine Primäraktion („Verarbeiten und weiter") bleibt unangetastet.
- Klick: Schritt „Vorlage wählen" im selben persistenten Modal (kein Modal-Stapel, kein Remount — Muster #236/#1335). `api.listSeries()` liefert die Einträge; während des Ladens `KolSpin` wie im Capture-Schritt.

## Auswahl (AK1)

- Vertikale Liste aus `KolButton` (`secondary`, volle Breite), Beschriftung = Serientitel — bewusst KEIN `KolSingleSelect` (wenige Vorlagen, sichtbare Titel, deterministischer Tastaturpfad; UX nannte beides als erlaubt).
- Genau die Serien mit `autoCreate === false` (Vorlagen); Serien mit `autoCreate: true` oder ohne Flag erscheinen nicht.

## Wahl (AK2)

- Wahl eines Eintrags schließt die Schnellerfassung und öffnet `SeriesInstanceDialog` („Aufgabe anlegen: <Serientitel>", vorbefüllt) mit dieser Serie — unverwendet, nicht dupliziert.
- Bestätigen legt per `POST /series/{id}/instances` an; `onCreated` läuft auf denselben Pfad wie `onSaved` (Dialog zu, Liste neu).

## Leerzustand (AK3)

- Keine Vorlage (keine Serie mit `autoCreate === false`): gestalteter Hinweis (info) statt leerer Liste — nennt den Weg: Tab „Serien & Vorlagen", dort Serie ohne „Automatisch anlegen" anlegen.

## Tastatur (AK4)

- Kompletter Pfad Button → Auswahl → Eintrag → Dialog per Tab/Enter. Escape schließt die Auswahl zurück in den Capture-Schritt (Freitext bleibt erhalten, kein vollständiger Modal-Schluss). Escape im `SeriesInstanceDialog`: bestehendes Verhalten, unverändert.

## Mobile (AK5)

- 375 px: Auswahl und Dialog ohne horizontales Scrollen — Bounding-Box (linke Kante ≥ 0, rechte Kante ≤ 375), nicht `scrollWidth` (App-Shell clippt).

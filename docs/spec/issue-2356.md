# Serien: täglich automatisch anlegen

**Stand:** 2026-10-07

## Ziel

Fällige Serien-Instanzen entstehen ohne Nutzeraktion: Ein Server-Job legt sie für alle aktiven Serien mit eingeschaltetem „Automatisch anlegen“ (`autoCreate`) an. Der Button „Fällige Instanzen generieren“ entfällt.

## Ablauf

1. **Job:** `runSeriesAutoCreate(now, pushSender?)` in `server/src/logics/seriesAutoCreate.ts` ruft `materializeDueSeries(undefined, now + 30 Tage, pushSender)` — alle Nutzer, Horizont 30 Tage (gemeinsame Konstante mit `POST /series/generate-all`), höchstens 5 offene Instanzen je Serie.
2. **Auswahl:** nur `active: true` und `autoCreate: true`; Vorlagen (`autoCreate: false`) und ruhende Serien bleiben leer.
3. **Idempotenz:** ein zweiter Lauf legt keine Dubletten an (Anker `seriesOccurrence`).
4. **Benachrichtigung:** Bei fremd angelegten Serien (`createdById != userId`) erhält der Empfänger je Lauf genau eine gebündelte Nachricht (#1253).
5. **Verdrahtung:** Start einmal beim Serverstart, danach täglich; unabhängig von `PUSH_REMINDERS_ENABLED`/VAPID. Ein fehlschlagender Lauf wird geloggt, der Timer läuft weiter.
6. **UI:** Der Serien-Tab (und die Serien-Verwaltung) zeigt keinen Button „Fällige Instanzen generieren“; `api.generateAllSeries` entfällt. `POST /series/generate-all` bleibt als Test-Seam.

## Erwartetes Ergebnis

- Lauf mit `autoCreate`-Serie: 5 offene Instanzen (Horizont: Start nach Tag 30 → keine).
- Zweiter Lauf: Bestand unverändert.
- Handbuch: Button-Absatz entfällt.

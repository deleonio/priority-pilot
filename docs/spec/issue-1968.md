# Spec #1968 — Teilbare Wochen-Balance-Karte

Ziel: Ab Sonntag zeigt das Balance-Dashboard eine teilbare Karte „Meine Woche in fünf Säulen“ — Säulenwerte und Streak als gepflegtes PNG, ohne Aufgabeninhalte. Teilen über den Systemdialog (Web Share mit Datei), Download als Fallback.

## Wochenschema

- Kalenderwoche Montag–Sonntag in der Nutzerzeitzone (Annahme aus der Triage); die Karte wird frühestens am Sonntag der laufenden Woche angeboten. Vorher erscheint weder Card noch Teilen-Button.
- Datenbasis: `GET /scores/balance/history?von&bis&tz` (Säulenwerte je Tag) + Streak (`GET /scores/streak` bzw. `/scores/balance`); Client-Aufrufe über `api` wie bei `StreakCard` (Selbstlade-Card, keine Prop-Kette).

## Karte (AK1)

- Reine SVG-String-Erzeugung in `frontend/src/lib/weeklyShareCard.ts`, ohne DOM-Abhängigkeit und ohne neue npm-Abhängigkeit: Eingabe Säulennamen/-werte, Streak, Wochenlabel; Ausgabe SVG-String.
- Im SVG stehen je Säule Name und Wert, die Streak-Zahl, das Wochenlabel sowie dezent Marke („Balamentum“) und Link.
- Kein Aufgaben-Titel und kein Aufgabeninhalt im SVG — auch nicht indirekt über übergebene Datenobjekte (Köder-Test).

## Teilen und Download (AK2, AK3)

- Teilen-Button (sekundär, bewusst keine `_variant="primary"` — die eine Primary der Sicht gehört der „Nächsten Aufgabe“): bei `navigator.canShare({ files: [png] })` ruft er genau einmal `navigator.share({ files, title, text })` mit der erzeugten PNG auf (User-Gesture).
- Ohne File-Share-Fähigkeit (`canShare` false oder fehlend) wird `navigator.share` nicht aufgerufen; der Download-Pfad bleibt voll nutzbar (kein toter Button).
- Download erzeugt per SVG→Canvas-Rasterisierung (Canvas 2D, ohne neue npm-Abhängigkeit) eine PNG-Datei: Anchor mit `download`-Attribut und Blob-URL; der Dateiname enthält Kalenderwoche und Jahr.
- Abbruch des Systemdialogs (`AbortError`) ist kein Fehlerzustand (advisory, UX-Block); scheitert die Rasterung, bleibt der Download-Pfad nutzbar.

## Sichtbarkeit und Schutz (AK4, AK5)

- Vor Sonntag: weder Card noch Button; ab Sonntag rendert die Card im Dashboard (`StreakCard`-Muster, `data-testid="weekly-balance-card"`).
- Ohne Anmeldung ist die Karte nicht abrufbar: sie lebt nur in der authentifizierten App-Ansicht. Der 401-Schutz der Datenendpunkte ist serverseitig bereits abgesichert (Muster `streak.test.ts` „ohne Session → 401“; der History-Endpunkt folgt demselben `requireAuth`-Muster — dedup, kein neuer Servertest).

## Mobile (AK6)

- Bei 375 px bricht die Card untereinander um, ohne horizontalen Überlauf (Bounding-Box-Assertions, nicht scrollWidth — die App-Shell clippt).
- Der Teilen-Button nimmt die volle Zeilenbreite ein (Touch-Target ≥ 44 px).

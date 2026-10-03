# Spec: KI-Verteilung als übernehmbarer Vorschlag (#2078)

## Ziel

Der KI-Säulen-Vorschlag wird nie mehr automatisch angewendet. Er erscheint als eigenständiger
Block „KI-Vorschlag“ mit Herkunftsangabe und den fünf Anteilen; der Nutzer entscheidet per
„Vorschlag übernehmen“/„Verwerfen“. Übernehmen erzeugt eine gültige Vollverteilung (#2077) aus
den Server-`share`-Werten (#2076) und das Speichern meldet die finale Verteilung an den
Feedback-Loop (#45).

## Voraussetzungen

- Anlege-Dialog (Task und Serie) mit KI-Gate (`ai_assist`, #1527) und fünf festen Säulen (#1573).
- `POST /tasks/suggest-pillars` liefert `PillarSuggestion { pillarId, confidence, share? }`
  (`share` optional, Alt-Antworten erlaubt).

## Ablauf / Verhalten

### Block „KI-Vorschlag“ (AK1, AK2)

- Nach „Säulen vorschlagen“ und nach dem Auto-Vorschlag der Schnellerfassung erscheint
  unterhalb der Vorschlag-Auslösung ein Block mit zugänglichem Namen „KI-Vorschlag“
  (Herkunftsangabe als Text) und den fünf Anteilen als Liste „Säulenname — x %“.
- Der Block erscheint ohne Fokuswechsel (aria-live-Ankündigung, keine assertive Rolle).
- `contributions` und `rankedPillarIds` bleiben bis „Vorschlag übernehmen“ unverändert —
  kein automatisches Anwenden (heutiges Verhalten von `suggestPillars()` entfällt).
- „Verwerfen“ entfernt den Block; angetippte Rangfolge und ihre Anteile bleiben unverändert.
  Fokus-Rückkehr auf den „Säulen vorschlagen“-Auslöser (Fokus darf nicht auf `body` fallen).
- Ein zweiter Abruf ersetzt einen stehenden Block still; schlägt er fehl, bleibt der Block.

### Übernehmen (AK3, AK4)

- „Vorschlag übernehmen“ setzt `contributions` exakt auf die KI-`share`-Werte und leitet
  `rankedPillarIds` ab: Anteile absteigend, Gleichstand nach Listenordnung.
- Enthält die Antwort kein `share`, erzeugt der Fallback `suggestionsToContributions`
  die Anteile (Konfidenz-basiert, strukturell gültig für die fünf festen Säulen).
- In beiden Fällen: Vollverteilung über alle fünf Säulen, jeder Anteil 5–80, Summe exakt 100.
- Ein erneutes Antippen einer Säule nach der Übernahme ersetzt die KI-Verteilung durch die
  Rangfolge-Treppe (#2074: 50/20/15/10/5) mit sichtbarer Rückmeldung: die bestehende
  aria-live-Region (TaskForm.tsx:1413) ergänzt einen Rückkehr-Hinweis (enthält „Rangfolge“).

### Feedback beim Speichern (AK5)

- Feedback-Vertrag (von der Spec entschieden): `PillarFeedbackInput.pillars` bleibt
  `PillarSuggestion[]` — `confidence` behält die KI-Konfidenz aus der Antwort, `share`
  trägt die finalen (übernommenen bzw. Fallback-)Anteile. Keine Schema-Erweiterung nötig.
- Speichern nach Übernahme sendet die finale Verteilung samt Anteilen als Korrektur an
  `POST /tasks/suggest-pillars/feedback` (weiterhin Best-Effort, fire-and-forget). Der Server
  akzeptiert die gespeicherte Verteilung (kein 400 aus der #2077-Vollverteilungs-Pflicht).
- Ohne Übernahme (auch nach „Verwerfen“ oder nur angetippter Rangfolge) wird kein Feedback
  gesendet.

### Mobile (AK6)

- Bei 375 px: Block einspaltig, beide Schaltflächen ohne horizontales Scrollen bedienbar,
  Touch-Ziele mindestens 44 px (KoliBri-Default `--a11y-min-size`).

## Erwartetes Ergebnis

Ein Frontend-PR: TaskForm rendert den Block statt Sofort-Anwendung, Übernehmen/Verwerfen
arbeiten nach obigem Vertrag, Feedback-Payload enthält die finalen `share`-Werte; #2074-Rangfolge,
#1984-Expertenregler und #1527-Gate bleiben unberührt.

## Offene Fragen

- keine.

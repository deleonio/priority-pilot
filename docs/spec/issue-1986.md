# Spec: Onboarding-Flow für den Erststart (#1986)

## Ziel

Neue Nutzer ohne eigene Tasks werden durch einen 5-Schritt-Flow geführt (Freitext → KI-Vorschläge →
Übernehmen/Weglassen → Startgewichtung → Abschluss-Karte). Danach zeigt der Dashboard-Leerzustand
mindestens drei abhakbare Beispielaufgaben statt einer leeren Fläche.

## Vorbedingungen

- Nutzer eingeloggt (Auth-Gate), Besitzt **keine eigenen Tasks**.
- KI-Endpunkt braucht aktives Paket mit `ai_assist` (Pro) und Fair-Use-Quota.

## Ablauf

### Schritt 1 — Freitext

- Flow startet automatisch nach Login ohne eigene Tasks (`App.tsx`, Stelle des `EmptyState`).
- Einziges Feld: Textarea **„Was beschäftigt dich gerade?"** (`KolTextarea`, max 2000 Zeichen,
  Muster `QuickCaptureModal`). Kein weiteres Pflichtfeld.
- Leeres Feld ist ein gültiger Pfad (kein Fehler): „Weiter" führt ohne Vorschläge direkt in den
  Leerzustand mit Beispielaufgaben (AK7-Pfad).

### Schritt 2 — KI-Vorschläge erzeugen

- Ladezustand mit `KolSpin` (sprechendes Label); Fehler als `KolAlert` mit Wiederholung;
  Quota ausgeschöpft als `AiQuotaHint` mit Ausweg Beispielaufgaben.

### Schritt 3 — Übernehmen/Weglassen

- 5–8 Vorschlagskarten; jede einzeln über eine Checkbox übernehmbar oder weglassbar (Default:
  übernommen). Karte = Touch-Target, Titel als individuelles Checkbox-Label, Säulen-Badge +
  Abhängigkeit als Text („nach: …").

### Schritt 4 — Startgewichtung

- `PillarWeightsForm` eingebettet als eigener Schritt (kein Modal im Flow), vor dem Abschluss
  verpflichtend durchlaufen.

### Schritt 5 — Abschluss-Karte

- Zeigt den **nächsten Schritt** und einen **Balance-Hinweis**; mindestens die erste Aufgabe ist
  direkt auf der Karte abhakbar (Abhaken legt den echten Task an).

## Abbruch & Wiedereinstieg (AK6)

- Jeder Schritt hat „Später" (sekundär) — Abbruch ohne Bestätigungsdialog und ohne Datenverlust.
- Fortschritt (Schritt, Freitext, Auswahl) liegt im localStorage (`pp-onboarding-progress`).
- Wiedereinstieg: automatisch bei 0 Tasks; mit vorhandenen Tasks über einen Dashboard-Eintrag
  „Einrichtung fortsetzen". Nach Abschluss wird `pp-onboarding-done` gesetzt, der Eintrag verschwindet.

## Leerzustand mit Beispielaufgaben (AK7)

- Ohne eigene Eingabe (Abbruch oder Abschluss ohne Tasks) zeigt der Dashboard-Leerzustand
  mindestens **drei sicht- und abhakbare Beispielaufgaben**. Sie sind virtuell (kein POST beim
  Anzeigen); erst das Abhaken legt den Task als echten (erledigten) Task an.

## Vertrag: `POST /tasks/parse-suggest` (AK2)

- Request: `{ text: string }` — Validierung wie `parse-text` (`validateText`, max 2000 Zeichen).
- Middlewares wie die Nachbar-Endpunkte: `requirePlanFeature('ai_assist')`, `meterAiQuota()`
  (Deckung läuft über die bestehenden Coverage-Tests).
- Suggester injizierbar (Muster `taskTextParser`), bekommt die Säulen des Nutzers als Stammdaten.
- Response 200: `{ suggestions: Array<{ title: string; pillarId: number; dependsOnTitle?: string }> }`
  mit **5 bis 8** Einträgen; `dependsOnTitle` referenziert den Titel eines anderen Vorschlags.
- Fehlerpfade wie `parse-text` (`sendLlmError`).

## Mobile (AK8)

- Bei 375 px: eine Spalte, alle Schritte voll bedienbar, kein horizontaler Überlauf
  (Bounding-Box-Assertions; App-Shell clippt `overflow-x` — `scrollWidth` am Body ist wirkungslos).

## Erwartetes Ergebnis

Erststart führt durch alle fünf Schritte; übernommene Vorschläge entstehen als echte Tasks mit
Säule und Abhängigkeit im Dashboard; der Leerzustand lädt mit Beispielaufgaben zum Ausprobieren.

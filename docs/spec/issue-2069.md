# Spec: Issue #2069 — Erststart-Flow Schritte 1–3 (Freitext, Vorschläge, Übernehmen)

## Ziel

Nach dem Login ohne eigene Tasks startet statt des bisherigen EmptyState ein 3-Schritt-Flow als
Vollbild-Fläche unter der App-Shell (kein Dialog): **1 Freitext** („Was beschäftigt dich gerade?“)
→ **2 KI-Vorschläge** als an-/abwählbare Karten → **3 Übernehmen** legt die ausgewählten Vorschläge
als echte Aufgaben an. Der Teil-1-Endpunkt `POST /tasks/suggest-initial` (#2068, gemergt) liefert
`{ suggestions: [{ title, pillarId, dependsOn? }] }`; `dependsOn` ist die Position des Vorgängers in
der bereinigten Liste. Servercode entsteht hier nicht mehr — nur die Frontend-Fläche und der
`api.suggestInitialTasks`-Wrapper (Muster `suggestPillars`, `api.ts:802-814`).

## Vorbedingungen

- Eingeloggter Nutzer ohne eigene Tasks (`tasks.length === 0`, aktiver Tab 0); der Flow ersetzt den
  EmptyState an dieser Stelle (`App.tsx:1052-1054`) — der EmptyState bleibt als Zustand nach
  „Später“ bzw. nach Flow-Ende ohne Aufgaben bestehen.
- Mind. eine Säule des Nutzers (Standard: fünf Säulen bei Registrierung) — ohne Säulen antwortet der
  Endpunkt 503; das zeigt der Fehlerzustand.
- Antwortet der Server nach Bereinigung mit weniger als 5 (bis 0) Vorschlägen und 200, zeigt
  Schritt 2, was kam — das ist kein Fehlerfall (offene Frage im Analyse-Block, nicht blockierend).

## Ablauf und erwartetes Ergebnis

Komponente `OnboardingFlow` (Root-Element mit Klasse `onboarding-flow`), drei Schritte mit
Schritt-Anzeige „Schritt X von 3“ (selbst gebaut — der KoliBri-Katalog hat keinen Stepper),
Fokus je Schritt auf der Schritt-Überschrift. Je Schritt genau eine Primäraktion unten und der
sekundäre Ausweg „Später“.

1. **Schritt 1 — Freitext:** eine `KolTextarea` (max. 2000 Zeichen), Primäraktion „Weiter“.
   Leeres Feld: „Weiter“ ruft den Endpunkt **nicht** auf, beendet den Flow ohne Fehlermeldung und
   ohne angelegte Aufgaben (Interim bis Teil 3; siehe offene Frage im Analyse-Block).
2. **Schritt 2 — Vorschläge:** während `api.suggestInitialTasks({ text })` läuft, ein
   Ladezustand mit sprechendem Spinner in einer `aria-live`-Region. Danach 5–8 Vorschlags-Karten als
   `KolInputCheckbox` (kein switch, UX-Beratung #1986), Startzustand: abgewählt. Je Karte: Titel,
   Säulen-Badge (Name der Säule) und bei `dependsOn` der Text „nach: <Titel des Vorgängers>“.
   Karten einzeln an-/abwählbar; Primäraktion „Weiter“.
3. **Schritt 3 — Übernehmen:** Primäraktion „Übernehmen“ legt genau die ausgewählten Vorschläge über
   `api.createTask` (`taskCreate` mit Titel und `pillarIds`) an — der Vorgänger zuerst; für jeden
   Vorschlag mit `dependsOn` verknüpft der Flow Vorgänger und Nachfolger über
   `api.addDependency` (`POST /tasks/{id}/dependencies`, `dependingTaskId` = Vorgänger). Danach
   schließt der Flow, das Dashboard zeigt die neuen Aufgaben.

## Zustände

- **Fehler:** schlägt der Endpunkt fehl (außer Quota/Drossel), zeigt Schritt 2 eine `KolAlert`
  mit `_type="error"` und dem Ausweg „Später“; es erscheinen keine Karten.
- **Quota/Drossel:** bei 403 `plan_required`/429 `ai_throttled` eine eigene, freundliche
  Quota-Meldung nach dem `AiQuotaHint`-Muster (`KolAlert`, `_label="KI-Hilfe etwas langsamer"`),
  ebenfalls mit Ausweg „Später“.
- **„Später“:** beendet jeden Schritt sofort — kein Bestätigungsdialog, keine angelegten Aufgaben
  (Abbruch ohne Datenverlust); die App landet wieder beim EmptyState.

## UX-Verträge (KI-UX-Beratung #1986, bindend)

- KoliBri-First; Vorschlags-Karten als `KolInputCheckbox`, nicht als Switch.
- 375 px: einspaltig, alle drei Schritte voll bedienbar, keine horizontale Verschiebung
  (Bounding-Box-Assertions, die App-Shell clippt `overflow-x`).
- `aria-live` für Ladezustand und Ergebnis; Fokus auf die Schritt-Überschrift beim Übergang.

## Abgrenzung

- Kein serverseitiger Code; `api.ts` erhält nur den `suggestInitialTasks`-Wrapper.
- Teil-3-Bausteine (Startgewichtung, Abschluss-Karte, Beispielaufgaben, Wiedereinstieg) bleiben
  draußen.
- i18n-Schlüssel (u. a. „Weiter“, „Später“, „Übernehmen“, „Schritt X von 3“, „nach: …“) in allen
  10 Sprachen — Teil der Umsetzung.

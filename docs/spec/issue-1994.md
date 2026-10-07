# Spec #1994 — Hinweis zum Aufteilen großer, mehrfach verschobener Aufgaben

Grundlage: PO-Entscheidungen vom 2026-10-05 (KI-ANALYSE im Harness-Kommentar). Der Hinweis ändert die
Bewertung nicht; er ist eine zusätzliche Begründung an der Next-Task-Karte.

## Erkennung (Server, `GET /next`)

- **Voraussetzung:** Der Nutzer hat mindestens 3 offene Aufgaben (Status ungleich Done) mit
  `estimatedEffort >= 0.6` UND `postponeCount >= 2`.
- **Erwartet:** Ist die empfohlene Aufgabe selbst eine davon, enthält die Antwort
  `reasons.split = { postponeCount }` (Zähler dieser Aufgabe). Sonst fehlt `reasons.split`.
- `score`, `scoreBreakdown` und die gewählte Aufgabe bleiben mit und ohne Muster identisch (AK3).
- `reasons.split` entsteht unabhängig davon, ob `toReasons` Score-Anteile liefert.

## Schalter (`GET/PUT /split-hint-config`)

- Default `{ splitHintEnabled: true }`; PUT speichert pro Nutzer, Nicht-Boolean → 400 ohne Persistenz.
- Bei `splitHintEnabled: false` fehlt `reasons.split` auch bei erkanntem Muster.
- Muster: `GET/PUT /care-config` (`User.carePushEnabled`).

## Frontend

- Next-Task-Karte: bei `reasons.split` ein Begründungssatz in `.dashboard-next-task-reasons`
  (am Ende, keine Aktion/Schaltfläche, ohne Zahl und Minuten): „Große Aufgaben lassen sich oft leichter
  angehen, wenn du sie in kleinere Schritte teilst." Ohne `reasons.split` kein Satz.
- Einstellungen: `KolInputCheckbox` (`_variant="switch"`) „Hinweis zum Aufteilen großer Aufgaben" in
  einer `.settings-switch-row`; Zustand aus `api.getSplitHintConfig()`, Umschalten ruft
  `api.updateSplitHintConfig({ splitHintEnabled })`.
- Texte über i18n in allen 10 Sprachen (Schlüsselgleichheit sichert `locales.test.ts`).
- 375 px: Satz vollständig im Viewport (Bounding-Box), Schalter bedienbar.

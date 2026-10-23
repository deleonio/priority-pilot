# #2525 — Säulen & Aufwand einklappen (Spec)

## Ziel

Bei 375 px sind Titel und Speichern ohne Scrollen erreichbar: Säulen-Verteilung und Aufwand
wandern in den zugeklappten Sekundär-Abschnitt („Termin & Ort“); die Priorität bleibt
außerhalb. Fixup-Anpassung (PO-Entscheid im Kreuzverhör zu PR #2577): kein zweiter
`.form-section--secondary` — der bestehende Sekundär-Abschnitt trägt den Inhalt. Ohne
Öffnen gelten die Standardwerte weiter (Gleichverteilung 20 % je Säule, Aufwand 0.5).
Aufwand 0.5).

## Voraussetzungen

- TaskForm im Anlege- oder Bearbeiten-Modus; AK1/AK4/AK6 bei 375×812.
- Speicher-Payload und Validierung bleiben unverändert (#2074-Sicherheitsnetz gilt weiter).
- QuickCapture-, Serie- und Vorlage-Flow nutzen dasselbe Formular und dürfen nicht brechen.

## Verhalten

### Faltung im Sekundär-Abschnitt (AK1–AK3, AK6)

- Der bestehende, kontrollierte Sekundär-Abschnitt (KolAccordion „Termin & Ort“,
  `_level={3}`) trägt den Inhalt; die Basisangaben-Sektion bleibt `_open _disabled`.
- Inhalt: Aufwand-Slider und Säulen-Editor (Rangfolge-Tipp, Vorschlag-Button). Die Priorität
  bleibt in der Basisangaben-Sektion (AK6).
- Erwartet: Speichern-Knopf bei 375×812 ohne Scrollen im Viewport (AK1); nach dem Aufklappen
  lassen sich Rangfolge (Treppe 50/20/15/10/5) und Aufwand wie bisher setzen und speichern (AK3).

### Standardwerte ohne Öffnen (AK2)

- Eine nur mit Titel gespeicherte Aufgabe (Sektion bleibt zu) sendet dieselben Werte wie heute:
  `pillars` = je Säule 20 % (Gleichverteilung über fünf Säulen) und `estimatedEffort` = 0.5.

### Hinweis im zugeklappten Zustand (AK4)

- Im zugeklappten Zustand zeigt der Bereich den Hinweis „Ohne Öffnen gelten die Standardwerte“.
- Platzierung (KI-UX, hier als Spec-Entscheid festgelegt): kurze Hinweiszeile unmittelbar unter
  dem Akkordeon-Kopf, außerhalb des einklappbaren KolAccordion-Body-Slots; der Trigger-Name
  (kein Hinweis im Label). Nur Text, kein KolAlert. Neue i18n-Keys
  in allen Sprachen pflegen.

### Anfangszustand (AK5)

Die Sektion startet offen genau dann, wenn eigene Werte vorliegen:

- Bearbeiten mit Säulen-Verteilung ≠ Gleichverteilung ODER Aufwand ≠ 0.5 → offen.
- Bearbeiten mit Standardwerten (Gleichverteilung + 0.5) → zu.
- Anlegen → zu.
- Vorlage-Flow mit `initialValues.pillars` → gilt als eigene Werte → offen.

Hinweis (KI-UX): bewusste Ausnahme zur #1285-Regel „beim Öffnen immer zugeklappt“; der
#1285-Kommentar in `TaskForm.tsx` wird in der Umsetzung aktualisiert.

## Testfälle

- TF1 (AK1): E2E `frontend/e2e/issue-2525-task-form-fold.spec.ts` — 375×812, „Anlegen“-Knopf
  boundingBox im Viewport.
- TF2 (AK2): Unit `TaskForm.test.tsx` — nur Titel, Sektion zu, Payload Gleichverteilung + 0.5;
  E2E: nur Titel speichern schließt den Dialog.
- TF3 (AK3): Unit — Trigger klappt auf, Rangfolge-Tipp erzeugt die Treppe; E2E: aufklappen,
  Rang setzen, speichern.
- TF4 (AK4): Unit — Hinweistext vorhanden und nicht im einklappbaren Body; E2E: Hinweis im
  zugeklappten Zustand sichtbar.
- TF5 (AK5): Unit — eigene Werte → offen; Standardwerte → zu; Anlegen → zu;
  `initialValues.pillars` → offen.
- AK6: Unit — Prioritäts-Slider liegt nicht im gefalteten Sekundär-Abschnitt; E2E: Priorität ohne
  Aufklappen sichtbar.

## Offene Fragen

- (keine — „eigene Werte“ gemäß Analyse-Block interpretiert; Hinweis-Platzierung als
  Spec-Entscheid auf die Variante „Hinweiszeile unter dem Kopf“ festgelegt, da nur diese
  testbar außerhalb des Body-Slots liegt und den Trigger-Namen stabil hält)

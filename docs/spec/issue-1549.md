# Spec #1549 — Eigener LLM-Provider pro Nutzer: LlmSettings-Frontend (3/3)

Teil 3 der Serie (#1547 CRUD/Eigentum, #1548 Auswahl/Gate): Das Frontend unterscheidet eigene und
instanzweite Provider, wählt eigene Provider über den Selection-Endpunkt aus, und das KI-Gate zählt
nur noch **eigene** Custom-Provider. Quelle: Issue #1549 + KI-ANALYSE/KI-UX-Blöcke im
Harness-Kommentar (Stand 2026-09-18T14:18:34Z).

## Ziel

1. **AK8 — UI:** In `LlmSettings` legt der Nutzer einen eigenen Provider an und wählt ihn aus.
   Eigene und instanzweite Provider sind in der Liste **unterscheidbar** (Text-Marker „eigen“ /
   „instanzweit“, realisiert als `KolBadge` — nie nur Farbe, WCAG 1.4.1; Marker auch im Accessible
   Name der Radio-Option). Bedienbar bei 375 px ohne horizontales Scrollen (Nachweis per
   Bounding-Box: kein Element ragt über den Viewport — die App-Shell clippt `overflow-x: hidden`,
   `scrollWidth` taugt nicht).
2. **AK8a — DTO:** `LlmProvider`-DTO enthält ein boolesches Feld `own`. `GET /llm-providers`
   liefert `own: true` für Zeilen des angemeldeten Nutzers, `own: false` für instanzweite Zeilen
   (`userId = null`) und fremde Zeilen; Built-ins sind immer `own: false`. Abwärtskompatibel: ohne
   Nutzerkontext sind alle Zeilen `own: false`.
3. **AK8b — Gate:** `hasCustomProvider` (Grundlage des KI-Schalters für Free-Nutzer) zählt nur
   **eigene** Provider (`kind === 'custom' && own: true`). Free-Nutzer mit nur instanzweiten
   Customs bekommt den Schalter **nicht** (der Server liefert dort 403 `plan_required`, Spec
   #1548 AK7 — Frontend darf das Gate nicht weiter fassen als der Server).

## Anbieterrollen im Detail

| Rolle                                  | `kind`    | `own`   | Marker        |
| -------------------------------------- | --------- | ------- | ------------- |
| Mistral/OpenRouter                     | `builtin` | `false` | „instanzweit“ |
| Instanzweiter Custom (`userId = null`) | `custom`  | `false` | „instanzweit“ |
| Eigener Custom                         | `custom`  | `true`  | „eigen“       |

## Testfälle (rote Spec-Tests)

| AK   | Ebene | Datei                                            | Inhalt                                                                                                                                                                                                                                                                    |
| ---- | ----- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AK8  | e2e   | `frontend/e2e/llm-settings.spec.ts`              | Eigener Provider trägt „eigen“-Marker in Radio-Option UND Verwaltungsliste; Built-ins tragen „instanzweit“; 375-px-Bounding-Box-Assertion. Anlegen+Radio-Aktivierung ist bereits durch den Bestandstest „Custom-Provider anlegen … per Radio aktivieren“ gedeckt (Dedup). |
| AK8a | API   | `server/src/express/routes/llmProviders.test.ts` | Angemeldeter Nutzer mit eigenem + instanzweitem Custom: `own` je Zeile korrekt; fremde Zeile `own: false`; Built-ins `own: false`.                                                                                                                                        |
| AK8b | Unit  | `frontend/src/lib/aiPreferences.test.ts`         | `hasOwnCustomProvider` (neuer Export): nur `kind === 'custom' && own === true` zählt; Kombination mit `computeAiFeaturesEnabled` → Free + nur instanzweite Customs = aus.                                                                                                 |

## Randbedingungen

- `apiKey` bleibt write-only (kein Schlüssel je zurückgeliefert oder angezeigt).
- Bestehende instanzweite Ansicht/Aktivierung darf nicht brechen.
- UX (advisory): Free-Nutzern instanzweite Customs **anzeigen + ausgrauen** statt ausblenden
  (empfohlen, nicht verankert); Sofort-Persistieren ohne Speichern-Button bleibt.

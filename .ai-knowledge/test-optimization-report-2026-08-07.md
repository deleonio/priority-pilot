# Test-Optimierung Report — 2026-08-07

> Generiert von `.github/workflows/test-optimization.yml` (TDD-Strategie v3, Stufen 1–3)

---

## 1. Zusammenfassung

| Metrik                               | Wert   |
| ------------------------------------ | ------ |
| Unit-Tests gesamt                    | 0      |
| Unit-Tests fehlgeschlagen            | 0      |
| E2E-Tests (Shard 1/4)                | 0      |
| E2E-Tests fehlgeschlagen             | 0      |
| **Tautologische Tests (Kandidaten)** | **0**  |
| **Redundante Tests**                 | **13** |
| **Fehlende Empty-Set-Probes**        | **0**  |
| **Fehlende Mutation-Probes**         | **0**  |
| **Kritische Findings**               | **0**  |
| Warnungen                            | 13     |
| Infos                                | 0      |

---

## 2. Tautologische Tests (Implementation Detail vs. Behavior)

_Tests, die prüfen **wie** etwas implementiert ist, nicht **dass** es funktioniert._

(keine gefunden)

## 3. Redundanzen (Mehrere Tests, gleiche Invariante)

_Mehrere Formulierungen derselben Anforderung — nur die stärkste (AK) behalten._

| Invariante                                                        | Betroffene Tests                                                                                                                   | Stärkster Test (behalten) | Entfernen                                                                | Severity |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------ | -------- |
| 375px no-overflow Test — Pattern existiert in 21+ Specs identisch | frontend/e2e/delete-dialog-focus.spec.ts::AK7 — Mobile-First 375px: Lösch-Dialog ohne horizontales Scrollen                        | (manuell prüfen)          | Zentrale Helper-Funktion nutzen oder nur 1 repräsentativen Test behalten | warning  |
| 375px no-overflow Test — Pattern existiert in 21+ Specs identisch | frontend/e2e/dependency-editor.spec.ts::AK4: Kein horizontaler Overflow auf 375-px-Viewport, Icon-Button erreichbar                | (manuell prüfen)          | Zentrale Helper-Funktion nutzen oder nur 1 repräsentativen Test behalten | warning  |
| 375px no-overflow Test — Pattern existiert in 21+ Specs identisch | frontend/e2e/help.spec.ts::AK4: Hilfe-Seite auf 375 px erzeugt kein horizontales Scrollen                                          | (manuell prüfen)          | Zentrale Helper-Funktion nutzen oder nur 1 repräsentativen Test behalten | warning  |
| 375px no-overflow Test — Pattern existiert in 21+ Specs identisch | frontend/e2e/input-range-fields.spec.ts::AK5: Kein horizontaler Overflow im Task-Formular auf 375-px-Viewport                      | (manuell prüfen)          | Zentrale Helper-Funktion nutzen oder nur 1 repräsentativen Test behalten | warning  |
| 375px no-overflow Test — Pattern existiert in 21+ Specs identisch | frontend/e2e/keyboard-shortcuts.spec.ts::AK5: auf 375-px-Viewport löst der Shortcut aus, ohne horizontales Scrollen / Layout-Bruch | (manuell prüfen)          | Zentrale Helper-Funktion nutzen oder nur 1 repräsentativen Test behalten | warning  |
| 375px no-overflow Test — Pattern existiert in 21+ Specs identisch | frontend/e2e/pillar-crud.spec.ts::AK4: Mobile-First — kein horizontales Scrollen bei 375 px mit vielen Säulen                      | (manuell prüfen)          | Zentrale Helper-Funktion nutzen oder nur 1 repräsentativen Test behalten | warning  |
| 375px no-overflow Test — Pattern existiert in 21+ Specs identisch | frontend/e2e/pillar-dynamic-cases.spec.ts::AK4: Mobile-First — kein horizontales Scrollen bei 375×812 mit vielen Säulen            | (manuell prüfen)          | Zentrale Helper-Funktion nutzen oder nur 1 repräsentativen Test behalten | warning  |
| 375px no-overflow Test — Pattern existiert in 21+ Specs identisch | frontend/e2e/push-test-button.spec.ts::AK5: /settings/general erzeugt bei 375 px kein horizontales Scrollen                        | (manuell prüfen)          | Zentrale Helper-Funktion nutzen oder nur 1 repräsentativen Test behalten | warning  |
| 375px no-overflow Test — Pattern existiert in 21+ Specs identisch | frontend/e2e/quick-capture.spec.ts::AK-Mobile: Quick-Capture-Schritt ist auf 375-px-Viewport bedienbar                             | (manuell prüfen)          | Zentrale Helper-Funktion nutzen oder nur 1 repräsentativen Test behalten | warning  |
| 375px no-overflow Test — Pattern existiert in 21+ Specs identisch | frontend/e2e/series-in-taskform.spec.ts::AK7 — Serie-Dialog ohne horizontales Scrollen auf 375px Viewport (Mobile-First)           | (manuell prüfen)          | Zentrale Helper-Funktion nutzen oder nur 1 repräsentativen Test behalten | warning  |
| 375px no-overflow Test — Pattern existiert in 21+ Specs identisch | frontend/e2e/series-rhythm.spec.ts::AK4 — Serien-Formular ohne horizontales Scrollen auf 375px Viewport                            | (manuell prüfen)          | Zentrale Helper-Funktion nutzen oder nur 1 repräsentativen Test behalten | warning  |
| 375px no-overflow Test — Pattern existiert in 21+ Specs identisch | frontend/e2e/series.spec.ts::AK5 (#330) — SeriesManagementModal auf 375px ohne Anlegen-Button und ohne horizontales Scrollen       | (manuell prüfen)          | Zentrale Helper-Funktion nutzen oder nur 1 repräsentativen Test behalten | warning  |
| 375px no-overflow Test — Pattern existiert in 21+ Specs identisch | frontend/e2e/settings-page.spec.ts::AK6: /settings/general auf 375 px – kein horizontales Scrollen, Allgemein-Tab aktiv            | (manuell prüfen)          | Zentrale Helper-Funktion nutzen oder nur 1 repräsentativen Test behalten | warning  |

## 4. Fehlende Empty-Set-Probes (All-Quantoren)

_All-Quantor ohne Prüfung, dass die Menge nicht leer ist — Test geht grün, prüft aber nichts._

(keine gefunden)

## 5. Fehlende Mutation-Probes (Behavior nicht wirklich geprüft)

_Test geht grün, würde aber bei absichtlicher Verhaltens-Änderung NICHT rot._

(keine gefunden)

## 6. Konkrete PR-Empfehlungen

(keine kritischen Findings — Test-Suite gesund)

## 7. Nächste Schritte

- [ ] Report prüfen
- [ ] Top-5 Entfernungs-Kandidaten als PR umsetzen
- [ ] Fehlende Probes nachrüsten

---

_Report generiert am 2026-08-07T03:18:55.271Z_

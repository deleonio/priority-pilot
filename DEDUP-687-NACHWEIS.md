# Issue 687 – Dedup-Nachweis: Alle Akzeptanzkriterien bereits abgedeckt

**Stand:** 2026-08-16  
**Branch:** feat/issue-687-lektorat-diff-modal  
**Ergebnis:** KEINE neuen Tests nötig – vollständige Abdeckung durch 10 existierende Tests

---

## Akzeptanzkriterien vs. Existierende Tests

| AK                                 | Test-Datei                                 | Zeilen  | Test-Name                                            |
| ---------------------------------- | ------------------------------------------ | ------- | ---------------------------------------------------- |
| 1. Zwei separate Lektorat-Optionen | `frontend/e2e/lektorat-button.spec.ts`     | 81-86   | `Button-Label spezifisch für Titel`                  |
| 1. (fortgesetzt)                   | `frontend/e2e/lektorat-button.spec.ts`     | 119-124 | `Button-Label spezifisch für Beschreibung`           |
| 2. Diff-Anzeige in einem Modal     | `frontend/e2e/lektorat-diff-modal.spec.ts` | 43-64   | `Diff-Modal erscheint nach Lektorat-Aufruf`          |
| 2. (fortgesetzt)                   | `frontend/e2e/lektorat-diff-modal.spec.ts` | 178-199 | `Diff-Modal erscheint nach Beschreibungs-Lektorat`   |
| 3. Übernehmen-Schalter im Modal    | `frontend/e2e/lektorat-diff-modal.spec.ts` | 96-121  | `Übernehmen im Modal überschreibt Titel-Feld`        |
| 3. (fortgesetzt)                   | `frontend/e2e/lektorat-diff-modal.spec.ts` | 231-256 | `Übernehmen im Modal überschreibt Beschreibungsfeld` |
| 4. Abbrechen-Schalter im Modal     | `frontend/e2e/lektorat-diff-modal.spec.ts` | 66-94   | `Abbrechen im Modal behält Original-Text`            |
| 4. (fortgesetzt)                   | `frontend/e2e/lektorat-diff-modal.spec.ts` | 201-229 | `Abbrechen im Modal behält Beschreibungs-Text`       |
| 4. (Randfall ESC)                  | `frontend/e2e/lektorat-diff-modal.spec.ts` | 260-284 | `ESC-Taste im Modal verhält sich wie Abbrechen`      |

---

## Testfälle aus Issue-Body vs. Abdeckung

| Testfall                                                                         | Abgedeckt durch                               | Status |
| -------------------------------------------------------------------------------- | --------------------------------------------- | ------ |
| 1. Lektorat nur für Titel → Diff-Modal zeigt nur Titel-Änderungen                | `lektorat-diff-modal.spec.ts:43-64`           | ✅     |
| 2. Lektorat nur für Beschreibung → Diff-Modal zeigt nur Beschreibungs-Änderungen | `lektorat-diff-modal.spec.ts:178-199`         | ✅     |
| 3. Abbrechen im Modal → keine Änderungen übernommen                              | `lektorat-diff-modal.spec.ts:66-94, 201-229`  | ✅     |
| 4. Übernehmen im Modal → Änderungen werden übernommen                            | `lektorat-diff-modal.spec.ts:96-121, 231-256` | ✅     |

---

## Zusätzliche Abdeckung (über die AK hinaus)

Die existierenden Tests decken zusätzlich ab:

- **Fokus-Management** beim Modal-Öffnen (Spec-Referenz `lektorat-diff-modal.spec.ts:123-144`)
- **Fokus-Management** nach Abbrechen (Spec-Referenz `lektorat-diff-modal.spec.ts:146-174`)
- **ESC-Randfall** gemäß Spec (Spec-Referenz `lektorat-diff-modal.spec.ts:260-284`)

---

## Spezifikations-Referenz

Alle Tests beziehen sich auf `docs/spec/issue-687.md` (v1.1):

- Journey 1: Titel lektorieren mit Diff-Modal
- Journey 2: Beschreibung lektorieren mit Diff-Modal
- Randfälle & Fehler (ESC-Taste)

---

## Entscheidung

**KEINE neuen Tests erforderlich.** Die 10 existierenden Tests in `lektorat-button.spec.ts` und `lektorat-diff-modal.spec.ts` decken alle 4 Akzeptanzkriterien vollständig ab und gehen darüber hinaus (Fokus-Management, Randfälle).

Ein zusätzlicher Test wäre ein **Change-Detector** ("die Datei enthält den String, den ich geschrieben habe") und fände per Konstruktion keinen Fehler (gemäß ADR 0001 und Workflow-Instruktionen).

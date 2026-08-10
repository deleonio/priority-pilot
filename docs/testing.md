# Testkonzept für Priority Pilot

Dieses Dokument legt fest, **welche** Tests in Priority Pilot geschrieben und gepflegt werden
und welche bewusst **nicht** getestet werden. Ziel: ein effizientes, klare Richtlinien folgendes
Vorgehen — so viele Tests wie nötig, so wenige wie möglich.

## 1. Test-Stack

| Ebene      | Framework      | Zweck                                                                                                                                                  |
| ---------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit-Tests | **Vitest**     | Fachliche Berechnungen, Sortierlogik und Geschäftslogik (native TS/ESM-Unterstützung, integriertes Mocking/Coverage, Parallelisierung out-of-the-box). |
| E2E-Tests  | **Playwright** | Happy-Path-Use-Cases durch die PWA im echten Browser.                                                                                                  |

## 2. Unit-Tests (Vitest) — Core-Logik

Alle fachlichen Berechnungen, Sortierlogiken und Geschäftslogik werden mit Unit-Tests abgedeckt.
Die Core-Logik-Module sind Unit-Test-Pflicht und bereits implementiert:

- `value.ts` — Wertberechnung (Standard-/Grenz-/Nullwerte, deterministische Priorisierung)
- `tree.ts` — Aufgabenwald-Berechnung (lineare, verzweigte und zirkuläre Strukturen)
- `find.ts` — Nächste-Aufgabe-Logik (leerer Wald, mehrere Kandidaten, blockierte Abhängigkeiten)
- `cycle.ts` — Zyklus-Erkennung (direkter/indirekter Ring erkannt, kein False-Positive bei gültigem DAG)

Die zugehörigen Testdateien liegen unter `server/src/logics/*.test.ts`.

## 3. Test-Scope (Scope C: Core-Logik + API-Layer + UI-Helfer)

Neben der Core-Logik werden zusätzlich der **API-Layer** und **UI-Helfer** bzw. Frontend-Logik getestet:

- **API-Layer** (`server/src/express/*.test.ts`): Endpunkt-Verhalten für zentrale Use Cases.
- **UI-Helfer / Frontend-Logik** (`frontend/src/lib/*.test.ts`): reine Helfer und Geschäftslogik im Frontend.

Komponenten-Rendering wird nicht isoliert getestet, sondern über die E2E-Happy-Paths abgedeckt.

## 4. E2E-Tests (Playwright) — Happy-Path-Use-Cases

Die E2E-Tests (`frontend/e2e/*.spec.ts`) decken die zentralen Use-Cases als Happy-Path ab:

- **Aufgabe anlegen**
- **Aufgabe bearbeiten** (ändern)
- **Aufgabe löschen**
- **Abhängigkeit hinzufügen/entfernen** (Vorgänger / Dependency-Editor)

## 5. Bewusste Ausnahme: Gitter-Workflows

**Gitter-Workflows** (GitHub-Actions-/Pipeline-Workflows) werden **nicht explizit getestet**.
Begründung: Workflows funktionieren entweder oder nicht — eine manuelle Überprüfung ist ausreichend.

## 6. Coverage-Ziel

- **Ziel:** mindestens **66 %** (2/3) Code-Coverage, gemessen via Vitest/Istanbul-Report.
- **Prinzip:** So viele Tests wie nötig, so wenige wie möglich. Fokus auf kritische Pfade und komplexe Logik.

## 7. CI-Einbindung

Die Tests laufen **grün in der CI-Pipeline** und erstellen dabei einen **Coverage-Report**, der
ausgewertet wird. Bei Unterschreitung des Coverage-Ziels schlägt die CI fehl. E2E-Tests werden
in der CI gegen eine laufende App-Instanz ausgeführt.

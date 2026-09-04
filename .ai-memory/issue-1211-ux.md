# Issue 1211 — UX-Beratung (Phase 2), Stand 2026-09-04

**ERGEBNIS: VERDICT ux-ready.** KI-UX-Block in den Harness-Marker-Kommentar (`IC_kwDONloM188AAAABSeiUWw`) geschrieben — zwischen KI-ANALYSE (unverändert byte-for-byte) und ai-phase-routing-Tabelle. Keine offenen UX-Fragen (Analyse war 🟢, Issue präzise). Keine Labels geändert, kein Ping-Kommentar, Issue-Body unangetastet.

## Erledigt
- SKILL.md gelesen, Issue-Body + Harness-Kommentar (KI-ANALYSE stand=2026-09-04T02:47:00Z, Ampel 🟢, ux=ja) geladen; kein KI-UX-Block vorhanden → Erstlauf.
- Regelquellen statisch geprüft: `.ai-knowledge/ux-design.md`, `docs/mobile-ui-rules.md`, `docs/ux-pattern-sequential-confirmation.md`.
- Settings-Struktur verifiziert: `frontend/src/components/SettingsPage.tsx:34` (`SETTINGS_TABS`, `KolTabs` :243, bestehende Modals :364), `frontend/src/App.tsx:63,128,355` (`SETTINGS_PATH_SEGMENTS` = ['general','pillars','llm','standort'] — `gruppen` muss ergänzt werden).
- KI-UX-Block (Deutsch, alle 6 Abschnitte, keine offenen Fragen) via GraphQL `updateIssueComment` geschrieben; Landing verifiziert: alle 6 Marker (ANALYSE/UX/routing × START/END) genau 1×.

## Relevante Stellen
- `frontend/src/components/SettingsPage.tsx:34,243,364` — KolTabs + Modal-Muster für den neuen Tab.
- `frontend/src/App.tsx:63,355` — Segment-Liste + Navigation-Pflege.
- `docs/ux-pattern-sequential-confirmation.md` — AK7-Pattern; Scope-Schritt 2 hier „inkl. Mitglieder-Einträge", ab Ticket 3 (#952) um Gruppen-Aufgaben erweiterbar.
- `DeleteTaskDialog.tsx` / `PillarDeleteDialog.tsx` — Vorbilder sequenzielle Bestätigung + Fokus-Management.
- `components/Modal.tsx` — Dialog-Basis; Fokus-/Esc-Verhalten in Impl verifizieren.

## Annahmen
- Gruppenliste als Karten/Listen-Elemente (keine Tabelle) entspricht Regel 3 — im KI-UX-Block so empfohlen.
- `KolTextarea` für Beschreibung verfügbar (nicht per MCP verifiziert — Zeitbudget; Impl ggf. über KoliBri-MCP prüfen).

## Verworfen
- KoliBri-MCP-Abfrage — Komponentenwahl folgt eindeutig aus ux-design.md-Tabelle; keine Unsicherheit, die recherchewürdig war.
- Browser/Playwright-Inspektion — per Prompt verboten (statisch).

## Offen
- Wegwerf-Artefakte in `.ai-memory/` NICHT committen: `issue-1211-harness.md`, `issue-1211-ux-block.md`, `issue-1211-harness-new.md`, `issue-1211-mutation.graphql`. Nur diese Datei hier ist die Phasen-Notiz.

## Nächster Schritt
- Spec-Phase (Label `ai:needs-ux-ui` → `ai:needs-spec` durch Workflow): rote Tests für AK1–AK9 laut Analyse-Testfälle (API-Tests, Dataisolation, e2e inkl. 375px Bounding-Box).

## Fallstricke
- GraphQL-Mutation mit Braces: Sandbox lehnt Command-Substitution/Brace-Expansion ab → Query in Datei auslagern und mit `-F query=@datei.graphql` lesen (`-f` expandiert @ NICHT, nur `-F`).
- AK8: Bounding-Box-Assertions statt scrollWidth (App-Shell clippt overflow-x:hidden) — steht schon im Analyse-Testfall.
- Rolle nie nur farblich (WCAG 1.4.1) — KolBadge mit Text.
- `SETTINGS_PATH_SEGMENTS` und `SETTINGS_TABS` müssen synchron wachsen, sonst Tab-Routing kaputt (App.tsx:128 indexOf-Fallback).

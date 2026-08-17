# Issue 733: UX-Beratung als Phase 2b

**Stand:** 2026-08-17

## Ziel

UX-Beratung als automatisierte Phase nach Spec-Ready einrichten – beratend, nicht blockierend.

## Vorbedingungen

- Issue ist mit `ai:spec-ready` gelabelt
- Spec-Phase abgeschlossen (rote Tests vorhanden)

## Schritte

### 1. Workflow-Trigger

- Label `ai:spec-ready` wird gesetzt → GitHub Action `02b-claude-ux.yml` triggert
- Alternativ: manueller Start via `workflow_dispatch`

### 2. UX-Analyse

- KI führt Prompt `.github/prompts/ux.md` aus
- Schreibt Ergebnis zwischen `<!-- KI-UX:START -->` und `<!-- KI-UX:END -->` in Issue-Body
- Abschnitte: Interaktion, Mobile-First, A11y/BITV, KoliBri, Offene UX-Fragen

### 3. Verifikation & Label

- Workflow prüft Verdict-Line im Output
- Bei `VERDICT: ux-ready` → Label `ux:ready` setzen via GitHub App-Token
- Bei Verifikationsfehlern → Label `ux:failed` setzen

## Erwartetes Ergebnis

- Datei `.github/workflows/02b-claude-ux.yml` existiert mit Trigger `ai:spec-ready` + `workflow_dispatch`
- Datei `.github/prompts/ux.md` existiert mit UX-Berater-Rolle (nicht blockierend, kein Code-Ändern)
- Datei `.ai-knowledge/ticket-ux.md` existiert mit Phasen-Doku
- Nach Lauf: Issue-Body enthält KI-UX-Block, Label `ux:ready` gesetzt

---

## Versionierung

- **v1.0** (2026-08-16): Initialefassung für Issue #733. UX-Beratung als Phase 2b spezifiziert.
- **v1.1** (2026-08-17): Nightly-Sync — Ist-Stand-Korrektur. Feature ist bereits implementiert: 02b-claude-ux.yml existiert mit Trigger, ux.md Prompt vorhanden, ticket-ux.md Wissensbasis vorhanden.

---

## Status

**ABGESCHLOSSEN** — UX-Beratung als Phase 2b ist implementiert und in Produktion.

## Testableitung

- TF1: Workflow-Check – Datei existiert mit korrektem Trigger — **entfallen** (Change-Detector für `.github/*`, verboten per ADR 0001)
- TF2: Prompt-Check – ux.md enthält NICHT "Branch", "PR", "Code-Ändern" — **entfallen** (Markdown-Inhalt-Test, verboten per ADR 0001)
- TF3: Wissensbasis-Check – ticket-ux.md dokumentiert Phase/Trigger/Output/Modell — **entfallen** (Markdown-Inhalt-Test, verboten per ADR 0001)
- TF4: Integrationstest (e2e) – Workflow-Lauf setzt Label bei korrektem Verdict — **entfallen** (Label-/Verdict-State-Machine eines Workflows ist Untested-Scope per ADR 0001; zusätzlich technisch untestbar: Playwright-`request` löst relative URLs gegen `localhost:4173` auf, erreicht api.github.com nie, und ein Test, der echte Production-Workflows dispatcht, wäre ein Live-Side-Effekt)

**Verifikation stattdessen:** durch den echten Pipeline-Lauf selbst (manueller `workflow_dispatch` + Sichtprüfung von KI-UX-Block und `ux:ready`-Label) — so wie es ADR 0001 („Fehler fallen ohnehin laut auf") vorsieht.

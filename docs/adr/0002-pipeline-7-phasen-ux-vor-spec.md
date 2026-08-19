# ADR 0002 -- Pipeline auf 7 sequenzielle Phasen umgestellt (UX vor Spec)

- **Status:** Accepted; Phasenkette bedingt gemacht (2026-08-19, [ADR 0004](0004-analyse-getriebenes-routing.md) — UX und Spec sind formell optional, die Analyse routet je Subtask; die Serialisierungs-Begründung unten bleibt unberührt)
- **Datum:** 2026-08-17
- **Entscheidungsquelle:** Umbau der Label-getriebenen KI-Pipeline (Architect-Direktive)

## Kontext

Die UX-Beratung (Phase 2b, Workflow `02b-claude-ux.yml`) lief parallel zur Spec-Phase auf
demselben Label (`ai:spec-ready`). Beide Phasen triggerten unabhaengig auf denselben Event --
ein Rennen- und Stall-Risiko: UX konnte nach Spec starten (Spezifikation ohne UX-Input) oder
gleichzeitig laufen (Label-Konflikte, ux:ready vs. ai:spec-ready-Race). Die Spec-Phase
konsumierte `ai:spec-ready`; UX entfernte es ebenfalls -- inkonsistentes Verhalten.

## Entscheidung

**Strikt sequenzielle 7-Phasen-Kette** mit der UX-Beratung als Phase 2 VOR der Spec (Phase 3):

1. Analyse (01) -- 2. UX-Beratung (02, OPTIONAL) -- 3. Spec (03) -- 4. Umsetzung (04) --
2. Review (05) -- 6. Fixup (06) -- 7. Dokumentation (07).

Die Triage (Phase 1) entscheidet per UI-Bezug-Feld im Analyse-Block, ob UX noetig ist:

- **UI-Bezug: ja** -- nur `ai:spec-ready` setzen, UX-Phase laeuft, setzt `ux:ready`.
- **UI-Bezug: nein** -- `ai:spec-ready` + `ux:ready` sofort setzen, UX-Phase wird No-op
  (Pre-Check: ux:ready bereits vorhanden).

Trigger-Drehung: Spec triggert jetzt auf `ux:ready` (statt `ai:spec-ready`). `ai:spec-ready`
bleibt am Issue kleben und wird von der Spec-Phase konsumiert. `ux:ready` bleibt nach Spec
erfolgreich kleben -- die Umsetzung verlangt es als Pre-Check.

## Begründung

- **Serialisierung eliminates Races:** UX laeuft garantiert vor Spec. Kein gleichzeitiger
  Zugriff auf denselben Issue-Body, kein Label-Interference.
- **UX ist beratend, kein Gate:** Bei Nicht-UI-Tickets wird UX uebersprungen (Triage setzt
  ux:ready sofort). Bei UI-Tickets ist UX ein optionaler Mehrwert vor der Spezifikation.
- **Selbst-Retry erhalten:** Bei Partial-Spec (keine Tests) entfernt die Spec ux:ready und
  setzt es sofort wieder (nach ai:spec-ready). Das ux:ready-labeled-Event retriggert die Spec;
  UX bleibt No-op (ux:ready ist beim Pre-Check-Zeitpunkt wieder da).
- **Remove-vor-add-Prinzip:** Alle Label-Post-Assertions entfernen Labels vor dem erneuten
  Setzen (idempotent, Event-Race-Sicherheit).

## Konsequenzen

- **Verzoegerung fuer UI-Tickets:** Die Serialisierung verlangsamt UI-Tickets bewusst um
  einen UX-Lauf (~5-10 min). Das ist der Preis fuer Race-Freiheit.
- **Workflow-Name-Kopplung:** Das workflow_run-Allowlist in `claude-pr-gate-merge.yml` matcht
  den Workflow-Namen exakt (`"5/7 Review"`). Ein vergessener Rename schaltet das Gate lautlos
  ab (ADR 0001: kein Test vorhanden). Alle Vorkommen muessen synchron mitgefuehrt werden.
- **Datei-Umbenennungen:** Alle 7 Phasen-Workflows wurden auf die neue Nummerierung umbenannt
  (01..07). Referenzen in Verdrahtungs-Workflows, Scripts, Actions, Docs und Knowledge-Base
  wurden aktualisiert.
- **workflow_run liest nur vom Default-Branch:** Die neuen Workflow-Namen koennen auf dem
  eigenen PR nicht live getestet werden -- erst nach Merge in main.

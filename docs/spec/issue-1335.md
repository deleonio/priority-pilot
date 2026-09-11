# Schnellerfassung und Berater verschmelzen

**Stand:** 2026-09-11

## Ziel

Der Anlege-Einstieg für Tasks ist heute auf zwei Wege verteilt: den Toolbar-Button „Neuen Task anlegen" (Schnellerfassung, [`QuickCaptureModal`](../../frontend/src/components/QuickCaptureModal.tsx)) und den eigenständigen Toolbar-Button „Säulen-Berater" ([`PillarAdvisorModal`](../../frontend/src/components/PillarAdvisorModal.tsx)), der Vorschläge liefert und diese — über einen Dialog-Wechsel — an die Schnellerfassung übergibt (#327). Dieses Ticket verschmilzt beide Wege zu einem Dialog: „Neuen Task anlegen" ist der einzige Einstieg; im Dialog stehen „Verarbeiten und weiter", „Beraten lassen" und „Überspringen" nebeneinander zur Verfügung.

## Verhalten

- Bei aktiver KI (`pp-ai-enabled = true`) öffnet „Neuen Task anlegen" einen Dialog mit einem Freitextfeld und drei Aktionen:
  - **„Verarbeiten und weiter"** — schickt den Text an `POST /tasks/parse-text` und führt ins vorbelegte Task-Formular (unverändert gegenüber der heutigen Schnellerfassung).
  - **„Beraten lassen"** — schickt den Text (optional) und die aktuelle Säulen-Verteilung an `POST /pillars/advisor`; die Vorschlagsliste (`AdvisorResults`) erscheint **im selben Dialog**, ohne dass sich der Dialog schließt oder ein zweiter Dialog öffnet.
  - **„Überspringen"** — öffnet das leere Task-Formular ohne LLM-Aufruf (unverändert).
- Ein Klick auf „Als Aufgabe übernehmen" an einem Berater-Vorschlag schließt den Dialog nicht: Der Aktivitätstext ersetzt den Inhalt des Freitextfelds desselben Dialogs. Von dort führt „Verarbeiten und weiter" ins vorbelegte Formular — wie bei jedem anderen Freitext auch.
- Strg/Cmd+Enter löst ausschließlich den primären CTA „Verarbeiten und weiter" aus (ein einziger `useCtrlEnter`-Hook im Dialog) — nicht bei leerem Textfeld, nicht während eines laufenden Parsings.
- Spracheingabe (Mikrofon) bleibt am gemeinsamen Textfeld erhalten (Transkript wird angehängt).
- Fehler beider Endpunkte (HTTP 502 von `parse-text` bzw. `advisor`) werden im Dialog per `KolAlert` gemeldet; der Dialog bleibt offen und erneut bedienbar.
- Bei deaktivierter KI (`pp-ai-enabled = false`) öffnet „Neuen Task anlegen" direkt das normale Task-Formular — kein Freitext-Einstieg, kein „Beraten lassen".
- Der Toolbar-Button „Säulen-Berater" entfällt ersatzlos: Bei aktiver KI zeigt die Kopf-Aktionen-Toolbar nur noch „Suche", „Neuen Task anlegen", „Einstellungen", „Hilfe", „Abmelden".
- Im Einstellungen-Tab „KI-Provider" bleibt genau ein Schalter „KI-Features aktiv" (Details zur Vereinfachung von zwei auf einen Schalter: [issue-1080.md](issue-1080.md)).
- Server-Endpunkte (`POST /tasks/parse-text`, `POST /pillars/advisor`) und ihre Verträge bleiben unverändert — reine Frontend-Zusammenlegung.

## Randbedingungen

- Ein-Dialog-Invariante aus #236: Der Dialog bleibt über den ganzen Flow (Capture ↔ Formular ↔ Berater-Ergebnisse) dieselbe `Modal`/`KolDialog`-Instanz — kein Remount, kein zweites `showModal()`.
- Die Säulen-Verteilung (`advisorDistribution`), die der Berater bisher erhielt, wird weiterhin an den verschmolzenen Dialog durchgereicht.

## Akzeptanzkriterien (Kurzreferenz)

Siehe Harness-Kommentar zu #1335 für die vollständige, verbindliche Formulierung (AK1–AK9). Kurzfassung:

1. Kein Toolbar-Button „Säulen-Berater" mehr.
2. „Verarbeiten und weiter" und „Beraten lassen" im selben Dialog; „Beraten lassen" zeigt die Vorschlagsliste ohne Dialogwechsel.
3. Vorschlagsübernahme landet im Textfeld desselben Dialogs, schließt ihn nicht.
4. Einstellungen: genau ein Schalter „KI-Features aktiv"; `pp-quick-capture-enabled` wird nicht mehr gelesen/geschrieben.
5. KI aus → „Neuen Task anlegen" öffnet direkt das Formular.
6. Spracheingabe und Strg/Cmd+Enter (nur „Verarbeiten und weiter") funktionieren im verschmolzenen Dialog.
7. 375px: Textfeld, alle Wege und die Vorschlagsliste bleiben innerhalb des Viewports.
8. Fehler beider Endpunkte werden verständlich gemeldet, Dialog bleibt bedienbar.
9. „Überspringen" bleibt unverändert (leeres Formular ohne LLM-Aufruf).

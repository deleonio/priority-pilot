---
target: dashboard
total_score: 29
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 2
target_identity: 'file:/Users/moppitz/Workspace/priority-pilot/frontend/src/components/Dashboard.tsx'
target_fingerprint: 'sha256:e5827e599a58dfb41d72345b6946aa43567c195f8113692a00272da3f61e2146'
target_path: /Users/moppitz/Workspace/priority-pilot/frontend/src/components/Dashboard.tsx
timestamp: 2026-09-06T09-29-33Z
slug: src-components-dashboard-tsx
---

# Critique: Dashboard (src/components/Dashboard.tsx + Herz-Cluster)

Method: degraded — single-context (Subagent-Tool vorhanden, aber nicht funktionsfähig: Standalone-pi-Binary ohne pi-server-Abhängigkeiten; 3 Same-Protocol-Retries failed). Assessment A (Design-Review) vor B (Detector) im selben Kontext, Reihenfolge gewahrt.

## Design Health Score

| #         | Heuristik                       | Score     | Key Issue                                                                                                             |
| --------- | ------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------- |
| 1         | Visibility of System Status     | 3         | Nearby hat gestaltete Ladezustände; die Dashboard-Daten selbst kommen ohne Skeleton/Loading-Moment                    |
| 2         | Match System / Real World       | 4         | Deutsch, Du-Form, Wasser-Herz-Metapher, Klartext-Zustände                                                             |
| 3         | User Control and Freedom        | 2         | Listen-Einträge (Vorschläge, Top-Tasks, Deadlines, Nearby) sind nicht antippbar — Handeln nur über Umweg Aufgaben-Tab |
| 4         | Consistency and Standards       | 3         | KoliBri durchgängig; aber hardcodierte Urgency-Farben, Region-Semantik nur auf 3 von 8 Karten                         |
| 5         | Error Prevention                | 3         | Destruktives dialogbestätigt (sequenzielle Bestätigung), Geo startet erst nach Freigabe                               |
| 6         | Recognition Rather Than Recall  | 3         | Alles sichtbar/gelabelt; „Was ist jetzt dran?" vs. „Wichtigste Tasks" verlangen die Unterscheidung aus dem Gedächtnis |
| 7         | Flexibility and Efficiency      | 2         | Keine Tastaturkürzel, kein Bulk, keine Schnellaktionen in den Listen                                                  |
| 8         | Aesthetic and Minimalist Design | 3         | Herz zielgerichtet; Stat-Kacheln + drei Säulen-Sichten sind Redundanz-Rauschen                                        |
| 9         | Error Recovery                  | 3         | Nearby degradiert gestaltet (4 Zustände), Config-Fallback ohne falsche Zahlen                                         |
| 10        | Help and Documentation          | 3         | Inline-Hints (Herz-Hint, Empty-States mit Handlungsaufforderung)                                                      |
| **Total** |                                 | **29/40** | **Gut (28–35) — solide Basis, Schwächen in Handlungsmächtigkeit und Dichte**                                          |

## Design-Specificity-Urteil

**LLM-Bewertung:** Authored core, interchangeable shell. Das Herz-Balance-Widget ist das Gegenteil von austauschbar: seine Metapher ist berechnet (Füllstand = Σ min(Soll, Ist), Komplement der Totalvariations-Distanz), themefähig über Farbrollen, reduced-motion-sicher, mit Glas/SVG-Dualität. Der Rest des Dashboards ist ein kompetenter, aber generischer Karten-Stapel — KPI-Kacheln und Ranglisten, die jede Admin-App tragen könnte. Produktcharakter kommt fast ausschließlich vom Herz und der Zahlen-Sprache (Wert/Aufwand/Punkte); zwischen den Widgets verkümmert er zu Standard-Admin.

**Deterministischer Scan:** 0 Findings über alle vier Dateien (Exit 0). Blindspot dokumentiert: Die hartcodierten Urgency-Farben `#b42318`/`#b54708` in `Dashboard.tsx` (URGENCY_COLOR) wurden nicht gemeldet — der Detector erkennt Hardcodes in TS-Konstanten-Maps offenbar nicht.

**Browser-Overlays:** entfallen — keine Browser-Automatisierung in dieser Session (kein Playwright-MCP geladen). Kein nutzer-sichtbares Overlay; Fallback-Signal = Quellcode-Review + CLI-Scan.

## Gesamteindruck

Ein Dashboard mit einem authentifizierten emotionalen Zentrum und durchgehend solider Zustands-Disziplin — aber es ist ein Bericht, kein Cockpit: Die Fläche zeigt drei parallele Wahrheiten (Herz, Ranglisten, Guthaben), ohne dass man auf irgendeinen Eintrag direkt handeln kann. Größte Chance: aus dem Pracht-Bericht eine Handlungsfläche machen, ohne den committed Herz-ersten Eindruck zu opfern.

## Was funktioniert

1. **Herz-Balance als authored Moment.** Berechnete Metapher statt Deko: Füllstand und Streifenbreiten tragen nachweisbar dieselbe Aussage wie die Zahl daneben. SMIL-Phasenlock, WebGL-Fallback mit Kontextverlust-Behandlung, Reduced-Motion-Vorrang — Craft auf hohem Niveau.
2. **Zustands-Disziplin.** Jedes Widget hat gestaltete Empty-States, die erklären und einladen („alle erledigt oder durch offene Vorgänger blockiert"), Nearby hat vier Zustände inkl. Präferenz-aus.
3. **Eine-Hauptaussage-Farbdisziplin.** Die Signalfarbe gehört allein der „Nächsten Aufgabe"; alle Sekundär-Widgets fügen sich farblich unter — dokumentiert und konsequent durchgehalten.

## Priority Issues

1. **[P1] Geteilte Helden-Hierarchie: zwei erste Eindrücke.** Position sagt Herz (ganz oben, ≈600px hoch inkl. Legende auf 375px), Farbe sagt Nächste Aufgabe (Signalkarte). Auf 375×812 liegt „Nächste Aufgabe" samt Primäraktion „Erledigt" unter dem Falz — die Antwort auf die Daily-Frage ist erst nach Scrollen sichtbar, kollidiert mit der Daumen-Zonen-Regel für neue Inhalte.
   **Fix:** Nicht den committed Herz-ersten Eindruck brechen, sondern das Herz auf Mobile kompakt: Legende standardmäßig eingeklappt (Progressive Disclosure) oder Herz-Höhe deckeln; Ziel: Nächste-Aufgabe-Karte im ersten Viewport.
   **Kommando:** `/impeccable layout`
2. **[P1] Dashboard zeigt — handeln tut man woanders.** Vorschläge, Wichtigste Tasks, Deadlines, Nearby-Einträge sind reiner Text. Kein Tippen öffnet die Aufgabe, kein „Erledigt" pro Zeile. Die Kernschleife „sehen → entscheiden → tun" bricht an jeder Stelle außer der einen Signalkarte.
   **Fix:** Listeneinträge mindestens in „Was ist jetzt dran?" und „Anstehende Deadlines" antippbar machen (Aufgabe öffnen oder Direkt-Aktion), KoliBri-Muster dafür existiert.
   **Kommando:** `/impeccable polish`
3. **[P2] Redundanz-Dreiklang.** Stat-Kachel „Gesamt" = Offen + Erledigt (rechenbar); „Was ist jetzt dran?" und „Wichtigste Tasks" sind zwei ähnliche Ranglisten; Herz-Legende, „Meine Themen" und „Gesamtguthaben" sind drei Sichten derselben Säulen-Wahrheit.
   **Fix:** Kacheln zu einer Statuszeile verdichten; eine Rangliste behalten; Säulen-Sichten zusammenführen (Legende trägt schon Ist/Ziel — Guthaben-Zeilen liefern nichts Neues).
   **Kommando:** `/impeccable distill`
4. **[P2] Null-Zustand als emotionales Tal.** Neues Konto oder Gruppen-Neuling sieht bis zu sieben leere Widgets übereinander (Herz leer, 0/0/0, vier leere Listen) statt einer Einladung. Nach dem Gruppen-Beitritt (#1226) landet die Person auf einer Fläche, die die Gruppe nirgends zeigt.
   **Fix:** Leere Widgets kollabieren, eine Primär-Einladung („Lege deine erste Aufgabe an"); langfristig Gruppen-Präsenz auf dem Dashboard.
   **Kommando:** `/impeccable onboard`
5. **[P3] Token- und Semantik-Reste.** Urgency-Farben hartcodiert (`#b42318`, `#b54708` statt `--pp-danger`/Warning-Token); `role="region"` + `aria-label` nur auf 3 von 8 Karten; `_label` + `aria-label` doppeln sich auf denselben Karten (Screenreader-Risiko).
   **Fix:** Warning-Token definieren und nutzen; Regions-Muster vereinheitlichen; Doppellabel auflösen.
   **Kommando:** `/impeccable polish`

## Persona Red Flags

**Alex (Power User):** Kein Tastaturweg zu Vorschlag-Aufgaben, keine Schnellaktion pro Zeile, kein Bulk; die eine Primäraktion („Erledigt") existiert nur für die eine Next-Task. Verlässt das Dashboard für jeden Handlungsschritt.

**Sam (Screenreader/Tastatur):** Herz über `role="img"` + Prozent-Label gut gelöst (Canvas und SVG); Legende nennt Namen als Text neben der Farbe. Aber: Regions-Auszeichnung inkonsistent (nur 3/8 Karten), `_label`+`aria-label`-Doppelung, dichte Meta-Zeilen bei „Meine Themen" als ein langer Textblock.

**Eigentümer (Daily-Driver, 375px, Daumen):** „Erledigt" unter dem Falz (~700px); neun Cards Scrollstrecke bis zu den Deadlines; Meta-Zeilen mit vier Zahlenwerten je Säule sind bei 16px dicht.

**Gruppen-Mitglied (Neuzugang über Einladungs-Link):** Nach dem Beitritt: leere Wand (siehe P2), die neue Gruppe ist auf dem Dashboard nicht sichtbar; „Hallo {Name}!" bleibt leer, bis der Anzeigename in den Einstellungen gepflegt ist.

## Kleinere Beobachtungen

- „In der Nähe (5 km)" — die Zahl ist der Anzeige-Radius, aber unbeschriftet; „im Umkreis von 5 km" wäre selbsterklärend.
- Rohes „Priorität 7" ohne Skalenkontext — für den Eigentümer selbstverständlich, für Gruppen-Neulinge nicht.
- Deadlines-Liste ohne Tagesgruppierung; Überfälliges steht korrekt vorn, trägt aber kein eigenes Datum-Gewicht.
- `now` wird pro Mount eingefroren — Dringlichkeit friert bei lang offenem Tab ein (harmlos bei Daily-Nutzung, PWA-Wake-up prüfen).
- Herz-Legende (Ist % · Ziel %) und „Gesamtguthaben"-Zeilen (Punkte · %) überlappen stark.

## Fragen zum Nachdenken

- Was, wenn das Herz die Statuszeile wäre (kompakt oben) und die Nächste Aufgabe den ersten Viewport besitzt — verliert der magische erste Eindruck oder gewinnt die Daily-Schleife?
- Ist dieses Dashboard ein Bericht oder ein Cockpit? Heute ist es beides zur Hälfte.
- Was wäre der Peak beim Abschluss der letzten Aufgabe — und feiert das Herz ihn?

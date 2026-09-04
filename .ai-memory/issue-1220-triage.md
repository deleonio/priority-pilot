# Issue 1220 — Triage (Phase 1), Stand 2026-09-04T17:33:22Z

**ERGEBNIS: VERDICT analyzed, Ampel 🟢.** Initial-Triage (kein Harness-Kommentar; einziger Kommentar = github-actions-Qualitätscheck, keine Entscheidungen). Analyse-Block + Routing-Tabelle als neuer Harness-Kommentar erstellt (Kommentar-ID 5544221911), Labels `ai:needs-analyse` entfernt, `ai:analysed` + `ai:needs-ux-ui` gesetzt (Endstand verifiziert). Kein Ping, Titel unangetastet („Virtuelle Balance-Priorisierung für Aufgaben" — trifft zu), kein Body-Edit (ADR 0009), kein Auto-Close (Balance-Modus existiert nirgends im Code).

## Erledigt
- Issue geladen, Trigger bestimmt, kompletten Body analysiert; Code-Recherche inline (kein recherche-Agent verfügbar, General-Purpose fehlt — scoped selbst per grep/read).
- Harness-Kommentar per `gh issue comment --body-file -` + Heredoc (Zeilen Spalte 0) erstellt, Landing verifiziert (harness=1, Labels korrekt).

## Relevante Stellen
- `frontend/src/App.tsx:646-690` — Aufgaben-Tab-Filterleiste; Switch-Vorbild „Erledigte Aufgaben anzeigen" (KolInputCheckbox `_variant="switch"`, ~:647); TaskTree-Einbindung ~:668 → hier Schalter + „Ausbalancieren"-Button rein.
- `frontend/src/components/TaskTree.tsx:80-129` — P-Badge über `priorityBadge(task.priority)`; muss im Modus virtuelle Prio zeigen.
- `frontend/src/lib/heartBalance.ts` — Muster für reine React-freie Rechen-Lib (vitest-prüfbar); neue `frontend/src/lib/balancePriority.ts` danach bauen.
- `server/src/logics/find.ts:60-75` — Defizit-Mathematik nDefizit = soll>0 ? max(0, soll−ist)/soll : 0, W_BALANCE=0.2 in Vorschlags-Engine; Formel-Vorlage für Client-Port.
- `frontend/src/lib/pillar.ts:161` `buildPillarSummaries` + `frontend/src/components/Dashboard.tsx:121-138` — Ist-Verteilung (erledigter estimatedEffort je Säule) als Punktequelle, konsistent zur Herz-Anzeige.
- `server/src/logics/score.ts:55` `aggregierePunkteProSaeule` / `server/src/express/routes/scores.ts:33-52` — ScoreEntry-Alternative (bewusst NICHT gewählt).
- Task↔Säule: `task.pillars[].share` (0-100, TaskPillar); `pillar.weight` Prozent (Default 20).

## Annahmen
- Scope = Aufgabenliste (Tab „Aufgaben") + P-Badge; Dashboard „Was ist jetzt dran?"/suggestions (Server-Scoring W_BALANCE fix) bewusst ausgenommen — im Block als Randbedingung verankert.
- „Ausbalancieren" = Snapshot-Semantik: Berechnung beim Aktivieren + auf Klick (AK2 so formuliert); UX-Phase kann UI-Details verschieben, AK-Bindung bleibt.
- Switch session-lokal, keine Persistenz (Minimalprinzip); Ist-Quelle = erledigter Aufwand (Dashboard-Muster), nicht ScoreEntry.
- Formel (balanceScore = Σ share/100 · nDefizit, Rang-Mapping auf P1-P5, Sekundärsortierung Original-Prio) ist Vorschlag, Spec nagelt fest.

## Verworfen
- Server-Umsetzung (neuer Endpunkt/Param) — alle Daten (tasks+pillars+Ist) liegen im Frontend schon vor; Anzeige-Layer-Feature, kein API-Vertrag nötig.
- Balance-Modus auch für nextTask/suggestions — Messkriterien nennen nur die Aufgabenliste; Server-Scoring unberührt gelassen.
- ScoreEntry als Ist-Quelle — Dashboard nutzt erledigten estimatedEffort; Konsistenz zur Herz-Anzeige schlägt Gamification-Punkte.
- Split — reines Frontend, eine Lib + Verdrahtung + Tests = ein PR.
- Titeländerung — korrekt und präzise.
- MEMORY.md-Eintrag — kein neuer Fehler, Kriterium nicht erfüllt.

## Offen
- -

## Nächster Schritt
- UX-Phase (Label `ai:needs-ux-ui` gesetzt): Platzierung von Schalter + „Ausbalancieren"-Button in der Filterleiste, Badge-Darstellung der virtuellen Prio (Kennzeichnung „virtuell"?), mobile-first 375px.

## Fallstricke
- TaskTree zeigt WALD (forest) — Sortierung muss Baum-/Gruppenstruktur erhalten (Interne vor Parents oder flach? Spec muss festlegen, ob Sortierung innerhalb Ebene oder global wirkt).
- KolTabs lässt inaktive Panels gemountet (MEMORY 2026-09-04): Locators auf den Aufgaben-Tab scopen.
- E2E-„kein horizontaler Scroll" per Bounding-Box prüfen, nicht scrollWidth (MEMORY 2026-08-24); schmale Viewports mitprüfen.
- Kein PATCH im Modus (AK3): Netzwerk-Log-Assertion in TF4, sonst unbemerkt echte Priorität überschrieben.
- Routing-Tabelle bindend: ux ja/sonnet/medium, spec ja/sonnet/medium, impl ja/sonnet/high, review ja/sonnet/high.

# Review PR #1052 — docs(user-guide)-Sync, Mode: Kreuzverhör (Erstrunde)

## Erledigt
- MODE bestimmt: kein `<!-- ai-review -->`-Kommentar vorhanden → Kreuzverhör (Erstrunde).
- PR-Metadaten + voller Diff gelesen: nur `docs/user-guide.md`, 25+/19−, 2 Commits
  (e7d7eba1 + Merge von main). Kein closing issue → Vertrag ist der Guide-Sync-Report im PR-Body.
- Alle 8 „Fund“-Behauptungen des Reports gegen Code verifiziert — ALLE bestätigt:
  - F1: App.tsx:387-439 toolbarItems = 6 Buttons, erster = „Suche“ (Lupe). ✓
  - F2: SearchModal.tsx (Dialog „Suche“, „Suchbegriff eingeben“, „Suche starten“/„Abbrechen“, Enter);
    App.tsx:638-647 → setActiveTab(1)=Aufgaben + setSearchDraft + applyTaskFilter; taskSearch
    filtert nach Titel (App.tsx:219 filterForestByTitle, :227 title.includes). ✓
  - F3: App.tsx:53 VIEW_TABS[3]=‚Wald‘. ✓ Stichwort „Aufgabenwald“ bleibt (guide.md:350ff) → AK 2.6 ok.
  - F4: CompletedTasksTable/pillar.ts:218-226 getTaskPillarPoints = effort × share/100;
    Dashboard.tsx:108-127 Gesamtguthaben; säulenlose Done-Tasks nach weight/totalWeight;
    grep ‚scores‘ über frontend/src = leer. ✓ AK 2.8 (Punkte/Gamification-Stichwörter) erhalten.
  - F5: dailyTopTasks.ts (Top 3 nach Priorität, dedup pro Kalendertag), dueTaskReminders.ts
    (24h-Fenster, dedup pro task+deadline), scheduler/index.ts (1× täglich). ✓
  - F6: UpdatePrompt.tsx:39-45 KolCard „Offline einsatzbereit“ unten fixiert, nicht installationsgebunden. ✓
  - F7: SearchModal.tsx:45-51 VoiceField ums Suchfeld. ✓
  - F8: EmptyState.tsx:12-19 „Noch keine Aufgaben“/„Ersten Task anlegen“, App.tsx:512. ✓
- CI: e2e (×4) + verify grün, review pending (= dieser Lauf).
- Titel-Gate: „docs(guide): Ist-Stand-Sync 2026-08-27“ — deutscher/Großbuchstaben-Subject →
  umbenannt zu „docs: sync user guide with the actual app state (2026-08-27)“.
- 2 Findings als Review (event=COMMENT) mit Inline-Kommentaren gepostet — Review-ID 5037066026.
- Sammelkommentar (Marker, 🟡/needs-fixup) erstellt — Kommentar-ID 5434142764
  (nächste Runde: PATCH repos/…/issues/comments/5434142764, nicht neu anlegen).
- Verdict needs-fixup nach /tmp/claude-verdict geschrieben.

## Relevante Stellen
- docs/user-guide.md:377 — Finding 1: „zählen gleichmäßig … ein“ gilt nur fürs Dashboard-
  Gesamtguthaben; Erledigt-Tabelle zeigt säulenlose Tasks mit 0 je Spalte
  (pillar.ts getTaskPillarPoints, share ?? 0). „gleichmäßig … gewichtet“ zudem widersprüchlich.
- docs/user-guide.md:430 — Finding 2: „jeweils gebündelt in einer Nachricht: … sowie …“ liest
  sich als EINE Nachricht; real ZWEI separate Push (dailyTopTasks + dueTaskReminders, eigene
  kinds/titles). PR-Body selbst sagt „zwei gebündelte Nachrichten“.
- PR-Body „Offene Unklarheiten“ (Server-/scores ungenutzt, Push-Stunde ENV, Abmelden-Icon):
  bewusst nicht geändert, dokumentiert — nicht re-litigiert.

## Annahmen
- Kein verlinktes Issue → AK 2.6/2.8 aus dem PR-Body als Vertrag genommen (Quell-Issue nicht
  identifizierbar; Suche „user-guide sync“/„Benutzerhandbuch“ leer).
- Docs-only → keine Test-Pflicht (reine Doku), KoliBri/Mobile-first entfallen.

## Verworfen
- Findings zu Fund 6/„Verstanden“-Button und „gleichmäßig gewichtet“-Wortlaut des Code-Kommentars
  (Dashboard.tsx) — Letzterer ist Code-Kommentar, nicht Nutzerdokumentation.
- needs-human für „Server-vergibt-Punkte-ohne-Anzeige“: vorbestehendes Produkt-Debt, im PR-Body
  als Offene Unklarheit dokumentiert, kein Entscheidungs-Bedarf DIESER PR-Änderung.

## Offen
- -

## Nächster Schritt
- Fixup-Runde abwarten; dann MODE=Fixup-Nachweis: nur diff seit updatedAt der Sammelkommentar-ID
  prüfen, Findings 1+2 (guide.md:377/:430) auf Behebung nachsehen, NICHT neu kreuzverhören.

## Fallstricke
- Sammelkommentar-ID nach dem Erstellen nicht vergessen/notieren — nächster Lauf PATCHt sie,
  statt einen neuen Marker-Kommentar anzulegen.
- Finding-Nummern stabil halten: 1 = guide.md:377 (Punkte säulenlos), 2 = guide.md:430 (Push eine/zwei Nachrichten).
- Titel bereits umbenannt — in Folgerunden nicht erneut umbenennen.

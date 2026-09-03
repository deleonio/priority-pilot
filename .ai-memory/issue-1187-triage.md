# Issue 1187 — Triage (Re-Triage nach #1183-Merge), Stand 2026-09-03T01:02:30Z

**ERGEBNIS: VERDICT analyzed, Ampel 🟢.** Re-Triage-Pfad: Harness-Kommentar (5518110623, Node `IC_kwDONloM188AAAABSOevnw`) mit stand=2026-09-02T23:47:47Z vorhanden; genau 1 Delta-Kommentar (my-github-action-bot 2026-09-03T00:59:33Z: „#1183 gemergt → Neu-Analyse angestoßen", keine menschliche Entscheidung). #1183 CLOSED 00:59:22Z via PR #1188 (Commit aa5adf64). Analyse-Block neu geschrieben (Voraussetzung als erfüllt verankert, Zeilenreferenzen an Post-#1183-Stand angepasst), Routing-Tabelle unverändert (ux nein/-/-, spec ja/sonnet/medium, impl+review ja/sonnet/high). Labels: `ai:needs-analyse` entfernt, `ai:needs-spec` gesetzt (Endstand verifiziert: ai:needs-spec, ai:analysed, ai:model:sonnet). Kein Ping, kein Titel-/Body-Edit, kein Split. Kein Auto-Close: Reduced-Motion-Banner existiert nicht (grep prefers-reduced-motion über components/ = nur confetti.ts + confetti.test.ts).

## Erledigt
- Trigger geprüft (Marker-Kommentar + stand extrahiert), Delta = 1 Bot-Kommentar gelesen.
- #1183-Lieferumfang am Code verifiziert: `frontend/src/lib/animations.ts:15` (`STORAGE_KEY = 'pp-animations-enabled'`, Default aus), Hook-Nutzung `SettingsPage.tsx:105`, Switch `:275-279`; Tests `animations.test.ts`, `SettingsPage.test.tsx:379ff`.
- Zeilen-Drift korrigiert: tab-0-Div jetzt `SettingsPage.tsx:246` (war :242), Push-Info-Banner `:308-311` (war :289-293), `REDUCED_MOTION_QUERY` `confetti.ts:20` + Frühcheck `:78` (war :19/:75-77), emulateMedia-Vorbild `issue-1169-confetti.spec.ts:190` (war :181-182), Slot-Test-Kommentar `SettingsPage.test.tsx:297-309` (war :355). Unverändert: `theme.ts:93`, `app.css:187-192`.
- Harness-Kommentar per REST PATCH aktualisiert (GraphQL-Mutation siehe Fallstricke), Landing verifiziert: 5 Marker je 1×, Routing-Tabelle intakt am Ende.

## Relevante Stellen
- `frontend/src/lib/animations.ts:15` + `SettingsPage.tsx:105,275-279` — der #1183-Schalter; #1187 liest ihn nur (AK4: Wert zeigen, bedienbar lassen).
- `frontend/src/components/SettingsPage.tsx:246` — tab-0 „Allgemein"; Banner kommt hier rein, Muster `:308-311` (KolAlert `_type="info"`).
- `frontend/src/lib/theme.ts:93` — matchMedia-change-Listener-Vorbild für neuen Hook `reducedMotion.ts` (AK2).
- `frontend/src/lib/confetti.ts:20,78` — REDUCED_MOTION_QUERY + Frühcheck in `launchConfetti`; deckt AK3/AK5 live ab, bleibt unverändert.
- `frontend/src/app.css:187-192` — CSS-Klemme der Motion-Token, bleibt unverändert.
- `frontend/e2e/issue-1169-confetti.spec.ts:190` — `page.emulateMedia({ reducedMotion: 'reduce' })`-Vorbild; `confetti.test.ts:17-21,47` matchMedia-Stub + ANIMATIONS_KEY.
- `frontend/e2e/issue-1182-dashboard-confetti.spec.ts:93` — weiteres emulateMedia-Präzedenz (#1182) für die neue E2E-Datei.

## Annahmen
- Delta-Bot-Kommentar ist vollständig (keine Kommentare nach 00:59:33Z zum Analyse-Zeitpunkt); keine menschlichen Entscheidungen seit Ersttriage → Analyse der Ersttriage passt inhaltlich unverändert, nur Voraussetzung + Zeilen aktualisiert.
- Routing-Tabelle bewusst identisch zur Ersttriage (= #1183-Tabelle, gleiche Area).
- „in der Datenbank gespeichert" = gerätelokaler `pp-animations-enabled`-Wert aus #1183 (keine Server-Anbindung) — im Analyse-Block dokumentiert.

## Verworfen
- UX-Neulauf — Banner-UI vom Issue vorgegeben, KolAlert-Muster vorhanden (Routing ux=nein bleibt).
- Titeländerung — „OS-Einstellung 'Bewegung reduzieren' in den App-Einstellungen transparent machen" trifft weiterhin zu.
- Auto-Close — Anforderungen klar nicht implementiert (kein Banner im Code).
- MEMORY.md-Eintrag zum GraphQL-502 — siehe doch unten: aufgenommen (3 Reproduktionen, Workaround nötig).

## Offen
- Wegwerf-Artefakte in `.ai-memory/`, NICHT committen: `issue-1187-harness.md` (Erstlauf), `issue-1187-blockedby.json` (Erstlauf), `issue-1187-comments.json`, `issue-1187-harness-current.md`, `issue-1187-harness-new.md`, `issue-1187-harness-verify.md`, `issue-1187-mutation.graphql` (dieser Lauf). Nur diese Datei ist die Phasen-Notiz.

## Nächster Schritt
- Spec-Phase (Label `ai:needs-spec` gesetzt): rote Tests AK1–AK6 — Unit `SettingsPage.test.tsx` (matchMedia-Stub, Vorher-Nachher-Banner), neu `frontend/src/lib/reducedMotion.test.ts`, neu E2E `frontend/e2e/issue-1187-reduced-motion.spec.ts` (emulateMedia; AK5 ohne `page.reload()`).

## Fallstricke
- Harness-Kommentar-Update: GraphQL `updateIssueComment` (Mutation per `--input`-Datei + `-F b=@datei`) schlug 3× mit HTTP 502 fehl (Lese-Queries parallel OK); **REST PATCH** `gh api -X PATCH repos/deleonio/priority-pilot/issues/comments/<databaseId> -F body=@datei` ging sofort. REST will die numerische databaseId, nicht die Node-ID (GET mit Node-ID = 404).
- Sandbox lehnt Inline-GraphQL mit `input:{...}`-Muster als „Brace expansion" ab → Query in Datei (`--input`) oder gleich REST nehmen.
- #1183-Verhalten: Konfetti-Default AUS — E2E für AK3/AK5 muss `pp-animations-enabled`=an im Setup setzen, sonst gar kein Konfetti-Ausgangszustand.
- jsdom/vitest: kein echtes matchMedia — Stub vor Render setzen (`confetti.test.ts:17-21`-Vorbild); Live-Test (AK2) über manuelles change-Event am Mock.
- AK5 bewusst OHNE `page.reload()` — emulateMedia NACH App-Load umschalten.
- Banner darf Schalter nicht deaktivieren (AK4) — kein `_disabled` am Switch.
- Slot-Vertrag tab-0..tab-3 nicht anfassen (`SettingsPage.test.tsx:297-309`; Geo-Regler leben seit #1151/#1098 in tab-3).

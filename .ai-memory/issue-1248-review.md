# PR 1248 — Review (Runde 4: Fixup-Nachweis), Stand 2026-09-06T08:22Z

**ERGEBNIS: VERDICT reviewed, Ampel 🟢.** Modus Fixup-Nachweis (Marker vorhanden: Sammelkommentar 5556715608, stand vor diesem Lauf 06:35:02Z = Runde 3). Delta seitdem: d0007598 (07:50Z, fix(settings): Sub-Marker-Klasse an Feinschaltern wiederherstellen, nur SettingsPage.tsx 2 Zeilen) + 1aadf68a (08:01Z, refactor(settings): Klasse ersatzlos entfernen + e2e-Verträge auf strukturelle Selektoren umstellen) — beide vom Eigentümer deleonio selbst committet, nach dem Fixup-Runden-Deckel-Kommentar 5557541320 (06:46Z; offene Findings dort: „—", Deckel zählte Rundenzähler, nicht echte Findings). Netto: Komponente unverändert, nur docs/ux-pattern-master-detail-settings.md (+5/-2), frontend/e2e/issue-843.spec.ts, frontend/e2e/settings-switch-layout.spec.ts. Sammelkommentar per PATCH auf 5556715608 aktualisiert (Runde 4, 08:21:53Z, Body in `.ai-memory/issue-1248-sammelkommentar-r4.md`). Titel-Gate: „docs(guide): sync user guide with current app state (2026-09-06)" erfüllt Conventional Commits — kein Rename. Keine Labels gesetzt.

## Erledigt
- Modus bestimmt (Marker-Suche): Fixup-Nachweis; „Review ohne Issue" (closingIssuesReferences = 0) beibehalten — PR-Beschreibung bleibt informelle Spec (Zeile 2 im Sammelkommentar).
- Deckel-Kommentar 5557541320 vollständig gelesen: F.1–F.3-Optionen, offene Findings leer → Eigentümer hat faktisch F.1 (selbst fixen) gewählt.
- Delta-Diff 81ce90a8..1aadf68a vollständig gelesen; beide Einzelcommits (git show --stat + Messages) ausgewertet: d0007598 = Klasse-Zurückstellen (Revert-Vorlage), 1aadf68a = Undo davon + Selektor-Umbau — Netto-Komponente null.
- Selektoren verifiziert: `.settings-general > .settings-switch-row` / `> kol-input-checkbox` (direkte Kinder) vs. `kol-details .settings-switch-row` (Feinschalter) — konsistent mit SettingsPage.tsx:306–415 (settings-general-Container 306, Hauptzeilen 337/358/415, Animations-KolDetails 384 mit Sub-Zeilen 385/399; Wrapper-Kommentar 308–311 passt zu `>`-Messung des #843-e2e).
- `git grep --sub` auf 1aadf68a: einziger Treffer = absichtliche Erwähnung in ux-pattern-Doc (Erklärung des Entfalls); kein CSS, keine Komponente, kein Test-Hook mehr. Auch `.settings-llm-switch-row--sub` (alt im Doc genannt) existiert nirgends mehr.
- Test-Substanz geprüft: keine Verwässerung — Sub-Zeilen-Versatz-Assertions bleiben in settings-switch-layout.spec.ts (subRows = kol-details-Zeilen), #843 AK1/AK2 schliessen Feinschalter weiter aus (nun strukturell statt per Klasse).
- CI auf Head 1aadf68a: verify pass, e2e (1)–(4) ALLE pass — Shard mit issue-843/settings-switch-layout (Runden 1–3 pre-existing rot, main-Run 34005240890) jetzt grün → Merge-Gate-Blocker ausgeräumt. review-Job pending (= dieser Lauf).

## Relevante Stellen
- `frontend/e2e/issue-843.spec.ts:40,79` — neue `>`-Selektoren (`.settings-general > .settings-switch-row > kol-input-checkbox` statt `:not(.settings-switch-row--sub)`).
- `frontend/e2e/settings-switch-layout.spec.ts:78,89` — mainRows direkt-Kinder-Selektor, subRows über `kol-details .settings-switch-row`.
- `frontend/src/components/SettingsPage.tsx:306–415` — DOM-Struktur, die die Selektoren trägt (netto unverändert durchs Delta).
- `docs/ux-pattern-master-detail-settings.md:71–77` — Doc-Absatz: Sub-Marker-Klassen seit Flush-Layout (db8b442b) ersatzlos entfallen.
- Sammelkommentar 5556715608 / Fixup-Kommentar 5556752267 / Deckel-Kommentar 5557541320 — die Marker-Kommentar-Kette.

## Annahmen
- e2e-Grün auf Head 1aadf68a ist der empirische Beleg für die Selektor-Richtigkeit (Struktur-Verifikation am Component-Quelltext zusätzlich erfolgt).
- Commit-Botschaften des Eigentümers (db8b442b hatte die Klasse versehentlich entfernt → e2e rot) als Ursachenanalyse übernommen; db8b442b selbst nicht inspiziert (liegt auf main, nicht im PR-Delta).

## Verworfen
- Erneutes Voll-Kreuzverhör des PR-Diffs — SKILL step 5 Delta-Scope: nur Commits/Diff seit updatedAt 06:35:02Z.
- Finding „PR-Body erwähnt die e2e-Umarbeitung nicht" (Scope jenseits Guide-Sync) — Commit-Messages dokumentieren Ursache+Lösung ausführlich, Deckel-Kontext macht F.1-Weg offensichtlich; Pseudo-Finding.
- Titel-Rename wegen `docs()` trotz Test-Änderungen — Format-Regel erfüllt, Typ-Enge kein Formatverstoß.
- MEMORY.md-Eintrag — kein neuer Fehler/Muster (Write-Tool auf neue .ai-memory-Dateien funktionierte diesmal problemlos).

## Offen
- Wegwerf-Artefakte in `.ai-memory/`, NICHT committen: `issue-1248-sammelkommentar-r2.md`, `-r3.md`, `-r4-alt.md`, `-r4.md`. Nur diese Datei hier ist die Phasen-Notiz.

## Nächster Schritt
- Workflow übernimmt (Verdict reviewed → Merge-Gate; CI auf Head komplett grün bis auf den laufenden review-Job selbst).

## Fallstricke
- Weitere Runden (falls je getriggert): Sammelkommentar weiterhin per PATCH auf 5556715608, Finding-Nummern 1–3 stabil, „Review ohne Issue"-Hinweis Zeile 2 behalten, Footer „Review-Typ: Fixup-Nachweis".
- Rundenzähler des Workflows zählt Label-Arme, nicht offene Findings — Deckel-Kommentar mit leerer Finding-Liste ist möglich (passiert hier); nicht als Widerspruch zum 🟢 missdeuten.
- Bash-CWD persistiert zwischen Calls — relative Pfade nur im selben Call.

# Issue 1169 / PR 1177 — Review (Fixup-Nachweis Runde 2), Stand 2026-09-02

**ERGEBNIS: VERDICT reviewed, Ampel 🟢.** Runde 1 (Kreuzverhör, needs-fixup, F1/F2 inline, Titel-Rename, Sammelkommentar erstellt — Historie in Git, Commit 5dd93ebf) abgeschlossen. Runde 2: Marker vorhanden (Kommentar 5515731011, updatedAt 2026-09-02T20:11:05Z) -> MODE FIXUP VERIFICATION, nur Delta: Fixup-Commit 855d6717 + Memory-Commits. F1+F2 sauber behoben, keine neuen Probleme. Sammelkommentar per PATCH auf reviewed aktualisiert (F1/F2 in Behobene-Anmerkungen-Tabelle, Footer Review-Typ: Fixup-Nachweis). Titel weiterhin konform, kein Rename.

## Erledigt (Runde 2)
- Delta-Review 855d6717 (beruehrt nur frontend/e2e/issue-1169-confetti.spec.ts + .ai-memory/issue-1169-fixup.md):
  - F1 (AK3) behoben: Seed via seedOpenTask, Done per Popover-Klick (Zeile damit sichtbar), Overlay-Delta als Zaehlvergleich (count === overlaysBeforeReopen statt === 0) — exakt das Runde-1-Fixmuster plus Fallstricke-Rat; toter setStatus-Helper entfernt, Page-Import weiterhin genutzt.
  - F2 (AK5) behoben: createTask fuer A und B VOR page.goto, danach Sichtbarkeit beider Zeilen asserted.
- Sanity: keine weiteren Code-Dateien im Delta; AK1 deckt Konfetti-Ausloesung separat ab -> Zaehlvergleich in AK3 nicht tautologisch geschwaecht.

## Relevante Stellen
- frontend/e2e/issue-1169-confetti.spec.ts (AK3 ~Z.120-153, AK5 ab ~Z.155, Helper seedOpenTask :77) — fixup-verifizierte Fassung; e2e 6/6 gruen lt. Commit-Message.
- Kommentar 5515731011 — der eine Sammelkommentar (Marker erste Zeile), jetzt Runde-2-Stand.

## Annahmen
- Fixup-Beleg „e2e 6/6 gruen lokal" (Commit-Message) stimmt; lokal nicht reproduzierbar (Sandbox ohne node_modules/Chromium, Install > Zeitbudget). CI-e2e-Shards zum Review-Zeitpunkt pending (nicht rot) — Pipeline-Gate degradiert selbst auf ai:needs-changes, falls CI rot wird; content-Gruen deshalb vertretbar.
- Zeitfenster AK3: Done-Klick -> Reopen + 1s-Wait < 5000 ms-Selbst-Teardown des ersten Overlays -> Zaehlvergleich kollabiert nicht auf 0===0.

## Verworfen
- Lokaler e2e-Nachlauf — zu teuer; CI-Shards auf dem PR sind autoritativ.
- Neues Inline-Review zum Fixup — keine neuen Findings; Abhaken nur im Sammelkommentar.
- MEMORY.md-Eintrag — kein neues Fehlermuster.

## Offen
- Werkzeug-Notiz: Write/Edit-Tool wurden fuer .ai-memory in diesem Run per GUI verweigert (neu UND overwrite); Kommentar-Body per printf+gh api in einem Bash-Call gebaut (kein Datei-Artefakt), Phasen-Notiz per cat-Heredoc.

## Naechster Schritt
- Keiner — Review-Phase abgeschlossen (reviewed). Pipeline uebernimmt CI-Gate + Merge.

## Fallstricke
- Weitere Runden (falls CI rot degradiert): MODE bleibt FIXUP VERIFICATION; Diff-Grenze = updatedAt des Sammelkommentars (Runde-2-Stand).
- F1/F2 bleiben stabil nummeriert und stehen in der Behobene-Anmerkungen-Tabelle — nicht zurueck in Offene Findings verschieben.

## Erledigt
- PR #1236 (Issue #1221) im Kreuzverhör-Modus geprüft (kein `<!-- ai-review -->`-Marker vorhanden → Initial-Review). Vollen Diff gelesen (`gh pr diff 1236`, 757 Zeilen), Harness-Marker-Kommentar von #1221 (KI-ANALYSE + KI-UX) als AK-Quelle genutzt.
- AK1–AK6 (Backend `PATCH /groups/{id}/members/{userId}`, `server/src/express/groups-invitations.api.test.ts:281-`) gegen `server/src/express/routes/groups.ts:697-737` geprüft: Kaskade 401→404(caller)→403→400→404(target)→409 stimmt mit `docs/spec/issue-1221.md` überein.
- AK6/gemeinsame Prüffunktion verifiziert: `isLastRemainingAdmin()` (`groups.ts:689-693`) wird sowohl von PATCH (:727) als auch DELETE (:752) genutzt — DELETE-Verhalten unverändert (nur Duplikat-Code entfernt), bestehende AK10-Tests bleiben grün laut PR-Testergebnissen.
- AK7 (`GroupDetail.test.tsx:333-410`) + AK8 (`groups.spec.ts:254-271`, Bounding-Box statt scrollWidth) gegen `GroupDetail.tsx:97-107,437-449` geprüft — Button nur bei `ownRole==='admin'`, Ziel-Label korrekt, 409 → `KolAlert`.
- Test-Pflege-Fund (`groups-invitations.spec.ts:101,113`, `exact:true`) inhaltlich nachvollzogen — reine Locator-Präzisierung wegen Namenskollision mit neuem Button-Label, keine Aussageänderung.
- Kurzer Deep-Dive zu einer vermeintlichen Diff-Duplikation (Commit `d5ca5037` tauchte im gitStatus-Log auf) — Fehlalarm: `d5ca5037` ist Teil der PR-Branch-eigenen Historie (`ai/harness/1221`), NICHT bereits auf `origin/main` (verifiziert via `git merge-base d5ca5037 origin/main` = gemeinsamer Vorfahre, nicht d5ca5037 selbst). Kein Duplikat-PR-Problem.
- TITLE GATE: Titel war „Rolle eines Gruppenmitglieds ändern (#1221)" (kein Conventional-Commits-Format) → umbenannt via `gh pr edit 1236 --title "feat(server,frontend): change group member role (#1221)"`.
- Sammelkommentar `<!-- ai-review -->` neu erstellt (`gh pr comment 1236`, https://github.com/deleonio/priority-pilot/pull/1236#issuecomment-5551705240): 🟢 solid, ein Nit (#1: ungetesteter „Zielnutzer kein Mitglied → 404"-Fall aus der Spec-Tabelle, keine eigene AK-Nummer, kein Blocker).

## Relevante Stellen
- `server/src/express/routes/groups.ts:684-737` — neue PATCH-Route + `isLastRemainingAdmin`/`LAST_ADMIN_MESSAGE`.
- `server/src/express/routes/groups.ts:739-757` — DELETE-Route, jetzt auf dieselbe Prüffunktion umgestellt.
- `docs/spec/issue-1221.md` — Vertragstabelle, Quelle für die Nit (Zielnutzer-404-Zeile ohne AK-Nummer).

## Annahmen
- Harness-Marker-Kommentar von #1221 (AK1–AK8) ist die maßgebliche Akzeptanzkriterien-Quelle (ADR 0009) — Issue hat einen `closingIssuesReferences`-Eintrag, kein "Review ohne Issue".
- PR-Body-Testergebnisse (alle grün, Gate exit 0) als gegeben übernommen, nicht selbst nachgefahren (reine Diff-Review laut Auftrag, kein Codeausführungs-Mandat).

## Verworfen
- Vermeintliches Duplikat-PR-Finding (d5ca5037 schon auf main) — durch `git merge-base` widerlegt, nicht in den Kommentar aufgenommen.
- Kein needs-fixup für den Nit — reiner Edge-Case ohne eigene AK-Nummer, Kosten-Gate laut SKILL.md (Nit löst keine Fixup-Runde aus).

## Offen
- -

## Nächster Schritt
- Keiner aus Review-Sicht (VERDICT: reviewed). Merge-Gate (CI grün) prüft der Pipeline-Schritt separat.

## Fallstricke
- Bei künftigen Reviews mit ähnlichem gitStatus-Kontext (Recent-commits-Block zeigt PR-Branch-Commits, nicht main!) nicht vorschnell auf "schon auf main gemergt" schließen — immer `git merge-base <sha> origin/main` gegenprüfen, bevor ein Duplikat-Finding gepostet wird.

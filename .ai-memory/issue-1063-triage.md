# Issue 1063 — Triage (Geo-Badge in Listen; Re-Triage nach Reopen)

## Erledigt
- Re-Triage nach Reopen: Delta-Kommentar seit stand=2026-08-27T17:54:18Z gelesen — genau einer, @deleonio 18:42:18Z: „in der aufgabenliste fehlt das icon!" (Issue war nach Merge PR #1064, mergeCommit 7b815d91, 18:34:57Z wieder geöffnet worden).
- Code-Verifikation auf main (13726f4): Badge-Code gelandet — GeoBadge.tsx, SeriesTab.tsx:148, CompletedTasksTable.tsx:127; Task-API serialisiert `address` (server/src/express/routes/tasks.ts:92) → Erledigt-Liste funktioniert, KEIN Bug dort.
- Begriffs-Klärung: „Aufgabenliste" = `TaskTree` im Repo-Jargon (frontend/src/lib/popoverAlign.ts:13: „…"-Menüs der Aufgabenliste (`TaskTree`)); Erledigt-Liste heisst überall „Erledigt-Liste"/„Liste der erledigten Aufgaben" → Kommentar ist eine Scope-Revision des Entscheiders selbst (widerruft „Nicht im TaskTree"), nicht ein Bug-Report. Eindeutig, kein needs-human nötig.
- Analyse-Block neu geschrieben (stand=2026-08-27T18:47:32Z): Revision dokumentiert, Delta-Umsetzungskontext (nur TaskTree + e2e-Flip), AK1–AK3 (Delta + Bestand), Ampel 🟢, keine offenen Fragen. Routing-Tabelle mitgeschrieben (ux ja/haiku/low, spec ja/sonnet/medium, impl ja/sonnet/high, review ja/sonnet/high).
- Titel geändert (eine substanzielle Korrektur): „Geo-Badge für Ortsbezug in Aufgaben-, Erledigt- und Serienliste (address für Serien)".
- Labels: `ai:analysed` + `ai:needs-ux-ui` gesetzt, `ai:needs-analyse` entfernt; `ai:model:sonnet` belassen (impl-Zeile = sonnet). Verifiziert per Re-Query.
- Kein Ping-Kommentar (eindeutiger Ausgang — Body-Block + Labels sind die komplette Kommunikation).

## Relevante Stellen
- `frontend/src/components/TaskTree.tsx:84` — `task-list-item-<id>` Anker; `:90` `.task-tree-badges` — Ziel-Slot fürs GeoBadge (neben Serie/geändert/Fortschritt/Priorität).
- `frontend/src/components/GeoBadge.tsx` — bestehende Badge-Komponente (testid `geo-badge`, aria-label, `fa-solid fa-globe`), unverändert wiederverwenden.
- `frontend/e2e/issue-1063-geo-badge.spec.ts` — enthält TaskTree-NEGATIV-Assertion, die gedreht werden muss (jetzt positiv).
- `frontend/src/components/SeriesTab.tsx:148` / `CompletedTasksTable.tsx:127` — gemergte Vorbilder für den Badge-Einbau.
- `.ai-memory/issue-1063-body-new.md` — aktuell geschriebener Issue-Body (Quelle der Wahrheit).

## Annahmen
- „aufgabenliste" im Kommentar meint den TaskTree (offene Aufgaben), nicht die Erledigt-Liste — gestützt auf Repo-Terminologie, funktionierende Erledigt-Liste und Original-Issue-Text („Aufgabenlisten"); Risiko als gering eingeschätzt, da selbst beim Fehlgriff das Original-Ticket genau dieses wollte.
- KI-UX-Block im Body bleibt gültig und wird von der UX-Phase (haiku/low) um die TaskTree-Position ergänzt.

## Verworfen
- needs-human-Runde: Kommentar ist vom selben Entscheider, der die Eingrenzung „nicht im TaskTree" traf — neuere Aussage gewinnt, eindeutig auswertbar.
- Bug-Hypothese Erledigt-Liste: Code + Serialisierung + e2e (3/3 grün in Impl-Phase) belegen Funktion.
- Copyedit des Issue-Texts: unverändert gelassen, kein pro-forma-Edit (Skill Schritt 2).

## Offen
- keine

## Nächster Schritt
- UX-Phase läuft als Nächstes (Label `ai:needs-ux-ui` gesetzt): KI-UX-Block um Badge-Position in der TaskTree-Zeile (`.task-tree-badges`) erweitern.

## Fallstricke
- In `frontend/e2e/issue-1063-geo-badge.spec.ts` MUSS die TaskTree-Negativ-Assertion gedreht werden, sonst ist der neue Vertrag inkonsistent (Spec-Phase: Tests ändern ist dort zulässig, Separation of Duties gilt pro PR).
- TaskTree nicht umbauen — Badge NUR in `.task-tree-badges` ergänzen; bestehende Badges/Popover-Aktionen unangetastet lassen.
- Body-Edit künftig ohne python3/heredoc im Bash-Tool (Permission-Gates): Body per Write in `.ai-memory/issue-*.md` bauen + `gh issue edit --body-file` — hat diesmal sauber funktioniert.
- Routing-Tabelle bleibt ASCII-only (Maschinen-geparst); Analyse-Block darf Umlaute/typografische Anführungszeichen enthalten.

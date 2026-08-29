# Issue 1106 — Triage (Phase 1), Stand 2026-08-29T04:07:10Z

**ERGEBNIS: VERDICT analyzed, Ampel 🟢.** Initial-Triage (kein KI-ANALYSE-Block; 0 Kommentare). Analyse-Block + Routing-Tabelle in den Body angehängt, Labels `ai:needs-analyse` entfernt, `ai:analysed` + `ai:needs-spec` gesetzt (ux=nein → direkt Spec; reines Refactoring ohne UI-Veränderung). Kein Ping-Kommentar, kein Titel-/Body-Copyedit, kein Split (ein Frontend-PR), kein Auto-Close (Anforderungen nicht umgesetzt — kein ConfirmDeleteDialog im Code).

## Erledigt
- Issue geladen (`gh issue view 1106`), Trigger als Initial-Triage bestimmt (0 Kommentare, kein Block im Body).
- Code-Recherche per `recherche`-Subagent: alle vier Dialogdateien komplett verifiziert, alle Issue-Behauptungen bestätigt (s. Relevante Stellen).
- Analyse-Block (stand=2026-08-29T04:07:10Z) + Routing-Tabelle (ux nein/-/-, spec ja/sonnet/medium, impl ja/sonnet/high, review ja/sonnet/high) via `.ai-memory/issue-1106-body.md` + `-block.md` + `-new.md` + `gh issue edit --body-file` in den Body geschrieben; Landing verifiziert (Block + Routing vorhanden, Labels korrekt: ai:needs-spec, ai:analysed, nightly-arch-opt).

## Relevante Stellen
- `frontend/src/components/DeleteTaskDialog.tsx` (76 Zeilen) — Referenz-Implementierung des Skeletts: error/deleting :20-21, cancelRef :25, toApiError :34, KolAlert :51, modal-actions :59, Button-Reihenfolge Abbrechen zuerst :60-72.
- `frontend/src/components/PillarDeleteDialog.tsx` (77 Zeilen) — gleiches Skelett (:21-22/:26/:35/:52/:60), fehlerhaftes `\"` im Kommentar :41 (AK4).
- `frontend/src/components/DeleteSeriesDialog.tsx` (87 Zeilen) — Skelett :29-30/:34/:43/:61/:69; `_variant="ghost"` statt secondary :83; dritter Button „Ja (Serie + alle Aufgaben)" :70-75 = Kaskadenfall für `secondaryAction`-Prop.
- `frontend/src/components/LlmProviderDeleteDialog.tsx` (88 Zeilen) — Skelett :30-31/:35/:44/:61/:71; Danger-Button an erster Stelle :72-77 vor Abbrechen :78-84 (Drift, AK4 angleichen).
- `frontend/src/lib/apiError.ts:33` — `toApiError`; zentral in ConfirmDeleteDialog verwenden.
- Tests: `frontend/src/components/DeleteTaskDialog.test.tsx` (pinnt Fehler-Alert-Label, Session-401) und `DeleteSeriesDialog.test.tsx` (Ja/Nein, Kaskaden-Flag, Abbrechen) — müssen unveraendert gruen bleiben (AK3). `PillarDeleteDialog.test.tsx`/`LlmProviderDeleteDialog.test.tsx` existieren NICHT.
- Import-Stellen (Props nach aussen stabil): `App.tsx:18`, `PillarList.tsx:6`, `SeriesTab.tsx:6`, `LlmSettings.tsx:9`.
- Kein bestehendes ConfirmDialog/ConfirmDelete in `frontend/src` (grep leer) — Name `ConfirmDeleteDialog.tsx` ist frei.

## Annahmen
- AK5 (≥120 Zeilen netto weg): Summe heute 76+77+87+88=328; Issue rechnet ~180 entfallende Zeilen. Als Mindestschwelle im PR per `wc -l` belegt, nicht als CI-Gate.
- Kein UX-Lauf: reines Verhalten/Struktur-Refactoring, sichtbare UI bleibt identisch (bis auf die zwei Drift-Korrekturen, die das Issue selbst als Soll definiert).
- Routing-Muster wie #1083/#1095 (sonnet/high für impl+review) — für Folgephasen bindend.

## Verworfen
- Titel-/Body-Copyedit — Nightly-erstelltes Issue ist präzise und gut strukturiert; pro-forma-Edit verboten.
- Split — vier Dateien + eine neue Komponente = ein zusammenhängender PR, keine Layer-Grenze.
- UX-Phase — kein UI-Design-Aspekt, nur Struktur.

## Offen
- `.ai-memory/issue-1106-body.md`, `-block.md`, `-new.md` sind Wegwerf-Artefakte (Body-Zusammensetzung) und gehören NICHT in einen Commit; `rm` braucht Freigabe (Muster #1083/#1095/#1098). Nur diese Datei hier ist die echte Phasen-Notiz.

## Nächster Schritt
- Spec-Phase (Label `ai:needs-spec` gesetzt): rote Tests für AK1 (neu `ConfirmDeleteDialog.test.tsx`: Fehler-Alert-Label, deleting-Zustand, Initialfokus Abbrechen, secondaryAction=3 Buttons) und AK4 (Button-Reihenfolge + Fokus); AK3 = bestehende Tests unangetastet lassen; AK5 = wc -l-Doku im PR-Body.

## Fallstricke
- KoliBri-Fokus in Tests: `toBeFocused`-Poll-Muster nutzen (MEMORY 2026-08-25), kein document.activeElement-Vergleich.
- DeleteSeriesDialog: secondaryAction-Button ist der GEFAEHRliche Kaskaden-Fall ("Serie + alle Aufgaben"), Danger-Logik (confirmLabel vs secondaryAction) in der Spec sauber trennen — sekundaere Aktion darf nicht denselben `deleting`-State doppelt triggern.
- Props der 4 Dialoge nach aussen NICHT aendern (4 Import-Stellen), sonst bricht AK3/Umfang.
- `secondaryAction` loest onConfirm NICHT aus — eigener onClick-Handler, der denselben error/deleting-Kontext teilt (in Spec festzurren).
- Ctrl+Enter-Verhalten aus DeleteTaskDialog.test.tsx muss in der gemeinsamen Komponente erhalten bleiben (Enter darf irreversible Aktion NICHT ausloesen, #472).

# Issue #1085 — Triage (Phase 1)

Status: **erledigt** (2026-08-28T10:42:43Z). Initial-Triage: kein KI-ANALYSE-Block, kein
ai-triage-decision-Kommentar (einziger Kommentar = Quality-Bot). Ampel 🟢, kein Ping-Kommentar
(Auftrag: unambiguous outcome → Body-Block + Labels genügen).

## Erledigt
- Analyse-Block (KI-ANALYSE:START stand=2026-08-28T10:42:43Z … END) + ai-phase-routing-Tabelle
  in den Issue-Body geschrieben (Original-Body unverändert per `gh issue view --jq .body` + cat
  zusammengebaut, bytetreu).
- Labels: `ai:analysed` + `ai:needs-impl` gesetzt, `ai:needs-analyse` entfernt
  (Stand danach: bug, ai:analysed, ai:needs-impl).
- Routing: ux=nein/-/-, spec=nein/-/-, impl=ja/sonnet/medium, review=ja/sonnet/high.
  Begründung ux+spec=nein steht im Block unter „Umsetzungskontext → Stand der Umsetzung":
  PR #1087 existiert bereits mit vollem Test-Vertrag, UX-Entscheidung („mindestens disabled")
  ist im Issue-Body vorgegeben.
- Titel nicht geändert („Bug: Schnellerfassung sollte bei deaktivierter KI implizit deaktiviert
  sein" — korrekt); Body nicht kopierlektoriert (substantiell nichts zu verbessern, kein Pro-forma-Edit).
- Schritt 6 (autonomes Schliessen) geprüft und NICHT ausgeführt: PR #1087 ist OPEN, nicht
  gemerged (mergedAt:null) — Anforderungen sind nicht in main; Fix fehlt auf main verifiziert
  (`isQuickCaptureEffective` nicht in aiPreferences.ts, Switch ohne `_disabled`).
- AK1–AK6 aus Issue-Body („Woran messen wir das?") + Review-/Fixup-Erfahrung formalisiert;
  AK6 = mobile-first 375px.

## Relevante Stellen
- `frontend/src/App.tsx:671` — Anlegen-Gate `quickCaptureEnabled ? <QuickCaptureModal/> : <TaskFormModal/>` (main-Stand).
- `frontend/src/lib/aiPreferences.ts:45` — Default `quickCaptureEnabled: … ?? true` (main-Stand).
- `frontend/src/components/SettingsPage.tsx:337` — Switch `_checked={quickCaptureEnabled}` ohne `_disabled` (main-Stand).
- `frontend/src/components/SettingsPage.tsx:183/241` — Vorhandenes `_disabled`-Muster (pushPending/geoPending) als Vorbild genannt.
- `frontend/e2e/ai-disable.spec.ts` — #1080/#1085-Vertrag (e2e).
- PR #1087 (OPEN, Branch `vibe/fix-1085-ki-schnellerfassung`) — lauffähige Umsetzung; review-Job
  bei Triage IN_PROGRESS, e2e-Shards 1–4 SUCCESS.

## Annahmen
- Routing ux/spec=nein ist die richtige Vermeidung von Doppelarbeit: ein spec-Lauf würde einen
  zweiten Draft-PR mit kollidierenden Test-Dateien erzeugen; impl-Phase soll PR #1087 begleiten
  (Steht so im Analyse-Block — für die impl-Phase bindend gemeint).
- Issue kann geschlossen werden, sobald PR #1087 gemerged ist (Schritt 6 mit PR-Beleg).

## Verworfen
- Autonomes Schliessen (Schritt 6): PR #1087 noch offen, kein merged Beleg → Kriterium nicht erfüllt.
- spec=ja/ux=ja-Routing: würde Phasen 2+3 für bereits umgesetzte, gereviewte Arbeit wiederholen
  und einen zweiten PR mit Merge-Konflikten in genau den Test-Dateien anlegen.
- Copyedit/Titel-Edit: kein substantieller Verbesserungsbedarf → unverändert gelassen.

## Offen
- Temp-Dateien `.ai-memory/issue-1085-triage-body.md` und `.ai-memory/issue-1085-triage-block.md`
  konnten nicht gelöscht werden (rm wurde abgelehnt) — vor/nach Harness-Commit prüfen, dass sie
  nicht mitcommitten werden bzw. dann löschen.
- Impl-Phase (ai:needs-Label gesetzt): PR #1087-Re-Review-Ergebnis beachten; nach Merge Issue
  mit PR-Beleg schliessen.

## Nächster Schritt
- Impl-Phase: PR #1087 begleiten (KEIN zweiter PR/keine zweite Umbau-Runde, siehe Analyse-Block);
  nach Merge: Issue #1085 mit PR #1087 als Beleg schliessen.

## Fallstricke
- Issue-Body enthält jetzt den Analyse-Block — bei Re-Triage nur Delta-Kommentare seit
  stand=2026-08-28T10:42:43Z lesen.
- Die impl-Zeile (sonnet) wird vom Workflow zusätzlich als `ai:model:<class>`-Label gesetzt —
  nicht manuell verdoppeln.
- rm in `.ai-memory/` braucht Approval in dieser Sandbox — Body-Temps besser gar nicht erst
  anlegen, wenn `gh issue edit --body-file -` per Heredoc versagt (diesmal: cat-Append-Trick).

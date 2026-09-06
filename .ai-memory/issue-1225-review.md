# Issue 1225 — Review (PR #1245), Stand 2026-09-06 (Fixup-Nachweis-Lauf → needs-fixup)

**ERGEBNIS: needs-fixup (Fixup-Nachweis).** Kreuzverhör (02:16Z, Sammelkommentar 5555806946)
hatte 2 Blocker; seitdem gab es KEINEN ai-fixup-decisions-Fixup (Läufe crashten, Runden-Deckel,
Mensch übernahm). Einziges Code-Delta: menschlicher Commit `2bcbe4ac` (Group-Typ-Import +
Settings-e2e-Selektoren) + Main-Merge `b1789e3d` (#1226-Einladungslinks: GroupDetail +134 Z.,
app.css-Umbau). Dieser Lauf: Delta-Verifikation → #2-Rotation geheilt (CI komplett grün),
#1 hält als Blocker. Sammelkommentar 5555806946 per PATCH aktualisiert (Review-Typ:
Fixup-Nachweis), Inline-Antworten in beide Threads (3943490014 zu #1, 3943490334 zu #2).

## Erledigt
- MODE: Marker vorhanden → Fixup-Verifikation; keine Claim-Checkliste (`ai-fixup-decisions`
  existiert nicht) → Findings ohne Claim-Row bleiben offen, Delta manuell verifiziert.
- Delta seit 02:16:36Z gesichtet — `2bcbe4ac` (Typ-Import `GroupDetail.tsx:4`; issue-843.spec /
  settings-switch-layout.spec Selektoren wegen main-db8b4427-Klassen-Entfernung; docs) +
  Merge `b1789e3d` + memory-only Commits. Head `9de3c2e1` = 2bcbe4ac + CI-Workflow/heart-glass/
  release-Bump (keine Groups-Dateien) → grüner Run auf 2bcbe4ac ist repräsentativ.
- CI-Beleg: Run 34021557125 (SHA 2bcbe4ac) — e2e (1)–(4) + verify + gate = pass. Rot war
  Run 34005116628 (SHA 8b3159ee): shard 1 = groups-for-each-other AK7/AK8 (=#2), shard 3/4 =
  settings-Specs (vorbestehend auf main, vom Menschen in 2bcbe4ac gefixt).
- #2-Rest gegen Code verifiziert: `handleRoleChange`/`handleRemove` 409-catch weiterhin ohne
  `load()`; `groups-for-each-other.spec.ts:127,183` weiterhin `listitem.click()` (Mitte).
- #1 gegen Code verifiziert: `GroupDetail.test.tsx` ohne `group`-Prop (0 Treffer für
  imageUrl/groups-avatar); `groups.spec.ts:189-200` nur Listen-Avatar; `groups-invite-links.spec.ts`
  (#1226-Merge) assertet keinen Avatar → AK4-Detailhälfte ungetestet, Blocker hält.
- Nits verifiziert: weiterhin alle 3 offen (migrate.test.ts:17+598-600 Cast; GroupsSection.test.tsx:54-64
  TestGroup; openapi.yml ohne maxLength bei imageUrl).
- Titel-Gate: `feat(groups): add group image via https url (#1225)` konform (CC, englisch,
  lowercase, ≤72) — kein Rename.

## Relevante Stellen
- `frontend/src/components/GroupDetail.tsx:109` (`handleRoleChange`, 409-catch ohne reload) — #2-Rest (a).
- `frontend/e2e/groups-for-each-other.spec.ts:127,183` — `listitem.click()` Kartenmitte — #2-Rest (b).
- `frontend/e2e/groups.spec.ts:179-206` — #1225-AK4/AK5-e2e; hier beim #1-Fix das Detail aufklappen
  + `.group-detail-head kol-avatar` asserten (oder Vitest-Render mit `group`-Prop).
- `frontend/src/components/GroupsSection.tsx:215` — `<GroupDetail … group={group} />` wird beim
  Aufklappen immer mit Prop gerendert (Kopf wird also nebenbei ausgeführt, nur nicht verifiziert).
- `docs/spec/issue-1225.md:43-44` — AK4-Vertrag „Liste UND Detailkopf“ = Grundlage für Blocker #1.

## Annahmen
- Grüner Run 34021557125 (e2e 1–4, workers:1, retries:0) ist deterministisch repräsentativ für
  Head 9de3c2e1 (Differenz nur CI-Workflow/heart-glass/package.json-Bump, keine Groups-Dateien).
- #2-Heilung ist koinzidentiell (Geometrie-Verschiebung durch #1226-Merge), nicht beabsichtigt —
  Re-Grading auf nicht blockierend, weil CI grün und der #1223-Vertrag intakt ist; die
  Mechanismus-Analyse des Kreuzverhörs bleibt gültig (s. Fallstricke).

## Verworfen
- #2 als Blocker aufrechterhalten — messbare Rotheit ist weg; Rest ist Robustheit, kein Merge-Stopp.
- Needs-human — #1 ist mechanisch fixbar (eine Assertion/Render), kein Produktentscheid.
- Shard-3/4-Rots (issue-843, issue-865, settings-switch-layout) als Finding — vorbestehend auf
  main, vom Menschen in 2bcbe4ac bereinigt, nicht Diff-attribuierbar.

## Offen
- #1 (Blocker) + #2-Rest (nicht blockierend) + 3 Nits — siehe Sammelkommentar 5555806946.
- Fixup-Runden-Deckel war erreicht („Runde 8 von 3“) — ein weiteres needs-fixup löst ggf. erneut
  den Deckel/Mensch-Pfad aus, nicht automatisch einen Fixup-Lauf.

## Nächster Schritt
- Fixup-Phase (Mensch F.1 oder nach Deckel-Anpassung): #1 über `groups.spec.ts` AK4-Test
  erweitern (Detail aufklappen, `.group-detail-head kol-avatar` mit/ohne `img` asserten) oder
  `GroupDetail.test.tsx` um einen Render mit `group`-Prop ergänzen; #2-Rest-Härtungen
  (409-Pfad → `load()`; Tests auf neutrale Klick-Zone) und Nits günstig mitnehmen.

## Fallstricke
- Playwright-Fehldiagnose steckt in den CI-**Artefakten** (`actions/runs/<id>/artifacts` →
  `playwright-report-shard-N` → zip → `test-results/*/error-context.md`), nicht im Log.
- Karten-Mittelklick-Tests sind layoutfragil — jede Höhenänderung des Details verschiebt die
  Mitte (genau das Muster von #2; die Heilung durch #1226 beweist die Fragilität).
- `POST pulls/1245/comments` mit `--input -`: `in_reply_to` MUSS im JSON-Body stehen, nicht als
  `-F`-Flag (sonst 422 „path/line weren't supplied“). Replies: 3943490014, 3943490334.
- Keine Labels anfassen — Workflow macht das selbst.

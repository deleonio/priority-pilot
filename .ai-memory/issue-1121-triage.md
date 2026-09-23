# Issue 1121 — Triage (Phase 1), Stand 2026-08-29T12:05:59Z

**ERGEBNIS: VERDICT analyzed, Ampel 🟢.** Initial-Triage (kein Harness-Marker, kein ai-triage-decision-Kommentar; einziger Kommentar = github-actions-Qualitätscheck 10:44:24Z, keine Entscheidung). Analyse-Block + Routing-Tabelle als Harness-Kommentar erstellt (https://github.com/deleonio/priority-pilot/issues/1121#issuecomment-5462336838), Labels `ai:needs-analyse` entfernt, `ai:analysed` + `ai:needs-spec` gesetzt (Endstand verifiziert). Kein Ping, kein Titel-/Body-Edit, kein Split, kein Auto-Close (GeoBadge steht noch in der Badge-Gruppe, TaskTree.tsx:108-110).

## Erledigt
- Issue geladen, Trigger als Initial-Triage bestimmt, Body komplett analysiert (Issue liefert Problem, Ziel-Zustand und 6 Messgrößen — hohe Qualität).
- Code-Recherche: `TaskTree.tsx:84-111` (LeafItem-Render: Header Z.87-89, Badge-Gruppe Z.91-111, GeoBadge Z.108-110), `GeoBadge.tsx:84-93` (Vertrag: role=img, aria-label `Standort: …`, data-testid), `CompletedTasksTable.tsx:121-136` + `app.css:1343-1350` (`done-title-cell`-Vorbild), `app.css:947-979` (Header flex, Titel flex:1), `e2e/issue-1063-geo-badge.spec.ts:135-199` (bestehende row-scoped Assertions + 375px-Muster).
- Harness-Kommentar via `gh issue comment --body-file` (Datei `.ai-memory/issue-1121-harness-comment.md`) erstellt; Labelwechsel verifiziert.

## Relevante Stellen
- `frontend/src/components/TaskTree.tsx:108-110` — GeoBadge-Nutzung, WANDERT aus `task-tree-badges` in den Header hinter KolHeading (Z.88).
- `frontend/src/components/TaskTree.tsx:88` — `<KolHeading _label={node.title} … className="task-tree-title" />`; Web Component, `_label` ist String-Prop → NBSP + Icon als Geschwister, nie im Label.
- `frontend/src/app.css:975-979` — `.task-tree-title { flex: 1 1 auto }` schiebt ein flex-Geschwister ans Zeilenende → Titel-Flex muss für Titel+Icon-Gruppierung aufgebrochen werden (Wrapper-Span à la `done-title-cell` oder `flex: 0 1 auto`).
- `frontend/src/app.css:947-953` — `.task-tree-row-header` (flex, gap, min-width:0) — Aufnahmeort des Icons.
- `frontend/src/components/GeoBadge.tsx` — BLEIBT unverändert (AK6-Vertrag).
- `frontend/e2e/issue-1063-geo-badge.spec.ts:135-143` (TaskTree-Assertions), `:146-199` (375px-Muster, Bounding-Box statt scrollWidth), `frontend/e2e/issue-1066-nearby-card.spec.ts:158` — müssen grün bleiben.
- Kein `TaskTree.test.tsx` existiert → Testebene acceptance-e2e.

## Annahmen
- ux=nein begründet im Block: Issue schreibt Ziel-UI exakt vor (Position, U+00A0-Trenner, Verbleib der anderen Badges, A11y-Vertrag) — kein Gestaltungsspielraum für advisory Phase.
- Routing: spec ja/sonnet/medium, impl ja/sonnet/high, review ja/sonnet/medium (einfache, isolierte Änderung — review medium wie #1098-Präzedenz).
- „geschütztes Leerzeichen" = Unicode U+00A0, im JSX als Escape/Entity (nicht roh im Quelltext — Refuse-Prettier/Editor-Stripp-Risiko).

## Verworfen
- Titeländerung („Globus-Icon verschieben") — trifft den Inhalt exakt.
- Body-Copyedit — verboten (ADR 0009) und nicht nötig.
- Split — eine Komponente + e2e, ein PR.
- ux-Phase — s. Annahmen; Issue ist selbst die UX-Entscheidung.
- Auto-Close — Anforderung im Code erkennbar nicht erfüllt (Badge-Gruppe enthält GeoBadge noch).
- MEMORY.md-Eintrag — NBSP/Sandbox-Erfahrung ist Runner-Mechanik, siehe aber dennoch Ergänzung unten (Bash-Scanner-Blocker, wiederkehrende Gefahr für alle Folgephasen).

## Offen
- `.ai-memory/issue-1121-harness-comment.md` ist Wegwerf-Artefakt (gesendeter Stand) — NICHT committen; diese Datei hier ist die Phasen-Notiz.

## Nächster Schritt
- Spec-Phase (Label `ai:needs-spec` gesetzt): rote acceptance-e2e für AK1-AK7 — neue Datei `frontend/e2e/issue-1121-geo-badge-title.spec.ts` oder Erweiterung `issue-1063-geo-badge.spec.ts` (DOM-Reihenfolge, U+00A0-Präsenz/-Abwesenheit, keine geo-badge in `task-tree-badges`, vier Badges unverändert, 375px-Bounding-Box).

## Fallstricke
- KolHeading ist Shadow-DOM-Web-Component: Titel-Text liegt IM Shadow-DOM — DOM-Reihenfolge-Assertions (AK1) müssen sich an Host-Elementen orientieren (KolHeading-Host vs. geo-badge-Span), nicht an inneren Textknoten.
- `.task-tree-title` flex:1 nicht unbeabsichtigt behalten — sonst klebt das Icon rechts statt hinter dem Titel (Kern der Änderung).
- U+00A0 niemals als rohes Zeichen in Quelltext/Tests schreiben (Scanner/Formatter-Risiko) — als `&nbsp;`-Entity bzw. Unicode-Escape im String-Ausdruck.
- Bestehende issue-1063-Assertions sind row-scoped (`task-list-item-<id>` → `getByTestId('geo-badge')`) und überleben den Umzug — nicht „reparieren", sie MÜSSEN grün bleiben.
- 375px-Check mit Bounding-Box (`row.boundingBox()`), nicht scrollWidth (App-Shell clippt overflow-x:hidden, Memory 2026-08-24).

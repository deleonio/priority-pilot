# Issue 1225 — Review (PR #1245), Stand 2026-09-06 (SOFT-ABORT: Zwischenstand)

**STATUS: UNVOLLENDET — Soft-Deadline (1788654464) beim Posten erreicht.** Sammelkommentar (mit
`<!-- ai-review -->`-Marker) steht: issuecomment-5555806946, Review-Status `needs-fixup`
(Zwischenstand), Review-Typ Kreuzverhör. Inline-Review mit Finding #1: review-ID 5123564217.
**Kein Verdict-File geschrieben** (`/tmp/claude-verdict` fehlt absichtlich → Phase läuft erneut).
**WICHTIG für Folge-Lauf:** Marker ist vorhanden, aber es ist KEIN Fixup-Nachweis-Lauf — der
Kreuzverhör-Zwischenstand ist fast vollständig; nur Finding #2 (e2e-Re-Run) ist offen. Task:
Re-Run-Ergebnis prüfen, ggf. Finding #2 in den Sammelkommentar nachziehen (PATCH auf
issuecomment-5555806946), Verdict emittieren (File + Output). KEIN neues Kreuzverhör nötig —
alle AKs sind unten geprüft.

## Erledigt
- MODE = Kreuzverhör (kein Marker beim Start); Diff komplett gelesen (`gh pr diff 1245`, 1004 Z.);
  AKs aus Harness-Kommentar (`<!-- ai-harness -->` auf Issue 1225, KI-ANALYSE + KI-UX + Routing
  ux/spec/impl ja, review ja/sonnet/high).
- AK1 geprüft ✔: `server/src/express/routes/groups.ts` validateImageUrl/PATCH (400-Meldung
  „Die Bildadresse muss beginnen mit https://.", `null` entfernt, presence-Vertrag) + 4 Tests in
  `groups.api.test.ts` + openapi `Group.imageUrl`/`GroupUpdate.imageUrl` (:1766/:1803).
- AK2 ✔: `migrateGroupImageUrl` (migrate.ts:166, PRAGMA-guard, idempotent) + Verdrahtung
  `server/src/index.ts` (:140 Liste, :170 await vor sync) + 3 Tests `migrate.test.ts:595`.
- AK3 ✔: 403/404-Split groups.ts:163-168 + Test `groups-invitations.api.test.ts:426`.
- AK4 Liste ✔ (Vitest `GroupsSection.test.tsx` 2 Tests + e2e), AK5 ✔ (375px Bounding-Box,
  Abweichung dokumentiert). AK4 **Detail** ✗ → Finding #1 (s. unten, Beleg im inline-Kommentar).
- Neighborhood-Research (haiku `recherche`, agentId a7a6152ff189a0a41): kein Test/Code erwartet
  404 für Nicht-Admin-Mitglied (Regression-frei); `groups-dataisolation.test.ts:81` 404 ist
  Nicht-Mitglied, bleibt gültig; `client/src/schema.d.ts` fehlt im Working-Tree (gitignored,
  generate-Pflicht beim Build); `.app-header kol-avatar` app.css:374 nutzt hartes 2rem —
  `.groups-avatar` (app.css:1330) mit `var(--pp-space-6)` ist konsistenter.
- CI-Status beim Abbruch: `e2e (1)` FAIL, `e2e (2-4)`/verify/precheck PASS, review pending.
  Re-Run der fehlgeschlagenen Jobs angestoßen (`gh run rerun 34000889525 --failed`).
- Titel-Gate erledigt: PR umbenannt auf `feat(groups): add group image via https url (#1225)`.
- Sammelkommentar + Inline-Finding gepostet (Details/Zeilen dort).

## Relevante Stellen
- `frontend/src/components/GroupDetail.tsx:131-139` — Detailkopf (Finding #1: ungetestet,
  `group?`-Prop wird in keinem Test gesetzt; e2e-Tests klappen das Detail nicht auf).
- `frontend/e2e/groups-for-each-other.spec.ts:132,192` — die 2 roten CI-Tests (#1223 AK7/AK8),
  NICHT Teil des Diffs; plausibler Diff-Mechanismus nicht erkennbar (Heading-Assertion lief grün
  → Detail öffnete; Task-Text fehlte). Flake-Verdacht, Re-Run klärt.
- `server/src/logics/migrate.test.ts:17-19` + `frontend/src/components/GroupsSection.test.tsx:525`
  — roter-Phase-Auslauf (Namespace-Cast, lokaler TestGroup-Typ) → Nits im Sammelkommentar.
- `frontend/src/app.css:1324-1347` — `.groups-avatar`/`.group-detail-head`, mobile-first ok,
  kein @media, KoliBri-first gewahrt (KolAvatar, `_color` ungesetzt, Shadow-DOM-Begründung).

## Annahmen
- Finding #1 ist Blocker-Klasse (AK4 nennt Gruppendetail ausdrücklich; „Missing tests for an
  acceptance criterion“ verhindert 🟢) — Fixup ergänzt 1 e2e-Schritt ODER 1 Vitest mit `group`.
- e2e-Rot ist Flake (kein Mechanismus, Shards 2-4 grün, main grün) — falls Re-Run wieder rot:
  Regression, dann Stichwort Karten-Klick/Avatar im Exclusion-Selektor.

## Verworfen
- Lokaler e2e-Reproduktionsversuch — keine node_modules im Runner-Sandbox, Build+Browsers zu teuer.
- Weitere Blocker-Suche jenseits AK-Abdeckung — Server/Frontend-Logik des Diffs ohne Befund
  (Validierung, presence-Vertrag, Migration, DTO alle korrekt; Sicherheit: nur https, Admin-only).
- MEMORY.md-Eintrag — kein neuer Fehlerklassen-Befund (Soft-Deadline-Treffer ist kein Memory-Kriterium).

## Offen
- Ergebnis des e2e-Re-Runs (Run 34000889525, failed-jobs) steht aus → Finding #2 final bewerten.
- Finaler Verdict nicht emittiert (Soft-Deadline); Sammelkommentar sagt „needs-fixup (Zwischenstand)“.
- Wegwerf-Artefakte in /tmp (pr1245.diff, review1245.json, collected1245.md) — bewusst nicht im Repo.

## Nächster Schritt
- Folge-Lauf: Re-Run-Status prüfen (`gh run view 34000889525 --json jobs` bzw. `gh pr checks 1245`);
  Finding #2 im Sammelkommentar (ID 5555806946, PATCH) auflösen (grün → „flake, Finding entfällt“;
  rot → Regression, Blocker halten); danach Verdict `needs-fixup` (wg. Finding #1) als
  /tmp/claude-verdict + Output-Zeile; „Review-Typ“ im Footer auf Kreuzverhör lassen.

## Fallstricke
- Nächster Lauf darf den Marker nicht als „Fixup-Modus“ missdeuten: es gab KEINEN Fixup-Commit;
  `ai-fixup-decisions`-Kommentar existiert nicht. Finding-Nummern #1/#2 sind stabil.
- `gh pr comment` hat kein `--jq` (Fehler einmal abgefangen) — plain `--body-file` nutzen.
- `gh api reviews` mit JSON-Datei: `--input`, nicht `-f` (Heredoc-JSON mit Anführungszeichen).
- Review-Tier darf Code NICHT ändern (auch Nits nicht) — nur kommentieren.

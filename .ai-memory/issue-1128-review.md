# PR/Issue 1128 — Review (Kreuzverhör, Runde 1), Stand 2026-08-30

**ERGEBNIS: VERDICT needs-fixup (🟡), genau 1 fixables Finding (Prettier-Format-Check rot).** Inhaltlich 🟢: alle geprüften Ist-Behauptungen code-seitig bestätigt.

## Erledigt
- MODE bestimmt: kein `<!-- ai-review -->`-Kommentar auf PR 1128 → KREUZVERHÖR (Erstreview).
- `closingIssuesReferences` = 0 → **Review ohne Issue**, PR-Beschreibung (Spec-Sync-Report 2026-08-30) ist massgebende informelle Spec.
- Voll-Diff gelesen (`/tmp/pr1128.diff`, 2083 Zeilen): 30 Dateien, alle `docs/spec/*.md`, +380/−1151, 1 Commit 674c5f4b. Reines Docs-PR (Soll→Ist-Umschreibung der Specs), kein Code, keine Tests → Test-Gate entfällt.
- 3 Haiku-Recherche-Agenten (frontend/server/CI): alle Spec-Behauptungen TRUE. Zwei Haiku-„PARTIAL" selbst widerlegt: (a) `_type="search"` liegt in `AddressAutocomplete.tsx:115` (Spec sagt das selbst — meine Claim-Zuordnung war falsch), (b) „Intervall nicht konfigurierbar" ist falsch — `useGeolocation.ts:88-120` lädt `api.getGeoConfig()`, nutzt `intervalMinutes`, Fallback `GEOLOCATION_INTERVAL_MS`, reagiert auf `pp-geo-config-changed` (`:25`).
- Titel-Gate: „docs(spec): Ist-Stand-Sync 2026-08-30" CC-konform, direkter Präzedenz-PR #1056 (identisches Muster, gemergt) → keine Umbenennung.
- CI geprüft: `verify` ROT — Prettier `--check .` scheitert an 6 PR-Dateien: `docs/spec/issue-1077/-1080/-1095/-1098/-704/-948.md` (Job 99199256565).
- Review 5059824585 gepostet (COMMENT, 1 Inline-Kommentar `docs/spec/issue-704.md:7` = Finding 1).
- Sammelkommentar `<!-- ai-review -->` neu erstellt (keiner vorhanden), Status needs-fixup, Review-Typ: Kreuzverhör, „Review ohne Issue" in Zeile 2.

## Relevante Stellen
- PR 1128 Titel „docs(spec): Ist-Stand-Sync 2026-08-30" — CC-konform (type(scope): subject, ≤72); Repo-Präzedenz für deutsche Subjects geprüft.
- Diff-Schwerpunkte: issue-704 (Aufgaben-Tab=flache Blatt-Liste, Baum nur im „Wald"-Tab), issue-1066 (Card rendert gar nicht bei Präferenz aus), issue-1101 (Geo-Push getriggert via POST /geo/position, kein Scheduler), issue-1121 (Geo-Badge hinter Titel, U+00A0), user-journeys.md (30-Zeichen „begrenzt" statt „blockiert"), issue-933 („Standort ermitteln").
- PR-Body dokumentiert selbst „Nicht verifiziert" (issue-843/1051/787-Messungen) + „Offene Unklarheiten" (1066/1111 Serien-Badge, 1101 Scheduler, 1118 Grid-Position) — transparent, kein Finding.

## Annahmen
- Docs-only-Sync: AK-Abdeckung = die im PR-Body gemachten Ist-Behauptungen; Verifikationsstichprobe über Subagenten deckt die riskantesten drift corrections ab.

## Verworfen
- -

## Offen
- -

## Nächster Schritt
- Fixup-Runde (Workflow 05): `pnpm exec prettier --write` auf den 6 Dateien, committen; danach Fixup-Verifikation (nur Finding 1 abhaken + Delta-Diff, kein Voll-ReReview).

## Fallstricke
- Fixup-Runde: Sammelkommentar per API suchen (Marker `<!-- ai-review -->`) und PATCHen, nicht neu anlegen; Finding-Nummer 1 stabil lassen.
- Keine Labels setzen (Workflow macht das).
- „Review ohne Issue" bleibt in Zeile 2 des Sammelkommentars für Folgerunden erhalten.

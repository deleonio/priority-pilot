# PR 1109 — Review (Kreuzverhör Runde 1), Stand 2026-08-29

**ERGEBNIS: VERDICT reviewed, Ampel 🟢.** Docs-Only-PR (ADR-0006-Stub, 146→17 Zeilen, 1 Datei,
+13/−142). Kein Closing-Issue (closingIssuesReferences = 0) → PR-Beschreibung als informelle
Spec; „Review ohne Issue" in Sammelkommentar-Zeile 2 vermerkt.

## Erledigt
- MODE bestimmt: kein `<!-- ai-review -->`-Marker in PR-Kommentaren → Kreuzverhör (Erstreview).
- Alle PR-Behauptungen gegen den Repo-Zustand verifiziert:
  - ADR-Statuszeilen 0001–0008 geprüft — nur 0006 Superseded; Tabelle im PR-Body stimmt exakt.
  - Beleg-SHA `git show fbd9265c…:docs/adr/0006-…md` = 146 Zeilen Volltext (reproduzierbar).
  - Keine Anker-Links auf 0006 (`grep -rn "0006-issue-storage-state-branch.md#"` = 0 Treffer);
    eingehende Links datei-level: `docs/ci-architecture.md:321,454`, `docs/adr/0007-…md:3,5`;
    `.github/actions/setup-claude/action.yml:83,289` + 2 Workflows nennen ADR 0006 nur als
    Plain-Text-Kommentar. H1 unverändert.
  - ADR-0001-vs-0005-Konfliktzitate stimmen wörtlich (0001:17-18 + :52, 0005:106);
    Lösevorschlag zu Recht NICHT umgesetzt (eigenes ADR nötig) → kein Entscheidungs-Finding.
  - `npx prettier --check` über die Stub-Datei: grün.
- Titel-Gate: „docs(adr): Konsolidierungs-Sync 2026-08-29" verletzte Englisch+lowercase-Regel →
  umbenannt zu `docs: stub superseded adr 0006 in 2026-08-29 consolidation sync` (gh pr edit).
- Review (event COMMENT, ID 5057044491) + Sammelkommentar (Marker, genau 1× verifiziert)
  gepostet; Body-Dateien `.ai-memory/pr-1109-{review-body,collected}.md`.

## Relevante Stellen
- `docs/adr/0006-issue-storage-state-branch.md` — die einzige geänderte Datei (Stub: Status,
  Datum, Kern-Absatz, Ersetzungs-Satz, Volltext-Verweis auf git show).
- `docs/ci-architecture.md:321,454` — eingehende 0006-Links (bleiben gültig, datei-level).
- `docs/adr/0007-issue-storage-harness-branch.md:3,5` — Supersession-Gegenstück.
- `docs/adr/0001-…md:17-18,52` vs. `docs/adr/0005-…md:106` — dokumentierter, offen bleibender
  Meta-Test-Konflikt (Lösung = künftiges ADR, z. B. 0009).

## Annahmen
- Docs-Only ohne Test-Pflicht (ADR 0001: Markdown-Inhalt ungetestet) — kein AK-Test-Gate.
- Runner-HEAD ist `pull/1109/merge` (1be3c3e4); `git checkout main -- <file>` scheitert still
  (kein lokaler main-Branch) — Arbeitsbaum blieb unverändert am Stub-Stand (17 Zeilen).

## Verworfen
- Stale PR-Body-Zeile „(lokal, nicht gepusht, kein PR)" als Finding — kosmetisch, betrifft den
  PR-Body nicht den Diff; nur als nicht-blockierender Hinweis im Review-Body genannt.
- CI-Content-Gesundheitsprüfung von 0006-Inhalten in `ci-architecture.md:454` (Session-Filter-
  Detail lebt nur noch in git-history) — inhärente Folge des Stubbens, Link bleibt gültig.
- MEMORY.md-Eintrag — kein neuer Fehler/Experience-Kriterium erfüllt.

## Offen
- `.ai-memory/pr-1109-review-body.md` + `pr-1109-collected.md` sind Wegwerf-Artefakte
  (nicht committen); diese Datei hier ist die Phasen-Notiz.

## Nächster Schritt
- Fixup-Nachweis (falls Fixup gepusht wird): Delta-Review ab Sammelkommentar-updatedAt;
  sonst Merge/CI-Gate übernimmt der Workflow.

## Fallstricke
- Bei Fixup-Runde: „Review ohne Issue" beibehalten — PR-Beschreibung bleibt die Spec.
- Sammelkommentar-ID via Marker-Suche holen und per PATCH updaten, nicht neu erstellen.

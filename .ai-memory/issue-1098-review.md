# Issue 1098 — Review (Kreuzverhör), Stand 2026-08-29

**ERGEBNIS (vorläufig): VERDICT needs-fixup, Ampel 🔴.** MODE = Kreuzverhör (kein `<!-- ai-review -->`-Kommentar vorhanden, Closing-Issue #1098 vorhanden → AKs aus dem KI-ANALYSE-Block). PR = ai/harness/1098, 17 Commits, +1175/−41, 25 Dateien.

## Erledigt
- Titel-Gate: PR-Titel „Geo settings entfernung (#1098)" verletzt Conventional Commits → Rename auf `feat(frontend): server-side geo config, alarm distance, interval (#1098)` (71 Zeichen).
- Issue-Block (AK1–AK7, TF1–TF8) geladen; kompletter Diff (ohne .ai-memory-Notizen) gelesen.
- Verifiziert: `.github/scripts/resolve-escalation.sh` existiert NICHT im Branch (`test -f` → missing), obwohl `04-claude-implement.yml:200-211` ihn aufruft (`|| true` maskiert den Fehler).
- Verifiziert: Schema-Erstellung ausschließlich via `sequelize.sync({force: shouldReset})` (server/src/index.ts:199) OHNE `alter` — Repo-Präzedenz: jede neue Spalte braucht einen `migrateX`-Aufruf in `main()` VOR sync() (migrateUsersAvatarUrl, migrateTaskAddress, migrateLlmProviderKindColumns … aus `logics/migrate.ts`). Der PR fügt 3 neue User-Spalten OHNE Migration hinzu.
- `.geo-range-field`/`.geo-range-value` sind in keinem CSS definiert (grep → 0 Treffer) — bewusst zurückgestellt laut Implement-Notiz.
- TDD-Ordnung erkennbar: `fa49cefa` (rote Spec-Tests) vor den feat-Commits ✓.

## Relevante Stellen (Findings, stabile Nummern)
- F1 🔴 Migration fehlt: `server/src/models/user.ts:15-18` (3 neue INTEGER-Spalten, non-null + Default). Auf Bestands-DBs erzeugt JEDE User-Query (`User.findOne` im Login, `User.findByPk` in tasks.ts:356, geoConfig.ts) `no such column` → Login/Nearby/Geo-Config 500. Fix: `migrateUserGeoConfigColumns(sequelize)` in `server/src/logics/migrate.ts` + Aufruf in `index.ts` vor `sync()`, Muster `migrateTaskAddress`.
- F2 🟠 `04-claude-implement.yml:200-211` ruft fehlendes `resolve-escalation.sh` (immer rot, maskiert); zudem Out-of-Scope für #1098 → reverten oder Script in eigenem Ticket.
- F3 🟠 `frontend/src/components/LlmSettings.tsx:59` + `PillarList.tsx:46` — defensive `?? null`/`?? []` gegen das künstliche api-Proxy-Double (liefert undefined) statt das Double zu fixen; Out-of-Scope, maskiert Mock-Problem.
- F4 🟡 `SettingsPage.tsx:189` `('true' as unknown as boolean)` — Type-Assertion zur Fehlerunterdrückung (Projekt-Konvention verbietet das).
- F5 🟡 `tasks.ts:356-357` `User.findByPk(getUserId(req))` ohne Dev-Pass-Through-Fallback (geoConfig nutzt `resolveGeoUser` → dev@local): im Dev-Modus schreibt PUT /geo-config an dev@local, nearby filtert weiter auf hartcodiertes `?? 5`.
- Hinweis (kein Finding): jede `useGeolocation`-Instanz holt jetzt selbst `GET /geo-config` (3–4 Requests/Seite) und der Intervall-Effekt verschiebt das erste `locate()` bis zum Config-Fetch.

## Annahmen
- `sync()` ohne `alter` fügt keine Spalten zu Bestandstabellen hinzu (Repo-Kommentare index.ts:155-175 bestätigen das als bekannten Fall).
- CI auf dem PR: `verify` + `e2e (1-4)` ohne Conclusion im Rollup (laufend/pending) — Gate entscheidet separat; Inhaltswertung unabhängig davon.

## Verworfen
- needs-human: alle Findings sind konkret fixbar; keine Architektur-/Produktfrage offen.
- CSS-Klassen (`.geo-range-field`) als Finding — laut Implement-Notiz bewusst als Folge-Thema zurückgestellt, funktional ohne Wirkung.
- e2e-AK7-Test als tautologisch — `expect(Number(afterChange)).toBeGreaterThan(5)` guardt den Fall „Pfeiltaste greift nicht".

## Offen
- Review-Kommentare + Sammelkommentar noch zu posten; danach `/tmp/claude-verdict` = needs-fixup.

## Nächster Schritt
- Sammelkommentar `<!-- ai-review -->` anlegen (Review-Typ: Kreuzverhör), Inline-Comments F1–F5, Verdict needs-fixup.

## Fallstricke
- PR-Titel vor dem Verdict renamen (Titel-Gate), Labels NICHT setzen (Workflow macht das).
- Review-Kommentare als EINE Review mit event=COMMENT posten, kein REQUEST_CHANGES.
- Diff-Anker: Zeilen aus dem PR-Head (`git show FETCH_HEAD`) nehmen, nicht aus dem lokalen main-Workspace.

# Issue 1249 — Implement (Phase 4), Stand 2026-09-06

## Erledigt
- Spec-Draft-PR #1255 (Branch `ai/harness/1249`) ausgecheckt; Ampel 🟢 bestätigt (Harness-Kommentar,
  Akteuere/Zeilen stimmen mit Dateizustand überein).
- `server/src/logics/pillarContributions.ts:70` — `arePillarsExistent(pillarIds, userId)`:
  Kontobezug jetzt Pflichtparameter `number | null`; `undefined`-Fallback (globale Prüfung) entfernt,
  `where` direkt `Pillar.count({ where: { id: pillarIds, userId } })` (AK5; `null` matcht keine Säule,
  Sequelize erzeugt `userId IS NULL`).
- `server/src/express/routes/tasks.ts` — POST: frühe Säulen-Prüfung gegen Ersteller entfernt; neue
  Prüfung NACH Empfänger-Auflösung (inkl. 403-Pfad davor) gegen `recipientId ?? userId ?? null`
  (AK1/AK2/AK6). PATCH: Aufruf auf `userId ?? null` (owner-scoped, Verhalten unverändert; nur
  Signatur-Anpassung AK5).
- `server/src/express/routes/series.ts` — POST: Prüfung nach Empfänger-Auflösung gegen
  `recipientId ?? getUserId(req) ?? null` (AK3). PATCH: Prüfung gegen `series.userId ?? null`
  (Eigentümer, nicht Aufrufer; AK4).
- Alle roten Spec-Tests grün: `server/src/express/pillar-ownership.test.ts` 4/4 (AK1–AK4, AK6),
  `server/src/logics/pillarContributions.test.ts` 18/18.
- Gate komplett grün: `pnpm format` 0, `prettier --check` 0, `pnpm lint` 0 (inkl. tsc --noEmit →
  AK5-Signatur abgesichert; ein Zwischenstand-Fehler `series.userId: number | null | undefined`
  wurde zu `?? null` behoben), `pnpm knip` 0 (nur bekannte Konfig-Hints), `pnpm test` 274 pass /
  0 fail (session.test.ts skippt in dieser Sandbox sauber — kein Redis-Problem diesmal).
- e2e übersprungen (reine Server-Validierung, kein UI-Verhalten, keine einschlägige Spec) — im
  PR-Body dokumentiert.
- Commit + Push auf `ai/harness/1249`, PR #1255 ready gesetzt, Body um Implementierungs-Abschnitt
  inkl. AK7-SQL erweitert.

## Relevante Stellen
- `server/src/logics/pillarContributions.ts:70` — neue Signatur `userId: number | null` Pflichtparameter.
- `server/src/express/routes/tasks.ts:478-489` (POST, neue Prüfung), `:558` (PATCH `?? null`).
- `server/src/express/routes/series.ts:420-431` (POST, neue Prüfung), `:502-512` (PATCH, Eigentümer).
- `server/src/express/pillar-ownership.test.ts` — Spec-Vertrag (AK1–AK4/AK6), unverändert gelassen.
- Tabellennamen für AK7-SQL verifiziert: `task_pillars` (taskPillar.ts:55), `series_pillars`
  (seriesPillar.ts:57), `pillars` (pillar.ts:62).

## Annahmen
- `null`-Owner (Dev-Pass-Through ohne Session) mit nicht-leeren `pillars` → 400 ist gewollt
  (AK5: Prüfung ohne Kontobezug unzulässig; `pillars.userId` ist NOT NULL, `IS NULL` matcht nie).
- PATCH /tasks verhält sich unverändert (Task ist owner-scoped geladen; `userId ?? null` entspricht
  dem Eigentümer).
- SQLITE-Dialekt (`IS NOT`) für die AK7-Abfrage im PR-Body; PostgreSQL-Variante (`IS DISTINCT FROM`)
  mit angegeben.

## Verworfen
- `series.userId` direkt (ohne `?? null`) übergeben — Typ ist `number | null | undefined`, tsc-Fehler.
- Eigener Laufzeit-Test für AK5 — nicht testbar ohne Produktivcode-Änderung (Spec-Entscheidung,
  Absicherung über tsc-Gate).
- MEMORY.md-Eintrag — kein neuer Fehler/Umweg; Kriterium nicht erfüllt.

## Offen
- `/tmp/1249-backup/` enthält die Main-Kopien der Phasen-Notizen (vor Branch-Switch gesichert,
  mit Branch-Versionen byte-identisch verifiziert) — kann entfernt werden.

## Nächster Schritt
- Review-Phase: Kreuzverhör des PR-Diffs; AK7-SQL im PR-Body gegen Schema prüfen.

## Fallstricke
- Reihenfolge in beiden POST-Routen ist bindend: Empfänger-Auflösung + 403 VOR der Säulen-Prüfung.
- `validation.pillars !== undefined`-Guard beibehalten — `[]` bleibt erlaubt (trivial true).
- Tests der Spec-Phase nicht anfassen (Separation of Duties); Abweichungen → Test-Pflege-Bedarf im PR.

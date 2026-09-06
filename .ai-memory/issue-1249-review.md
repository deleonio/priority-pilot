# Issue 1249 — Review (Phase 5, Kreuzverhör Runde 1), Stand 2026-09-06

**ERGEBNIS: VERDICT needs-fixup (Ampel 🟡).** Kein `<!-- ai-review -->`-Marker vorhanden →
Kreuzverhör (Erstreview). Inline-Review 5125085793 (2 Kommentare), Sammelkommentar
issuecomment-5558699390 angelegt. Kein Code geändert, nichts committet.

## Erledigt
- Modus bestimmt (Marker-Suche leer), Diff + Issue-#1249-Harness-Kommentar (AK1–AK7) geladen.
- AK1–AK6 verifiziert grün: `NODE_ENV=test npx tsx --test src/express/pillar-ownership.test.ts` → 4/4,
  `pillarContributions.test.ts` → 18/18 (Sandbox: erst `corepack enable` + `pnpm install --frozen-lockfile`
  + `pnpm build:api`, sonst ERR_MODULE_NOT_FOUND sequelize bzw. 15 tsc-Fehler um fehlendes `src/api.d.ts`).
- AK5-Gate: `npx tsc --noEmit` clean; alle 4 `arePillarsExistent`-Callsites (tasks.ts:482/557,
  series.ts:424/505) übergeben den Kontobezug.
- Separation of Duties: `git diff 567b771b f0524c1d -- …test.ts` leer — Impl-Commit fasst Spec-Tests nicht an.
- 403-vor-400-Reihenfolge, `validation.pillars !== undefined`-Guard, Check vor Transaktion: ✓ (Diff-Review).
- Schema empirisch per `PRAGMA table_info` auf synchronisierten Modellen geprüft → **Finding #1 (Blocker)**:
  PR-Body-AK7-SQL nutzt snake_case (`task_id` etc.), Schema ist camelCase (`taskId`, `pillarId`, `userId`,
  `seriesId`); Abfrage stirbt mit `no such column` → AK7 nicht erfüllt. Korrigierte SQL steht im
  Inline-Kommentar (`.ai-memory/issue-1249-implement.md:33`).
- **Finding #2 (Nit)**: „`null` matcht keine Säule / `pillars.userId` ist NOT NULL“ ist falsch —
  `pillar.ts` `userId` nullable, `seedPillars` (index.ts:39) legt 5 NULL-owned Säulen, migrate.ts
  erhält sie („NULL-owned Säulen … bleiben unverändert bestehen“); `IS NULL` matcht im Pass-Through.
  Kein Verhaltensrisiko (ownership-konsistent), nur Doku.
- PR-Titel auf Conventional Commits umgestellt: „fix(server): check pillar contributions against
  owning account (#1249)“ (alter Titel war deutsch ohne type(scope)-Präfix).
- CI geprüft: e2e (1)/(2) + precheck pass.

## Relevante Stellen
- `server/src/logics/pillarContributions.ts:70` — neue Pflicht-Signatur `userId: number | null`.
- `server/src/express/routes/tasks.ts:478-489` (POST-Prüfung gegen `recipientId ?? userId ?? null`),
  `:557` (PATCH `?? null`); `series.ts:420-431` (POST), `:502-512` (PATCH gegen `series.userId`).
- `server/src/models/pillar.ts` (`userId` allowNull: true + Unique-Index), `src/index.ts:39` seedPillars,
  `src/logics/migrate.ts` migratePillarPerUser — Belege für Finding #2.
- Spalten-Namen (camelCase, kein underscored): taskPillar.ts/seriesPillar.ts/task.ts/series.ts — Beleg für Finding #1.

## Annahmen
- e2e-Skip im PR ist gerechtfertigt (reine Server-Validierung, keine UI-Änderung, keine einschlägige Spec).
- Dev-Pass-Through mit `null`-Konto + NULL-owned Säule = gewollt ownership-konsistent (kein AC verletzt).
- AK5-Laufzeittest unmöglich (Compile-time) — Abdeckung via tsc-Gate akzeptiert (Spec-Entscheidung).

## Verworfen
- Duplikat-pillarIds-Zählsemantik (`count !== length` bei doppelten Ids) als Finding — pre-existing,
  von diesem PR nicht berührt.
- TOCTOU (count-Check vor Transaktion) als Finding — pre-existing Muster, FK fängt ab.
- MEMORY.md-Eintrag — kein neues Fehlermuster (Schema-/api.d.ts-Fälle stehen bereits drin).

## Offen
- Fixup muss Finding #1 (PR-Body-SQL auf camelCase) beheben; Finding #2 (Nit) optional mitnehmen.

## Nächster Schritt
- Fixup-Runde: PR-Body korrigieren; danach Fixup-Nachweis (Modus FIXUP VERIFICATION) über
  `<!-- ai-fixup-decisions -->`-Checkliste + Delta-seit `updatedAt` des Sammelkommentars.

## Fallstricke
- Sandbox hat kein pnpm/node_modules: `corepack enable` → `pnpm install --frozen-lockfile` →
  `pnpm build:api` VOR tsc/Test-Läufen im `server`-Verzeichnis.
- Sammelkommentar = issuecomment-5558699390 — bei Folge-Runden PATCHen, nicht neu anlegen.
- Finding-Nummern #1/#2 stabil halten; SQL-Korrektur nur im PR-Body (kein Produktivcode).

# PR 1246 (Issue 1226) — Review (Fixup-Nachweis, 2. Runde), Stand 2026-09-06T01:55Z

**ERGEBNIS: VERDICT reviewed, 🟢.** Marker `<!-- ai-review -->` vorhanden (Kommentar-ID 5555911376, Runde 1 needs-fixup) → Fixup-Verifikation. Alle 3 Claim-Zeilen aus `<!-- ai-fixup-decisions -->` (d7bac7b1) gegen den Fixup-Diff verifiziert; Sammelkommentar per PATCH in-place aktualisiert (ID unverändert). Titel-Gate: „feat(server): join a group via invite link (#1226)" erfüllt Conventional Commits — kein Rename.

## Erledigt
- Modus bestimmt (Marker vorhanden), PR-Metadaten + Kommentare geladen; Auffälligkeit zur Kenntnis genommen: Bot-Kommentar 01:47Z „Fixup-Runden-Deckel erreicht" (F.1/F.2/F.3-Auswahl) — dieser Lauf ist die erneut ausgelöste Review-Runde; nichts zu entscheiden gewesen, alle Claims hielten stand.
- Claim #1 (Frontend fehlte): `GroupJoinPage.tsx` komplett gelesen (4 Zustände, 409 eigenständig, Doppeltap-Guard, 401→`/auth/google/silent?returnTo=/gruppen/beitreten?token=…`), `Root.tsx`-Weiche vor Auth-Gate (`/bahn`-Muster), `GroupDetail.tsx`-Diff (Admin-Bereich „Einladungen", einmal Voll-Blick→maskiert, Revoke-Modal), `openapi.yml` 4 Pfade (1578/1620/1655/1702) + 3 Schemas (2054/2069/2078), `client/src/index.ts`-Aliase, `api.ts`-Fassaden (create/get/redeem/revoke), `app.css` 10 Selektoren.
- E2e grün verifiziert: statusCheckRollup = verify SUCCESS + e2e (1)–(4) SUCCESS auf Head da79628a (Runde 1: AK5 `:54`/AK6 `:106` in Shard 1/4 failed).
- Spec-Test-Unverändertheit: `git diff 90612402 origin/ai/harness/1226 -- frontend/e2e/groups-invite-links.spec.ts` = leer.
- Claim #2: PR-Body gelesen — beschreibt nur existierenden Code, kein GET-Listen-Endpunkt als bewusste Design-Lücke dokumentiert.
- Nit: `inviteLinks.ts` komplett im Diff gelesen — Membership-Check in `sequelize.transaction`, `UniqueConstraintError` → 409.
- Sammelkommentar aktualisiert (Behobene-Anmerkungen-Tabelle mit Verifikationsbelegen je Zeile, keine offenen Findings/Nits, Review-Typ: Fixup-Nachweis).

## Relevante Stellen
- `server/src/express/routes/inviteLinks.ts` — öffentlicher Router; redeem-Transaktion mit In-Tx-Check + UniqueConstraintError→409 (Nit-Fix, Kommentar verweist auf Kreuzverhör #1246).
- `frontend/src/components/GroupJoinPage.tsx` — neue öffentliche Beitrittsseite, Phase-State-Maschine.
- `frontend/src/Root.tsx:142-151` — `/gruppen/beitreten`-Weiche vor Auth-Gate.
- `frontend/src/components/GroupDetail.tsx` — „Einladungen"-Sektion `ownRole === 'admin'`-gegate, Links session-lokal im State.
- `frontend/e2e/groups-invite-links.spec.ts:54,106` — AK5/AK6, jetzt grün.

## Annahmen
- e2e-Shards SUCCESS auf PR-Head = AK5/AK6 grün (statusCheckRollup bezieht sich auf Head-Commit da79628a; Tests in den Shards unverändert übernommen).
- Merge-Commits ffb87d75/b4d0d796/1c7a1ac1 bringen nur main-Sync (Memory-/Fremdlauf-Inhalte), kein substanzielles PR-Delta — Fixup-Commit-Dateiliste (d7bac7b1, 10 Dateien) deckt den inhaltlichen Delta vollständig ab.

## Verworfen
- Erneutes Voll-Kreuzverhör des PR — Fixup-Verifikations-Modus; Server-Teil in Runde 1 geprüft (8 grüne API-Tests, AK1–AK4).
- Titel-Rename — „feat(server)" trifft formatell zu (Conventional Commits erfüllt), Scope-Enge (Frontend inzwischen mit drin) ist keine Regelverletzung.
- MEMORY.md-Eintrag — kein neuer Fehler/Experience-Kriterium erfüllt.

## Offen
- `.ai-memory/issue-1246-comment-body.md` ist Wegwarf-Artefakt (Sammelkommentar-Body für PATCH) — NICHT committen; `rm` bräuchte Freigabe (Muster wie 1083/1095/1098).
- Bot-Kommentar „Fixup-Runden-Deckel" (01:47Z) mit F.1/F.2/F.3-Auswahl bleibt im PR stehen — menschliche Entscheidungsspur, nicht von mir zu bereinigen.

## Nächster Schritt
- Workflow übernimmt: reviewed → CI-Gate/Autolabeling (Labels nicht von Hand gesetzt); Merge beim Menschen bzw. Auto-Merge bei grünem CI+Reviewer.

## Fallstricke
- Sammelkommentar-PATCH braucht die NUMERISCHE Kommentar-ID (5555911376); der GraphQL-/Node-ID-String (`IC_kwDO…`) liefert bei `issues/comments/<id>` 404.
- Body-Übergabe an `gh api` mit deutschem Markdown (Klammern/Anführungszeichen) sicher über Write→Datei + `python3 json.dumps` + `--input -` statt `-f body=` (Bash-Parser, MEMORY 2026-08-24/26).

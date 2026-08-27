# Issue #1060 — Implementierungs-Phase

## Erledigt
- Branch `feat/issue-1060-mistral-default-model` (Spec-Commit `7e83d3e0`) ausgecheckt, Implementierungs-Commit `a0e6f898` gepusht.
- AK1: `server/src/llm/llmProviders.ts` `defaultModel` des Built-ins Mistral → `mistral-small-latest`.
- AK3: Fehlermeldung nennt jetzt das verwendete Modell — `server/src/llm/llm.ts` (`callProvider`, 502-Pfad, Format `${label} (${model}) antwortete mit HTTP …`) UND `server/src/express/routes/llmProviders.ts` Z. 169 + 241 (Test-Button-Route, gleiches Muster; `runtime.model` vorhanden).
- AK4: `server/.env.example` Z. 19 Default-Angabe auf `mistral-small-latest` geändert. `openapi.yml` war bereits korrekt; `docs/server-setup.md:128`/`docs/deployment.md:107` sind nur kommentierte Override-Beispiele (keine Default-Aussage) → bewusst unverändert.
- Test-Pflege: `server/src/express/routes/llmProviders.test.ts:311` (Default-Spiegel `mistral-medium-latest` → `mistral-small-latest`) — von der Spec-Phase übersehen, im PR-Body unter „Test-Pflege-Bedarf“ dokumentiert.
- Gate: format/prettier/lint/knip grün (Pre-Commit-Hook lief erneut grün). `pnpm test`: Server 687/688 pass, 0 fail; Frontend-Vitest 414 passed/13 skipped.
- PR #1062: Body erweitert (Implementation + Gate-Ergebnisse + Test-Pflege), `gh pr ready` ausgeführt — OPEN, draft=false.
- Memory-Snapshot geschrieben.

## Relevante Stellen
- `server/src/llm/llmProviders.ts` (defaultModel Mistral) — AK1-Ankerpunkt.
- `server/src/llm/llm.ts` `callProvider()` 502-Meldung — AK3 im LLM-Aufruf-Pfad.
- `server/src/express/routes/llmProviders.ts` `runProviderTest()` + models-Route — AK3 im Test-Button-Pfad.
- `server/src/llm/llmProviderActivation.test.ts` — AK1/AK2/AK3-Unit-Tests (Vertrag).
- `server/src/express/routes/llmProviders.test.ts:179,311` — Default-Spiegel-Absicherungen.

## Annahmen
- `docs/server-setup.md:128` / `docs/deployment.md:107` (`# MISTRAL_MODEL=mistral-medium-latest`) sind ENV-Override-Beispiele, keine Default-Behauptung → AK4 ohne Änderung erfüllt.
- Nutzer mit persistierter Wahl `mistral-medium-latest` (DB `provider.model`) sind vom Default-Fix nicht betroffen; bewusst so (PR-Body dokumentiert den Hinweis).
- e2e übersprungen: keine UI-Verhaltensänderung, kein passender e2e-Spec.

## Verworfen
- Änderung an `server/src/test/helpers.ts:28` (explizites Modell `mistral-medium-latest` im Seed) — bewusste Modellwahl im Test-Seed, kein Default-Spiegel.
- Regenerierung/Anpassung von `server/src/api.d.ts` + `client/src/schema.d.ts` — generiert aus `openapi.yml`; die `z.B. mistral-medium-latest`-Stellen sind Beispiele, keine Default-Aussagen. (Lefthook-Lint regeneriert `api.d.ts` ohnehin.)
- Fix am Redis-Suite-Marker — pre-existing, umgebungsbedingt, außerhalb des Scopes.

## Offen
- Review-Phase: PR #1062 ist ready, Cross-Examination ausstehend.

## Nächster Schritt
- Review-/Fixup-Phase: PR #1062 diff kreuzverhören; CI prüfen (`gh pr checks 1062`).

## Fallstricke
- `server/src/express/session.test.ts` „AK-5 — Redis-Store“ schlägt LOKAL fehl (401≠200, Suite-Marker ✖ trotz `fail 0`): Test-Body läuft nach `t.skip()` weiter, zwei Server-Instanzen ohne geteilten Redis-Store. Reproduzierbar auf dem Stand VOR dem Implementierungs-Commit — nicht als Regression dieses PRs werten; CI hat Redis als Service.
- Git-Autorenidentität ist im Runner nicht konfiguriert → Commit mit `-c user.name="my-github-action-bot[bot]" -c user.email="295279188+my-github-action-bot[bot]@users.noreply.github.com"` (Identität aus `git log` der Vor-Commits).
- Soft-Deadline lief während des Gates über — Gate-Ergebnisse im PR-Body sind die der vorherigen (vollständigen) Läufe; der Pre-Commit-Hook hat format/knip/lint beim finalen Commit erneut grün bestätigt.

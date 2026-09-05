# Issue 1238 — Review (Phase 5), Stand 2026-09-05

**ERGEBNIS: VERDICT reviewed, Ampel gruen (Modus Kreuzverhör, Erst-Review).** Keine Blocker, keine Nits mit Gewicht. Sammelkommentar (ai-review) neu angelegt. Titel-Gate: PR-Titel auf fix(server): sync google display name into users on oauth login (#1238) umbenannt (war deutsch/prosa, CC-Verstoss, 71 Zeichen).

## Erledigt
- MODE: kein ai-review-Kommentar auf PR 1241 -> Kreuzverhör (Erst-Review).
- Diff vollstaendig gelesen (9 Dateien, +367/-9): neu server/src/logics/oauthUser.ts (upsertOAuthUser), Verify-Callback server/src/express/index.ts:169-183 umgestellt, 2 neue Testdateien, Spec-Doc, 4 Phasen-Notizen.
- ACs aus Harness-Kommentar (ADR 0009, stand=2026-09-05T19:25:04Z): AK1-AK4.
- AK-Abgleich: AK1 Test oauth-user.test.ts TF1; AK2 TF1/TF1b + manuell index.ts:174-181 verifiziert (done()-Payload aus user.*); AK3 profile-group-members.test.ts (HTTP-Vertrag PUT /profile -> members); AK4 TF3.
- Trennung der Zustaendigkeiten: git diff 443554345 4a3451fc0 -- <beide Testdateien> LEER -> Spec-Tests nicht verwaessert; Commit-Reihenfolge test-first (4435543 test: red spec tests -> 279bf636 fix(server)).
- Regression/Test-Pflege: kein bestehender Test widerspricht dem neuen Sync (grep server/src/express/*.test.ts -> nur /auth/test-login-Pfade, separater findOrCreate); User-Import aus index.ts entfernt und nirgends mehr genutzt.
- /auth/google/silent laeuft ueber denselben gemeinsamen Callback (routes/auth.ts:161-175 passport.authenticate google) -> Fix gilt auch fuer stillen Login.
- CI: Verify SUCCESS auf Head-SHA 4a3451fc0 (server 849 / frontend 274 laut PR-Body), e2e-Shards 3/4 SUCCESS, 1/2 pending (nichts rot), 05 Review in_progress = dieser Lauf.
- Lokaler Testlauf NICHT moeglich: Sandbox hat keine node_modules (ERR_MODULE_NOT_FOUND: Cannot find package tsx) -> CI verify als Autoritaet.
- Keine inline review comments gepostet — keine Blocker, keine Nits, die eine Verankerung verdienen.

## Relevante Stellen
- server/src/logics/oauthUser.ts:31-44 — Extraktions-Seam; Update-Trigger (displayName!==resolved || avatarUrl!==avatar) schreibt beide Felder zusammen (harmlos, wenn nur eins abweicht).
- server/src/express/index.ts:169-183 — isEmailAllowed bleibt VOR dem Upsert; done()-Payload jetzt aus DB-Zeile (Kern AK2).
- server/src/logics/oauth-user.test.ts — 3 Tests mit echten DB-Asserts (nicht tautologisch).
- server/src/express/profile-group-members.test.ts — AK3-Regression, vorher schon gruen (im PR-Body dokumentiert), jetzt versiegelt.

## Annahmen
- CI verify SUCCESS deckt gruene Tests ab (lokale Reproduktion durch fehlende node_modules unmoeglich).
- Google-Profil bleibt Master beim Login (app-seitiger Name wird beim naechsten Google-Login ueberschrieben) — dokumentierte Randbedingung aus Triage/Analyse-Block, kein Finding.

## Verworfen
- as-string-Cast in index.ts:172 — VORHANDENE Kontextzeile, nicht Diff-Kern -> kein Nit.
- Manuelle Objektauswahl in der Rueckgabe von upsertOAuthUser statt ganzes Model — bewusst explizit, gutes Muster -> kein Nit.
- AK3-Test waehlt role===admin statt eigener userId — Gruppe hat genau ein Mitglied (Creator), aequivalent -> kein Nit.
- /auth/test-login auf upsertOAuthUser umstellen — separater Pfad ohne Avatar-Sync, von Spec bewusst verworfen.
- MEMORY.md-Eintrag — kein neuer Fehler; Sandbox-ohne-node_modules durch Eintraege 2026-08-29/2026-09-05 abgedeckt.

## Offen
- Wegwerf-Artefakte .ai-memory/issue-1238-review-prbody.md und .ai-memory/issue-1238-review-harness.md (Kopien) — NICHT committen; nur diese Datei ist die Phasen-Notiz.

## Naechster Schritt
- Pipeline: e2e-Shards 1/2 + Gate laufen lassen; bei Gruen automatischer Merge. Kein Fixup noetig.

## Fallstricke
- Test-Run im Sandbox-Checkout scheitert an fehlendem tsx — nicht als roten Test fehlinterpretieren (Exit 1, ERR_MODULE_NOT_FOUND = Umgebung, nicht PR).
- Head-SHA des PRs ist 4a3451fc0 (memory: implement), Fix-Commit ist 279bf636 — Verify muss auf 4a3451fc0 geprueft werden (dort war Verify auf 279bf636 cancelled).
- Titel-Gate: (#1238) im Titel kostet 8 der 72 Zeichen — Subjekt knapp halten.

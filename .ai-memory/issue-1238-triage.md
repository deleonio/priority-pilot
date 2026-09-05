# Issue 1238 — Triage (Phase 1), Stand 2026-09-05

**ERGEBNIS: VERDICT analyzed, Ampel 🟢.** Initial-Triage (kein Harness-Kommentar, kein `<!-- ai-triage-decision -->`; einziger Kommentar = ai-quality-Bot 15:18:55Z, keine Entscheidungen). Analyse-Block + Routing-Tabelle als Harness-Kommentar angelegt (https://github.com/deleonio/priority-pilot/issues/1238#issuecomment-5554223957), Labels `ai:needs-analyse` entfernt, `ai:analysed` + `ai:needs-spec` gesetzt (ux=nein → direkt Spec). Titel 1× substantiell korrigiert: „Eindeutig Name auch bei Gruppenmitgliedern" → „Gruppenmitgliederliste zeigt veralteten Profilnamen". Kein Ping, kein Body-Edit, kein Split, kein Auto-Close (Sync-Lücke live im Code).

## Erledigt
- Issue + alle Kommentare geladen, Trigger = Initial-Triage bestimmt.
- Code-Recherche: `server/src/models/groupMember.ts` + `group.ts` + `groupInvitation.ts` (keine Namens-Spalten — Ticket-Hypothese widerlegt), `server/src/express/routes/groups.ts` komplett (Mitgliederliste/Einladungen/Tasks lesen Namen live via `displayNameOf` :236 aus `User`), `routes/profile.ts` (PUT schreibt DB + Session), `routes/auth.ts` (Login-Session aus DB :118), `server/src/express/index.ts:162-186` (**Ursache**), `frontend/src/components/GroupDetail.tsx` (Fetch bei Mount/refreshKey, kein Cache), `frontend/vite.config.ts` PWA (kein runtimeCaching — API immer Netz).
- Harness-Kommentar via `.ai-memory/issue-1238-comment.md` + `gh issue comment --body-file` erstellt, Landing verifiziert (4 Marker je 1×).

## Relevante Stellen
- `server/src/express/index.ts:164-184` — GoogleStrategy-Verify: `displayName = profile.displayName ?? email` (:170), `findOrCreate` mit defaults (:173-176), nur avatarUrl-Sync für Bestandsnutzer (:177-179), `done(null, {…, displayName, …})` füttert Session mit der GOOGLE-Variable statt der DB-Zeile (:180). Hier kommt der Fix rein.
- `server/src/express/index.ts:177-179` — avatarUrl-Sync = das Muster, das der displayName-Sync kopiert (Google-Profil = Master der Profilfelder beim Login).
- `server/src/express/routes/groups.ts:245-257` — GET /groups/:id/members, Live-Lese aus `User`; unverändert, nur Verifikationsziel (AK3).
- `server/src/express/routes/profile.ts` PUT — schreibt `users.displayName` + Session mit; beweist, dass App-seitiges Umbenennen längst live wirkt (Symptom kann nur aus dem OAuth-Pfad stammen).
- `server/src/express/routes/auth.ts:118` — Passwort-Login setzt Session aus DB-Zeile (Vorbild für done()-Fix).
- `/auth/google/silent` (auth.ts:157-183) — stiller Re-Login bei App-Start macht die Lücke bei jedem Start wirksam (eigene Kopfzeile = neuer Google-Name, Gruppen = alter DB-Name).

## Annahmen
- Ursachen-Szenario: Namensänderung geschah im Google-Profil (nicht über die App-Einstellungen) — nur dann ist das gemeldete Symptom im Code erklärbar; App-seitige Änderung wirkt bereits live. Fix deckt beide Richtungen ab (DB = einzige Quelle, Google synct beim Login hinein).
- Google-Profil bleibt Master beim Login (Präzedenz avatarUrl-Sync); ein app-seitig gesetzter Name wird beim nächsten Google-Login vom Profilnamen übernommen — als Randbedingung im Analyse-Block verankert, keine offene Frage.
- Extraktion des Verify-Bodys in eine testbare Unit (z. B. `server/src/logics/oauthUser.ts`) ist der Weg zu roten Tests; OAuth-Flow selbst ist in node:test nicht fahrbar (dafür existiert /auth/test-login, greift hier aber nicht, weil es den Verify-Callback umgeht).

## Verworfen
- needs-human — Ursache im Code nachgewiesen, Fix mustergleich, AKs prüfbar; die einzige Interpretationsfrage (wo der Autor umbenannt hat) ändert die Fixrichtung nicht.
- Frontend-Anpassung — GroupDetail fetched bei Mount, kein Cache, kein SW-API-Caching; nichts zu ändern.
- Split — ein Server-Fix + Tests, ein PR.
- MEMORY.md-Eintrag — kein neues Werkzeug-/CI-Problem; Kriterium nicht erfüllt.

## Offen
- `.ai-memory/issue-1238-comment.md` ist Wegwerf-Artefakt (Kommentar-Body), NICHT committen; nur diese Datei hier ist die Phasen-Notiz.

## Nächster Schritt
- Spec-Phase (Label `ai:needs-spec` gesetzt): rote Tests TF1/TF3 (neu, gegen extrahierte OAuth-User-Logik) + TF2-Vertragstest (PUT /profile → members zeigt neuen Namen).

## Fallstricke
- `done()`-Fix: nach `user.update()` die aktualisierte Instanz nutzen (Sequelize-`update` gibt sie zurück), sonst Session erneut aus Stando-Werten.
- Verify-Extrahieren darf `isEmailAllowed`/`hasGoogleOAuth()`-Gates in `index.ts` nicht verschieben — Registrierung der Strategie bleibt konditional.
- Keine Umlaute/typografischen Anführungszeichen in Routing-Tabelle (maschinen-gelesen).
- Session displayName übernehmen wie bisher in den Callback-Regenerate-Fluss (`auth.ts:204-229` liest `req.user`) — done()-Payload-Form `{id, email, displayName, avatarUrl}` beibehalten.

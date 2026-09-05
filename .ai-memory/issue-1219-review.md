# Issue 1219 — Review (Phase 5, Kreuzverhör Runde 1), Stand 2026-09-05

**ERGEBNIS: VERDICT needs-fixup (🔴).** Modus Kreuzverhör (kein `<!-- ai-review -->`-Marker vorhanden). Issue #1219 per closingIssuesReferences verknüpft, AKs aus Harness-Kommentar (issuecomment, stand 2026-09-05T02:15:42Z). Titel-Gate: alter Titel „Anzeigenamen selbst festlegen (#1219)" verletzt Conventional Commits → via `gh pr edit` umbenannt.

## Erledigt
- Voll-Diff gelesen (875 Zeilen, 15 Dateien inkl. Phasen-Notizen). Server-Route `server/src/express/routes/profile.ts`, Unit-Tests, api.ts, Root.tsx-Event, SettingsPage-Feld geprüft.
- CI-Status verifiziert: `verify` grün, **e2e Shard 3+4 ROT** (Run 33942799193). Failures identifiziert:
  - Shard 3: `profile-display-name.spec.ts:44` toContainText → received "E1" (Initialen, erwartete Rot) UND `issue-843.spec.ts:51` AK1 Spacing 147.125 ≠ 16 (**Regression**).
  - Shard 4: `settings-action-buttons.spec.ts` AK2–AK5 (4 Failures, strict-mode: `.settings-general > kol-button` resolved to 2 elements) (**Regression**).
- Baseline verifiziert: PR #1218 (zuletzt gemergt) hatte alle 4 e2e-Shards grün → beide Regressionen sind NEU mit #1233.
- Root cause der Regressionen: neuer KolButton (SettingsPage.tsx:322) + KolInputText als DIREKTE Kinder von `.settings-general` — #1017-Locator (`pushButtonHost`, settings-action-buttons.spec.ts:136) und #843-Control-Liste (issue-843.spec.ts:33) zählen direkte Kinder.
- Avatar-Diagnose der Impl verifiziert: App.tsx:663 `<KolAvatar _label={user.displayName}>` in `.app-header__user`, Full-Name per #865 bewusst entfernt; Präzedenz `header-appearance.spec.ts:33-39` (`toHaveAttribute('_label', …)`). → Spec-Korrektur Zeile 44 vom Review FREIGEGEBEN (Test-Pflege-Bedarf der Impl thus aufgelöst, ohne needs-human — #865 ist dokumentierte Menschen-Entscheidung, Initialen+Label ist die einzige mögliche Ausprägung).
- Session-Pflege (auth.ts `/auth/me` liest Session), test-login legt avatarUrl nur in Session (auth.ts:287) — session-first in `toProfileDto` korrekt. requireAuth mountet bei express/index.ts:201, profileRouter :214 dahinter → AK5 gedeckt.

## Relevante Stellen
- `frontend/src/components/SettingsPage.tsx:306-328` — neue KolInputText+KolButton direkt in `.settings-general` (slot="tab-0"); Fixup: in Wrapper-Div (z. B. `.settings-profile`) stecken.
- `frontend/e2e/settings-action-buttons.spec.ts:136` — `pushButtonHost = page.locator('.settings-general > kol-button')` (Genau-1-Vertrag #1017/#1151).
- `frontend/e2e/issue-843.spec.ts:33` — Control-Liste `.settings-general > kol-input-radio, .settings-general kol-input-checkbox, .settings-general > kol-button`, Gap 16px gemessen.
- `frontend/e2e/profile-display-name.spec.ts:44` — rot; Korrektur: `toHaveAttribute('_label', uniqueName)` auf `.app-header__user kol-avatar`.
- `server/src/express/routes/profile.ts:13-20,60-70` — extractDisplayName (trim, 60er-Grenze, Destructuring) + Session-Pflege; korrekt, keine Server-Findings.
- `frontend/src/Root.tsx:53-66` — PROFILE_CHANGED_EVENT-Listener, statt checkAuth (begründet in PR-Body, nachvollziehbar).

## Annahmen
- Wrapper-Fix behebt beide Regressionen ohne Test-Änderung: beide Selektoren zählen nur direkte Kinder; `.settings-action-btn` (mobile Vollbreite) wirkt im Block-Wrapper unverändert; #1219-e2e-Selektoren sind attributbasiert und bleiben findbar. Vom Fixup per Shard-3/4-Lauf zu belegen.
- e2e-Baseline: „Claude PR Gate & Auto-Merge" auf main = success + PR #1218-Shards grün ist hinreichender Beleg, dass #843/#1017 vorher grün waren.

## Verworfen
- needs-human für die AK7-Kopfzeilen-Frage — #865 (Full-Name entfernt) ist eine dokumentierte Menschen-Entscheidung; Initialen+_label ist deren konforme Umsetzung, keine neue Produktfrage.
- Weitere Server-Findings (Mass-Assignment, Auth, Validierung) — AK1–AK5-Tests grün in CI (`verify` pass), Code folgt geoConfig-Muster korrekt.
- Eigene Titel-Interpretation statt Vorgabe — Titel nach Gate-Regel umbenannt (feat(frontend,server), Englisch, klein, ≤72).

## Offen
- Fixup-Runde muss liefern: (1) Wrapper um Feld+Button (beide Regressionen), (2) Spec-Korrektur Zeile 44 (freigegeben), danach e2e Shard 3+4 grün.

## Nächster Schritt
- Fixup (Label `ai:needs-changes` → Workflow): Finding 1 + 2 aus dem Sammelkommentar umsetzen, `npx playwright test` für settings-action-buttons/issue-843/profile-display-name gegenprüfen.

## Fallstricke
- Fixup darf die bestehenden Specs #843/#1017 NICHT umpunkten (Locatoren lockern) — Produktcode-Wrapper ist der Weg; Test-Änderungen nur mit neuer Begründung.
- Der Spec-Kommentar in SettingsPage.test.tsx („Root → checkAuth") beschreibt den ALTEN Mechanismus — Impl nutzt Profil-Event (als Nit gemeldet, nicht blockierend).
- Beim Wrapper: nicht versehentlich `.settings-switch-row` verwenden (e2e-Guard zählt genau 3 Zeilen, #971).

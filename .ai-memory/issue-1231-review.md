# Issue 1231 — Review (Phase 5), Stand 2026-09-05

**ERGEBNIS: VERDICT reviewed (🟢 mit 2 Nits, nicht blockierend).** Kreuzverhör-Runde 1 (kein `<!-- ai-review -->`-Marker vorhanden → Initial-Review des vollen Diffs). Review 5119519626 (COMMENT, 2 Inline-Nits) + Sammelkommentar 5548968818 gepostet. PR-Titel auf Conventional Commits umbenannt („feat(frontend,server): session-expired dialog with silent re-login"). Labels nicht angefasst.

## Erledigt
- MODE-Klausel: Marker-Suche in `issues/1232/comments` → kein Treffer → CROSS-EXAMINATION. Closing issue = #1231 (AK1–AK5 aus Harness-Kommentar extrahiert).
- Vollen Diff gelesen (`.ai-memory/issue-1231-review-diff.patch`, 24 Dateien): Event-Vertrag in `apiError.ts:78-82` (`message === SESSION_TEXT` → 1× `pp:session-expired` auf window), `SessionExpiredDialog.tsx` (flushSync, Dedup, SESSION_RELOAD_KEY vor reload), `Root.tsx:77-81` (Bonus-Bypass) + `:65` (SILENT_ATTEMPTED_KEY-Reset bei erfolgreicher Auth), `Root.tsx:100-107` (returnTo am Silent-Redirect), `silentReturnPath.ts` (sanitize: führender `/`, kein `//`, kein `\`), `auth.ts:167-174,206-216,227` (silentReturnTo in Session, vor regenerate gesichert + gelöscht, Erfolgs-Redirect `silentReturnTo ?? '/'`).
- Test-Pflege verifiziert: `state.authed`→`state.value` in `issue-1231-session-reload.spec.ts` war ein echter Spec-Bug (Setter war No-op, Assertion unberührt — legitim dokumentiert); `silent-login.spec.ts`-Glob-`*`-Suffix = Mock-Plumbing (MEMORY 2026-09-05).
- CI zum Review-Zeitpunkt pending (e2e×4, review, verify) — nicht rot; merge-gate hält bis grün. Lokale Gates laut PR-Body grün.
- Titel-Rename via `gh pr edit` ( alter Titel war kein Conventional Commits).

## Relevante Stellen
- `frontend/src/lib/apiError.ts:78` — Nit 1: wertbasiertes Event-Gate (stat `status === 401 &&` robuster, heute unerreichbar).
- `frontend/src/Root.tsx:81` — Nit 2: SESSION_RELOAD_KEY-Bonus überspringt ALLE shouldAttemptSilentLogin-Guards inkl. URL-Parameter; Journey-sicher, Edge nur bei lingerndem Marker.
- `.ai-memory/issue-1231-review-collected.md` / `-body.md` / `-payload.json` / `-diff.patch` — Wegwarf-Artefakte dieses Laufs, NICHT committen.

## Annahmen
- PR-Body-Testzahlen (569/274 grün, 7 e2e grün) stimmen; CI bestätigt ausstehend, aber merge-gate degraded bei Rot selbst auf ai:needs-changes → reviewed trotz pending vertretbar.
- Nit 2 ist verhaltensrelevant nur in einem nicht über den Dialog erreichbaren Pfad → bewusst Nit, kein Blocker.

## Verworfen
- Blocker-Suche in .ai-memory/docs-Dateien des Diffs — Artefakte des Workflows, kein Produktivcode.
- `silentReturnTo`-Stale-Wert im Failure-Pfad als Finding — bewusst dokumentierte Abweichung (analog silentPending-Bestand), im Sammelkommentar nicht aufgeführt.

## Offen
- Falls CI rot läuft, greift der Workflow selbst (ai:needs-changes → fixup), kein Review-Nachtrag nötig.

## Nächster Schritt
- Workflow: merge-gate auf CI grün warten → ai:ready-to-merge.

## Fallstricke
- **`gh api -f body=@file` expandiert `@` NICHT** (nur `-F`) — ist diesem Lauf wieder passiert (Sammelkommentar kurzzeitig Literal-String, per PATCH + `-F` repariert). Stand schon in issue-1231-ux.md, wurde aber vom Kontext-Deckel (20k-Cap) übersprungen → jetzt auch in MEMORY.md.
- Review-Post mit Inline-Kommentaren braucht `--input` + jq-JSON (`-f` kann keine Arrays); Body-Strings per `--rawfile`.

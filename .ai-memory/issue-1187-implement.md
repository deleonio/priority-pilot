# Issue 1187 — Implementierung (Phase 4), Stand 2026-09-03

**ERGEBNIS: Implementierung abgeschlossen.** Branch `ai/harness/1187` (Spec-Commits
`6ceeb530`+ fortgeführt), Draft-PR **#1195** review-ready gemacht (`gh pr ready 1195`,
Body erweitert). Unit: SettingsPage 21/21 grün (AK1 ×2, AK4), reducedMotion 2/5 grün —
AK2c/d/e bewusst rot (Test-Pflege-Bedarf, s. u.). E2E + Gate-Ergebnisse im PR-Body.

## Erledigt
- Spec-Modul gebaut: `frontend/src/lib/reducedMotion.ts` — Hook `usePrefersReducedMotion()`,
  Listener-Muster wie `theme.ts:92-103` (matchMedia change + Cleanup), zusätzlich
  `typeof mediaQuery.addEventListener === 'function'`-Guard (Legacy-Stubs werfen sonst
  TypeError im Effekt und reißen auch AK2a/b mit).
- Banner in `frontend/src/components/SettingsPage.tsx`: `KolAlert _type="info"` mit
  `_label="Bewegung reduzieren aktiv"` + Body „…unabhängig vom Schalter „Animationen"."
  in der `settings-switch-row` des Animationen-Schalters (tab-0), bedingtes Rendern über
  `prefersReducedMotion` (Hook-Zeile ~:109). Kein `_disabled` am Schalter (AK4).
- Ziel-Unit-Läufe: `npx vitest run src/lib/reducedMotion.test.ts src/components/SettingsPage.test.tsx`
  → 21 passed, 3 failed (nur AK2c/d/e).

## Relevante Stellen
- `frontend/src/lib/reducedMotion.ts` — NEU, kompletter Hook (AK2).
- `frontend/src/components/SettingsPage.tsx` — Import :6, Hook-Nutzung nach :107 (Animations-Hook),
  Banner-Block in der Animationen-switch-row (~:285-295).
- `frontend/src/lib/theme.ts:92-103` — Listener-Muster-Vorlage (unverändert).
- `frontend/src/lib/confetti.ts:78` — Reduce-Frühcheck (AK3/AK5, unverändert, Dedup lt. Spec).

## Annahmen
- AK2c/d/e bleiben rot und werden über den Test-Pflege-Bedarf-Block im PR-Body getragen
  (Regeln des Lauf-Prompts + Präzedenz #1118/PR #1120: Test nicht anfassen, file:line +
  Begründung dokumentieren). Vorschlag im PR-Body: Fake-MQL um addEventListener/
  removeEventListener verkabelt zur `listeners`-Menge ergänzen.
- Banner-Wortlaut war lt. Spec-Abgrenzung freigegeben; verbindlich waren nur `_type="info"`,
  Platzierung tab-0, Thema „Bewegung reduzieren" im Text (E2E-Locator `hasText`).

## Verworfen
- Produktionscode, der den Fake-MQL patcht (`Object.defineProperty(mql,'addEventListener')`),
  um AK2c/d/e grün zu machen — Test-Gaming, kein echtes Verhalten (Präzedenz #1118:
  ref-Callback-setAttribute ebenfalls verworfen).
- Test-Fixture selbst reparieren — Separation of Duties; Test-Pflege-Bedarf stattdessen.

## Offen
- E2E `issue-1187-reduced-motion.spec.ts` **grün** (exit 0, 39,6 s). Gate-Volllauf: format/
  prettier/lint/knip grün; `pnpm test` 513 passed / 3 failed (nur AK2c/d/e) / 13 skipped,
  Server separat 781/0 grün. Commit + Push + `gh pr ready 1195` + Body-Update erledigt.

## Nächster Schritt
- Review-Phase: PR #1195 kreuzverhören; Test-Pflege-Bedarf (AK2c/d/e-Fixture) ggf. als
  eigener Pflege-Fix nach menschlicher Freigabe.

## Fallstricke
- Der Fake-MQL in `reducedMotion.test.ts:30-40` hat KEIN addEventListener — jeder Hook ohne
  Guard wirft im Effekt. Guard lassen, sonst rot für AK2a/b.
- Push-Info-Banner ist ebenfalls `_type="info"` in tab-0 — Banner-Assertions müssen auf
  Text „Bewegung reduzieren" filtern (tun sie, SettingsPage.test.tsx:479-484).
- PR-Body per `gh pr edit --body-file` mit Datei aus `.ai-memory/` (Bash-Klammer-Falle).
- Pre-Commit läuft tsc über den Frontend-Workspace — reducedMotion.ts typet sauber; knip
  sollte jetzt still sein (Modul wird von SettingsPage importiert).

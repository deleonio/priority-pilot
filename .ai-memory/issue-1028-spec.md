# Issue #1028 — Spec-Phase (2026-08-25)

## Erledigt
- Spec-Phase komplett: `docs/spec/issue-1028.md` + rote Tests `frontend/e2e/issue-1028-alert-host-padding-radius.spec.ts` als Commit e203bf5c auf Branch `feat/issue-1028-alert-host-padding-radius`, gepusht. Draft-PR **#1030** (verlinkt Closes #1028, Verknüpfung verifiziert). Lefthook (format+knip+lint inkl. `tsc --noEmit` für e2e) grün.

## Relevante Stellen
- `frontend/e2e/issue-1028-alert-host-padding-radius.spec.ts` — 2 Tests: T1 (AK1/AK2/AK5, rot): computed padding/radius je >0 und ≤8px am Host, alle sichtbaren Alerts + Dark-Theme-Gleichheit; T2 (AK3, Schutz-Test, initial grün): 320px kein Container-/Dokument-Overflow.
- `frontend/src/app.css:1879–1904` — #930-Block, Anker für den neuen #1028-Host-Regelblock (Impl-Phase).
- `frontend/src/components/SettingsPage.tsx:168,198` — micDenied-Alert (Row-Kontext, per getUserMedia-NotAllLowed-Mock getriggert) + pushUnsupported-Alert (Nicht-Row-Kontext).
- `frontend/e2e/settings-switch-layout.spec.ts:30,172` — MIC_DENIED_INIT_SCRIPT + Toggle-Muster, von dort kopiert.

## Annahmen
- ~~Rot nicht verifiziert~~ **Rot VERIFIZIERT** (Lauf 2026-08-25): T1 failed wie vorhergesagt an `paddingTop: Received: 0` (echte Soll-Messung, Fixture/Alert-Trigger funktionierten), T2 (Schutz-Test) passed. `1 failed, 1 passed (12.6s)`.
- ≤8px-Deckel (0.5rem) als Testgrenze ist aus AK1 („Token-Skala 0.25–0.5rem") abgeleitet — wenn UX andere Werte festlegt, Grenze im Test mitändern.
- „App-weit ohne Änderung der ~40 Stellen" = Diff-Eigenschaft (nur app.css ändert sich), im PR-Body als Review-Beleg benannt, nicht per Test (ADR 0001).

## Verworfen
- Neuer Test für AK4 (#930-Transparenz bleibt) — Dedup: `issue-930-transparent-backgrounds.spec.ts` prüft Host-Transparenz für kol-alert bereits in beiden Themes.
- Neuer Test für AK3-Row-Layout — Dedup: `settings-switch-layout.spec.ts` (#971) sichert Flex-Aufteilung.
- TaskForm-Dialog als 2. Mess-Kontext — zu aufwändig/flaky; stattdessen Sammel-Messung aller sichtbaren kol-alert auf /settings/general (Row- + Nicht-Row-Kontext).

## Offen
- -

## Nächster Schritt
- Workflow übernimmt Routing (Label); Impl-Phase macht T1 grün via globalem `kol-alert`-Block in app.css (Kommentar mit #1028, Muster #866/#930) — ohne Anfassen der ~40 Verwendungsstellen, #930-Regel unverändert lassen (Mensch-Entscheidung im Spec dokumentiert).

## Fallstricke
- UX-Entscheidung ist MENSCHLICH festgelegt (deleonio-Kommentar 2026-08-25T15:16Z): Radius am Host, Fläche über KoliBri-Custom-Properties, #930 bleibt — nicht neu diskutieren.
- Kein globales `box-sizing: border-box` — genau das sichert T2; Impl nicht daran vorbei optimieren.
- Git-Identität fehlt auf frischen Runnern → vor Commit `git config user.name/email` aus `git log -1` übernehmen.

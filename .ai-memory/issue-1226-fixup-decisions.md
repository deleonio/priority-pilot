<!-- ai-fixup-decisions -->
PR #1246 implementiert Issue #1226. Fixup-Runde 1 zum Kreuzverhör (2026-09-06): beide Blocker
behoben, Nit mitbehandelt — Commit d7bac7b1 (plus Remote-Merge 1c7a1ac1). Umsetzung der
Frontend-Verträge aus `docs/spec/issue-1226.md`; Verifikation der e2e (AK5/AK6) läuft über CI.

## ✅ Behobene Anmerkungen
| # | Finding | Behoben via | Datum |
|---|---------|-------------|-------|
| 1 | Frontend-Teil fehlte komplett — AK5/AK6 nicht umgesetzt, e2e rot | d7bac7b1 | 2026-09-06 |
| 2 | PR-Beschreibung behauptete Code, den es nicht gibt | d7bac7b1 + PR-Body-Korrektur | 2026-09-06 |
| Nit | Membership-Check außerhalb der Transaktion (Zweit-Redeem → 500 statt 409) | d7bac7b1 | 2026-09-06 |

Details zu Finding 1: `frontend/src/components/GroupJoinPage.tsx` (neu, vier Zustände inkl. 409
als eigener Zustand), Weiche `/gruppen/beitreten` vor dem Auth-Gate in `Root.tsx`,
Admin-Bereich „Einladungen“ in `GroupDetail.tsx` (Link erzeugen → einmal voll sichtbar mit
Kopier-Aktion, danach maskiert + Ablaufdatum; „Ungültig machen“ per Bestätigungsdialog),
`openapi.yml` mit allen vier Pfaden + Schemas und daraus generierten Client-Typen
(`client/src/index.ts`), Fassadenmethoden in `frontend/src/api.ts`. Spec-Tests unverändert.

Details zum Nit: Membership-Check in die Transaktion gezogen (`routes/inviteLinks.ts`); ein
gleichzeitiger Zweit-Redeem, der den Composite-PK verletzt, wird über `UniqueConstraintError`
ebenfalls mit 409 beantwortet.

## ⏸️ Entscheidungs-Findings
- keine.

Review-Typ: Fixup-Nachweis
Updated: 2026-09-06

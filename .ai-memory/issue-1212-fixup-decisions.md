<!-- ai-fixup-decisions -->
PR #1215 implementiert Issue #1212 (Nutzersuche, Einladungen, Mitgliedschaftspflege). Fixup Runde 1: Blocker-Finding #1 ist via 33be8aec behoben und gepusht; der vorherige Lauf crashte danach vor der Nachweis-Pflege (Kommentar + Thread-Auflösung), die dieser Lauf nachgeholt hat. Keine Entscheidungs-Findings.

## ✅ Behobene Anmerkungen
| # | Finding | Behoben via | Datum |
|---|---------|-------------|-------|
| 1 | GroupDetail.tsx:112 — „Entfernen"-Button ohne Bestätigungsdialog (blocker, widerspricht Spec + E2E) | 33be8aec | 2026-09-04 |

## ⏸️ Entscheidungs-Findings
- keine

## 🔴 Offen: CI e2e-Shard 1 rot — KEINE Regression aus dem Fix
3 Tests in `frontend/e2e/groups-invitations.spec.ts` fehlgeschlagen: AK1 (spec:44), AK6/AK9 (spec:59), AK12 (spec:114). Erstfehler: spec:53 `getByRole('searchbox')` nie gefunden nach Klick auf Gruppen-Listitem (`locator.fill` 30s-Timeout) — die GroupDetail-Ansicht rendert die Nutzersuche im E2E-Kontext nicht.
**Diagnose:** identische 3 Fehler bereits auf dem VOR-Fix-Head 4df8ee2b (Run 33844930295, e2e-Job 100934669920) → prä-implementiert, nicht durch 33be8aec verursacht. AK6/AK9 passt zum ursprünglichen Review-Befund (fehlender Dialog, jetzt gefixt); AK1/AK12 zeigen ein separates Render-/Setup-Problem der Spec (alle 3 Tests sterben vor/neben dem Entfernen-Flow). Nächste Fixup-Runde: Ursache klären (Spec-Setup vs. GroupDetail-Render) und beheben. Nit „Selbst-Austritt für Nicht-Admins" bleibt bewusst unverändert (nicht blockierend, kein AK).

Review-Typ: Fixup-Nachweis
Updated: 2026-09-04

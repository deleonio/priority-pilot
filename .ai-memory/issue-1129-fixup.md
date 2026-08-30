# PR 1129 — Fixup Runde 1, Stand 2026-08-30

**2 Findings behoben** (beide unambiguous, docs-only in `docs/user-guide.md`):
1. Zeile ~420: „Alarm-Entfernung – ab dieser Entfernung … Push-Hinweis" (invertiert, Code pusht bei `distanceKm <= alarmDistanceKm`, geo-background-job.ts:92) → „liegt eine Aufgabe näher als diese Entfernung, kommt ein Push-Hinweis".
2. Zeile ~123: „Ortsbezug (Globus) – trägt eine Adresse mit Koordinaten" (zu eng, GeoBadge.tsx:81-83 rendert bei beliebigem Ortswert) → „trägt einen Ortsbezug (Adresse oder Koordinaten)".

## Erledigt
- SCOPED-Read: nur die 2 Inline-Kommentare (ids 3888383333 :420, 3888383337 :123) + umliegende Hunks; kein Full-Diff-Walk.
- Beide Ein-Zeilen-Umformulierungen nach Review-Vorschlag eingebaut.
- Gate: `pnpm exec prettier --check .` + Vertragstest `server/src/logics/user-guide.test.ts` (Überschriften unangetastet).
- Commit+Push auf `chore/user-guide-sync` inkl. dieser Notiz (ADR 0005/0007).
- Beide Review-Threads via GraphQL `resolveReviewThread` aufgelöst (PRRT_kwDONloM186degZG / …degZH, isResolved=true verifiziert).
- CI von Commit `8038a603` (Run 33291271793) KOMPLETT GRÜN: verify pass, e2e Shards 1–4 pass — auch Shard 3 (der frühere Flake `e2e/issue-969.spec.ts:86`).

## Relevante Stellen
- `docs/user-guide.md:420` (Alarm-Entfernung-Satz) und `:123` (Ortsbezug-Bullet) — beide im Abschnitt „Kennzeichen" bzw. „Standort erfassen".
- `server/src/logics/geo-background-job.ts:92` — Belegstelle Finding 1.
- `frontend/src/components/GeoBadge.tsx:81-83` — Belegstelle Finding 2.

## Annahmen
- Docs-only: restliche Gate-Schritte (lint/knip/E2E) von 2 Textzeilen unberührt; einziger früherer roter Job war der e2e-Shard-3-Flake (Review-Notiz, pre-existing).
- Vertragstest deckt nur Abschnittsüberschriften → Textänderungen safe.

## Verworfen
- Sammelkommentar (id 5466533137) PATCHen — Review-Notiz will das für Runde 2 behalten; Fixup-Verifikation/abhaken ist Aufgabe der Review-Phase (Präzedenz #1128-Fixup).
- Titel-Edit — nach Review-Runde 1 bereits konform (`docs: sync user guide with implemented state (2026-08-30)`).

## Offen
- -

## Nächster Schritt
- Review-Runde 2 (FIXUP VERIFICATION) prüft Diff ab Sammelkommentar-updatedAt.

## Fallstricke
- Keine neuen Findings erzeugen: nur die 2 gemeldeten Stellen angefasst, Zeilenumbrüche Prettier-konform.
- Deutsch/uppercase-Titel war schon gefixt — nicht rückändern.

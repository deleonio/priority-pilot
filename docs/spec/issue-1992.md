# Spec #1992 — Gruppen-Challenge „Balance-Woche"

## Ziel

Ein Gruppenmitglied startet eine 7-Tage-Challenge; die Gruppenansicht zeigt Restlaufzeit und Rangfolge nach Balance; nach Ablauf steht eine teilbare Abschluss-Karte bereit.

## Vertrag

- `POST /groups/:id/challenge` (Mitglied, `requirePlanFeature('groups')`): legt `GroupChallenge` mit `startsAt=jetzt`, `endsAt=startsAt+7 Tage` an → 201. Laufende Challenge vorhanden → 409. Nicht-Mitglied → 404.
- `GET /groups/:id/challenge`: `{ status: 'laufend' | 'beendet', startsAt, endsAt, rangfolge: [{ name, rang, balance }] }`. Status wird beim Lesen aus `endsAt` abgeleitet (kein Job). Nicht-Mitglied → 404.
- Rangfolge je Mitglied nur `name`, `rang`, `balance` (`fill` aus `berechneLebensbalance` über im Zeitraum erledigte eigene Tasks) — keine Tasktitel, Beschreibungen, Anzahlen. Absteigend nach `balance`; Gleichstand = gleicher Rang; `hasPoints=false` → `balance: null`, am Ende.
- `server/src/logics/groupChallenge.ts`: `berechneRangfolge(mitglieder)` und `challengeStatus(endsAt, jetzt)`.
- `frontend/src/lib/challengeShareCard.ts`: `erzeugeChallengeKarteSvg({ gruppe, zeitraum, rangfolge })` — SVG mit Gruppenname, Zeitraum, Rang/Name/Wert, keine Aufgabeninhalte.

## Abdeckung

AK1/AK2/AK4: `server/src/express/group-challenge.api.test.ts`; AK3: `server/src/logics/groupChallenge.test.ts`; AK6: `frontend/src/lib/challengeShareCard.test.ts`.
AK5/AK7 (UI-Zustände, 375 px): nicht testbar ohne festgelegte Komponenten-Schnittstelle bzw. Test-IDs — siehe PR „Offene Fragen".

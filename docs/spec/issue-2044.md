# Issue 2044 — Score-Aufschlüsselung in /next und /suggestions

Basis: Issue #2044 + KI-ANALYSE-Block (Harness-Kommentar, stand 2026-10-01T14:52:59Z). Baut auf #2043
(`bewerteKandidaten`, `docs/spec/issue-2043.md`) auf; Grundlage für #1985.

## Ziel

Jede Empfehlung (`GET /next`, jeder Eintrag von `GET /suggestions`) erklärt sich selbst: neben den
unveränderten Task-Feldern liefert sie `scoreBreakdown` — die Beiträge je Faktor und den Gesamtscore.

## Vertrag

- Neues Feld `scoreBreakdown: { total, priority?, unlock?, balance?, deadline?, effort? }` (Zahlen).
- Werte stammen 1:1 aus `Bewertung.score` (`total`) und `Bewertung.beitraege`
  (`prio`→`priority`, `entsperr`→`unlock`, `balance`, `deadline`, `aufwand`→`effort`); keine zweite Rechnung.
- Beitrag 0 ⇒ Schlüssel fehlt; Beitrag ≠ 0 ⇒ Schlüssel immer vorhanden. `total` ist immer vorhanden.
- Summe der vorhandenen Beiträge = `total` (Toleranz 1e-9).
- `/suggestions`: nach `total` absteigend; `/next` = höchster `total` aller freien Tasks (= Rang 1).
- Additiv: alle bisherigen Task-Felder bleiben; `/next` ohne freie Tasks liefert weiter `null`.
- MCP `next_task` reicht die `/next`-Antwort durch (inkl. `scoreBreakdown`); Katalog wächst nicht.

## Akzeptanzkriterien

- AK1: `/next` trägt `scoreBreakdown`.
- AK2: jeder `/suggestions`-Eintrag trägt `scoreBreakdown`.
- AK3: Summe der Beiträge = `total`; Ordnung nach `total` absteigend; `/next` = Rang 1.
- AK4: Beitrag 0 ⇒ Schlüssel fehlt, sonst vorhanden.
- AK5: `next_task` liefert die Aufschlüsselung mit.
- AK6: bestehende Felder unverändert, `/next` ohne Tasks = `null` (durch bestehende Tests abgedeckt).

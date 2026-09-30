# Spec #1849 — Säulenbeschreibungen erklären Stärkung und Wochen-Soll

Ziel: Die Beschreibung jeder Standard-Säule sagt, wodurch erledigte Aufgaben sie stärken und wie viele
Erledigungen pro Woche sie braucht (Kadenz-Modell #1638). Quelle der Texte ist der Katalog
`SEED_PILLARS` (`server/src/models/pillarData.ts`, #1848); keine neue Anzeige, kein neues DTO-Feld.

## Vertrag

- Jede `SEED_PILLARS[].description` enthält ihr `rhythmusProWoche` als Zahl, gefolgt von „pro Woche“
  (im selben Satz), und einen Hinweis auf Erledigungen („erledig…“). Die Konzeptbeschreibung vorne
  bleibt unverändert (LLM-Klassifikation).
- `GET /pillars`, KI-Vorschlag und Säulen-Berater liefern den neuen Katalogtext (Bestandsvertrag #1848,
  `pillar-catalog.test.ts`).
- Tab „Säulen“ (375 px): alle fünf `.pillar-list-description` sichtbar, je mit „pro Woche“, rechte
  Kante ≤ Viewport-Breite.
- `docs/user-guide.md` (Säulen, Balance) beschreibt Stärkung und Soll übereinstimmend.

## Szenarien (AK → Test)

- AK1 → `server/src/models/pillarData.test.ts` (je Säule).
- AK2, AK3 → bestehende Tests `server/src/express/pillar-catalog.test.ts`, kein neuer Test.
- AK4 → `frontend/e2e/issue-1849-pillar-descriptions.spec.ts`.
- AK5 → reine Doku, Sichtprüfung im Review.

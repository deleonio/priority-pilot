## Rote Spec-Tests für #1063 — Geo-Badge (Globus) in Serien- und Erledigt-Liste

Spec: `docs/spec/issue-1063.md` (AK1–AK6, aus dem bindenden KI-ANALYSE-Block + KI-UX-Block abgeleitet).
**Rote Spec-Tests; Implementierung folgt (Phase 4).** Der verify-Job ist rot — beabsichtigt.

### Abgedeckte Akzeptanzkriterien

| AK | Testdatei | Rot-Verifikation |
| --- | --- | --- |
| AK1 — `address` an Serien-API | `server/src/express/series-address.test.ts` (neu) | 7/7 fail (aktuell 201 statt 400 / `address` fehlt in Response) |
| AK2 — Snapshot-Vererbung | `server/src/logics/series.test.ts` (erweitert) | 2 der 3 neuen Tests fail (Instanz erbt Adresse nicht); der „ohne address → null"-Fall ist bereits grün (Default-Guard) |
| AK3 — Kaskade `applyToInstances` | `server/src/express/series.cascade.test.ts` (erweitert) | 1/9 fail (nur der neue #1063-Test) |
| AK4/AK5 — Badge Serienliste/Erledigt, TaskTree ohne | `frontend/e2e/issue-1063-geo-badge.spec.ts` (neu) | rot (`data-testid="geo-badge"` existiert nicht) |
| AK6 — 375px ohne Überlauf | `frontend/e2e/issue-1063-geo-badge.spec.ts` | rot (Badge fehlt → `toBeVisible` scheitert), Bounding-Box-Messung wie issue-1020 |

### UX-Berücksichtigung (KI-UX-Block)

- Badge icon-only, rein informativ (nicht klickbar), Font-Awesome-Globus statt 🌍-Emoji.
- `aria-label` mit „Standort" verankert (BITV) — per `toHaveAttribute` eingeklagt.
- AK6 per Bounding-Box gemessen (App-Shell clippt `overflow-x: hidden`, `scrollWidth` wäre strukturell grün).

### Offene Fragen

- keine

### Test-Pflege-Bedarf

- keiner — keine bestehenden Tests widersprechen den AKs; Task-`address`-API bereits durch `tasks-address.test.ts` gedeckt (kein Duplikat).

Closes #1063

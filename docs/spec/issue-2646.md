# Spec: Übergangsregel für Bestandskunden entfernen (#2646)

## Ziel

Keine Regelwerk-Quelle beschreibt mehr die Übergangsregel (#1463) — die einmalige Aufwertung alter
`free`-Konten auf `pro` vor dem Scharfschalten von `MONETIZATION_ENFORCED`. PO-Entscheidung
(#2634, Kommentar deleonio 2026-10-16, bindend): Es gibt keine Bestandskunden; die Regel entfällt
komplett — entfernen, nicht konsolidieren.

## Voraussetzungen

- Die Paket-Durchsetzung selbst bleibt unverändert: `MONETIZATION_ENFORCED` (Default aus,
  Rückweg ohne Deploy) bleibt dokumentiert; die `MONETIZATION_ENFORCED`-Aussage im arc42-Bullet
  und der Schalter-Kommentar in `server/.env.example` bleiben inhaltlich intakt — nur ihr
  Übergangs-Bezug entfällt.
- Keine Migration/Datenübernahme nötig (kein produktiver Datenbestand).
- Historische Aufzeichnungen bleiben bewusst unberührt: `docs/gesamtkonzept-monetarisierung.md`,
  `docs/spec/issue-1463.md`, `CHANGELOG.md`. Ebenso `AGENTS.md` („Kein Bestandskunden-Ballast“
  ist bereits die Zielform).

## Schritte (Entfernungs-Vertrag je Datei)

| Fundstelle                                   | Maßnahme                                                                                                                                                                                                    | AK  |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| `server/src/cli/grandfatherPlans.ts`         | löschen                                                                                                                                                                                                     | AK2 |
| `server/src/logics/grandfatherPlans.ts`      | löschen — keine Konsumenten außer CLI + eigenem Test (grep-Beleg im PR-Body)                                                                                                                                | AK2 |
| `server/src/logics/grandfatherPlans.test.ts` | löschen — behauptet die entfallene Logik; im Spec-PR erledigt (Test-Pflege)                                                                                                                                 | AK2 |
| `server/knip.jsonc`                          | Entry `src/cli/grandfatherPlans.ts` aus `entry` entfernen (sonst knip-Bruch)                                                                                                                                | AK2 |
| `docs/arc42.md` Monetarisierungs-Bullet      | Satz „Übergangsregel (#1463): …“ streichen; `MONETIZATION_ENFORCED`-Aussage davor intakt                                                                                                                    | AK1 |
| `docs/deployment.md`                         | Abschnitt „## 7. Übergangs-Setzung vor dem Launch (#1463)“ inkl. Rückweg-Absatz löschen; darauffolgendes „Offene Entscheidungen“ bleibt; keine andere Stelle verlinkt den Abschnitt (grep-Beleg im PR-Body) | AK3 |
| `server/.env.example`                        | `GRANDFATHER_CUTOFF`-Block streichen; `MONETIZATION_ENFORCED`-Kommentar ohne Übergangs-Bezug neu fassen (der Verweis auf „deployment.md Abschnitt 7“ entfällt mit)                                          | AK3 |
| `docs/user-guide.md`                         | Absatz „Übergangsregel für Bestandskonten“ löschen                                                                                                                                                          | AK4 |

## Erwartetes Ergebnis

- `pnpm --filter server build`, `pnpm --filter server test` und `pnpm knip` grün — die Suite läuft
  ohne die gelöschte `grandfatherPlans.test.ts` unverändert weiter grün.
- `grep -rn -e grandfatherPlans -e GRANDFATHER_CUTOFF server/ docs/arc42.md docs/deployment.md
docs/user-guide.md` → 0 Treffer.
- Verhalten: `MONETIZATION_ENFORCED=true` setzt die Paket-Durchsetzung für alle Konten ein — ohne
  Stichtags-Ausnahme. Abgedeckt durch die vorhandenen Monetarisierungs-Tests (z. B.
  `server/src/mcp/plan-error.test.ts`); keine neuen Tests nötig (Dedup).

## Tests

- AK1/AK3/AK4 sind reine Doku-/Config-Entfernungen → keine Testfälle (ADR 0001: String-Match gegen
  Markdown/Config ist ein change detector ohne Zähne); Verifikation per grep (AK5).
- AK2 entfernt Anwendungscode ohne veränderbares Verhalten (Konsumenten nur CLI + eigener Test):
  ein Test auf Abwesenheit von Dateien wäre ebenfalls ein change detector → es ist kein roter Test
  schreibbar; der Entfernungs-Nachweis ist AK5 (build/test/knip grün + grep 0 Treffer).
- Test-Pflege: `grandfatherPlans.test.ts` widerspricht AK2 direkt (behauptet die Übergangs-Logik
  und guardt sie gegen Entfernung) → im Spec-PR entfernt; Begründung im PR-Body unter
  „Test-Pflege-Bedarf“.

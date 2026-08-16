# Spec: Spec-Sync-PRs direkt in die Pipeline hängen (Issue 729)

**Stand:** 2026-08-16  
**Ziel:** Spec-Sync-Workflow erstellt Non-Draft-PRs und setzt `ai:needs-review` per App-Token → Kreuzverhör-Review (04) startet automatisch

**Hinweis:** Dies ist ein reiner Dokumentations-Spec für Workflow-Änderungen. Nach ADR 0001 werden Workflows/CI nicht getestet – die Validierung erfolgt im PR-Body durch Akzeptanzkriterien-Nachweis.

---

## Ziel

Der nächtliche Spec-Sync (`claude-spec-sync.yml`) erstellt pro geänderter Spec-Datei einen **Non-Draft-PR** und setzt direkt `ai:needs-review` per App-Token – der Kreuzverhör-Review (04) startet ohne Menschseingriff (analog zum bereits im Zielzustand befindlichen Guide-Sync).

## Vorbedingung

- Spec-Sync-Workflow ist eingerichtet (`.github/workflows/claude-spec-sync.yml`)
- GitHub App-Token ist verfügbar für Label-Operationen

## Schritte

1. **Label-Create-Guard hinzufügen**
   - Vor der Per-Datei-Schleife einmalig `gh label create "ai:needs-review" --color 1D76DB --description "PR wartet auf KI-Review" || true` (gh crasht hart, wenn Label fehlt)

2. **PR-Create anpassen**
   - `gh pr create …` **ohne** `--draft`
   - PR-Nummer aus der Create-URL parsen (Muster aus Guide-Sync)

3. **Label-Setzen mit Retry**
   - Direkt nach dem Create: `gh pr edit <nr> --add-label ai:needs-review` mit Retry (3 Versuche)
   - Bei endgültigem Fehlschlag: `::error` + `exit 1` (laut, kein stiller Review-Ausfall)
   - Kein Remove-Vorlauf nötig – frische PRs tragen das Label nie

4. **PR-Body anpassen**
   - Freigabe-Zeile ("**Freigabe:** 'Ready for review' klicken …") ersetzen durch Pipeline-Hinweis (Review/Fixup laufen automatisch)

5. **Workflow-Header und Notices aktualisieren**
   - Header-Kommentar (Delivery-Beschreibung) umschreiben: Non-Draft + Label direkt nach Create, Review/Fixup/Gate/Auto-Merge übernehmen
   - Notices/Job-Summary: "Draft-PRs" → "PRs"; Step-Name entsprechend anpassen
   - Agent-Prompt: "pro Datei ein Draft-PR" → "pro Datei ein PR"

6. **Dokumentation aktualisieren**
   - `docs/ci-architecture.md` (Sektion "Nightly Spec-Sync"): "einen Draft-PR" → Non-Draft-PR
   - Absatz "Draft-Freigabe → Pipeline" ersetzen durch Selbst-Labeling per App-Token (Autolabeler greift bei Bots nicht)
   - "offenen Draft-PRs" → "offenen Sync-PRs"

## Erwartetes Ergebnis

1. Spec-Sync erstellt Non-Draft-PRs und setzt `ai:needs-review` selbst per App-Token → `labeled`-Event feuert → 04-Review startet automatisch
2. Label-Setzen failt laut (Retry + `::error` + Exit 1), kein stiller Review-Ausfall; Workflow-Rerun bleibt idempotent (offene Sync-PRs → Skip mit Notice)
3. Skip-Logik bleibt unverändert (pro Datei: bereits offener Sync-PR → kein zweiter); deckt zugleich In-Flight-Fall ab (kein Force-Push auf belegte Branches → kein In-Flight-Guard nötig wie Guide-Sync)
4. Workflow-Header, Agent-Prompt, PR-Body und `docs/ci-architecture.md` beschreiben das neue Delivery-Verhalten konsistent (kein "Ready for review"-Freigabe-Text mehr)

## Randfälle & Fehler

| Situation                                      | Erwartetes Verhalten                                              |
| ---------------------------------------------- | ----------------------------------------------------------------- |
| Label existiert nicht                          | `gh label create …                                                |     | true` schlägt weich fehl, Label wird erstellt |
| PR-Create erfolgreich, Label-Setzen fehlerhaft | Retry (3 Versuche), bei endgültigem Fehlschlag `::error` + Exit 1 |
| Workflow-Rerun bei bereits offenem Sync-PR     | Skip mit Notice (idempotent)                                      |
| Force-Push auf belegten Branch                 | Nicht relevant für Spec-Sync (kein Force-Push, Skip-Logik genügt) |

## Kein Scope

- Guide-Sync: bereits Zielzustand – keine Änderung
- Tests für Workflows/CI: nach ADR 0001 / #567 werden nur App-Code-Änderungen getestet
- In-Flight-Guard für Spec-Sync: Skip-Logik genügt (siehe AK 3)
- Bestehende offene Draft-PRs aus vergangenen Nächten bleiben unberührt

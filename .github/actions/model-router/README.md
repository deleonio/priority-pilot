# Modell-Router (CI-Baustein)

Composite-Action, die die Komplexität einer KI-Aufgabe einschätzt und daraus das Ausführungsmodell
(+ Effort) wählt. Sie ersetzt das feste `--model claude-opus-4-8` der KI-Workflows durch eine
aufgabengerechte Wahl. Liefert die Entscheidung als **Step-Outputs** und **loggt** sie.

Hintergrund: #149 lieferte nur den deterministischen Kern (als Server-Runtime-Code). #153 verortet
den Kern korrekt als CI-Artefakt und ergänzt die fehlenden Router-Teile (Klassifikation, Composite-
Action, Logging, Effort-Kopplung). Die Verdrahtung der 6 Workflows bleibt **#150**.

## Bausteine

- `model-router.ts` — deterministischer Vertrag: `resolveModel(raw)` validiert + mappt das Token auf
  die volle Modell-ID, fällt bei leerem/ungültigem Output **ohne Throw** auf `claude-sonnet-4-6`
  zurück (`fallback=true`).
- `entrypoint.ts` — schlanker CI-Entrypoint: Token von **stdin** → `resolveModel` → Step-Outputs
  (`model`, `token`, `effort`) + Logging (`$GITHUB_STEP_SUMMARY`, `::notice::`). Bricht nie hart ab.
- `action.yml` — Composite-Action: (a) Sonnet-Klassifikationsschritt (`claude-sonnet-4-6`) →
  ein Token, (b)+(c) Entrypoint → Step-Outputs, (d) Logging.
- `*.test.ts` — `node:test` für Mapping/Fallback (`model-router.test.ts`, #149) und für die
  Effort-Kopplung + Output-Aufbereitung inkl. Smoke (`entrypoint.test.ts`, #153).

## Mapping

| Token    | Modell-ID           | Effort   |
| -------- | ------------------- | -------- |
| `haiku`  | `claude-haiku-4-5`  | `low`    |
| `sonnet` | `claude-sonnet-4-6` | `medium` |
| `opus`   | `claude-opus-4-8`   | `high`   |

Leeres/ungültiges/mehrdeutiges Token → `claude-sonnet-4-6` / `medium` (Fallback, Exit 0).

## Verwendung (durch #150)

```yaml
- id: router
  uses: ./.github/actions/model-router
  with:
    kind: implement
    title: ${{ github.event.issue.title }}
    description: ${{ github.event.issue.body }}
    claude-token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
# danach: --model ${{ steps.router.outputs.model }} --effort ${{ steps.router.outputs.effort }}
```

## Tests

`node:test` (deterministisches Mapping/Fallback + Output-Aufbereitung) — in CI über einen eigenen
Schritt mit `tsx`. Klassifikation + CI-Aufrufpfad (Step-Output `model`) werden per Workflow-Lauf an
einem Scratch-Issue verifiziert (CI-Konfig-Ebene, keine Vitest/e2e).

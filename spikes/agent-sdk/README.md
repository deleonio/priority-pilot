# Agent-SDK-Spike (Issue #114)

Throwaway-Prototyp: **ein** Workflow-Schritt (PR-Review, nachgebaut aus
`.github/workflows/claude-pr-review.yml`) ueber den **Agent SDK**
(`@anthropic-ai/claude-agent-sdk`) statt der heute genutzten `anthropics/claude-code-action`.

Dieses Verzeichnis ist **kein** Workspace-Paket (siehe `pnpm-workspace.yaml`) und wird
**nicht** in die Produktiv-Workflows gemerged. Es dient nur dem Vergleich in
[`.ai-knowledge/agent-sdk-spike.md`](../../.ai-knowledge/agent-sdk-spike.md).

## Lokal ausfuehren (headless, reproduzierbar)

Auth ueber ein Secret in der Umgebung (kein interaktiver Login) — eines von beiden:

```bash
export ANTHROPIC_API_KEY=sk-...        # direkter API-Key, oder
export CLAUDE_CODE_OAUTH_TOKEN=...     # dasselbe Token wie der Claude-Pfad heute
```

Abhaengigkeiten holen und starten (`tsx` strippt die TS-Typen zur Laufzeit):

Ohne Argument wird ein Mini-Demo-Diff verwendet.

```bash
cd spikes/agent-sdk
pnpm install                 # oder: npm install
pnpm start ./pr.diff         # liest eine Diff-Datei; ohne Argument: Mini-Demo-Diff
# alternativ direkt:
node --import tsx pr-review-spike.ts ./pr.diff
```

Eine Diff-Datei erzeugst du z. B. mit `gh pr diff <nr> > pr.diff`.

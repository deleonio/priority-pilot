# Agent-SDK-Spike — Vergleich & Empfehlung (Issue #114)

Zeitlich begrenzter Prototyp: lohnt ein (Teil-)Umstieg von der heute genutzten
`anthropics/claude-code-action` auf den **Agent SDK** (`@anthropic-ai/claude-agent-sdk`,
Einstieg ueber `query()`)? Beantwortet **nicht** als Migration, sondern an **einem**
nachgebauten Workflow-Schritt — dem PR-Review aus `.github/workflows/claude-pr-review.yml`.

- **Prototyp:** [`spikes/agent-sdk/`](../spikes/agent-sdk/) — minimaler TS-Einstieg, der
  `query()` aus `@anthropic-ai/claude-agent-sdk` headless aufruft, sich ueber
  `ANTHROPIC_API_KEY` bzw. `CLAUDE_CODE_OAUTH_TOKEN` authentifiziert und einen Diff reviewt.
  Throwaway, kein Merge in Produktiv-Workflows.
- **Referenz (Ist-Stand):** fertige Action `anthropics/claude-code-action@v1`, eingebunden in
  die `claude-*.yml`-Workflows, umschaltbar via Repo-Variable `AI_AGENT` (Claude/Mistral,
  siehe `AGENTS.md`).

## Vergleichstabelle (Action vs. Agent SDK)

> **Hinweis:** Der Prototyp wurde im headless Umsetzungs-Lauf aus Toolchain-Gruenden
> (Node-/pnpm-Sandbox blockiert) **nicht ausgefuehrt**. Die Spalte „Einschätzung" ist daher
> eine Code-/Architektur-Analyse anhand von SDK-Doku und Repo-Stand, **kein** gemessener
> Prototyp-Lauf. Die Empfehlung (teilweise / kein Umstieg) bleibt davon unberuehrt.

| Kriterium               | Worum es geht                        | Einschätzung (kein Messlauf)      |
| ----------------------- | ------------------------------------ | --------------------------------- |
| Kontrolle               | Tool-Loop/Context feiner steuerbar?  | SDK feiner, aber mehr Eigenlast   |
| Aufwand                 | Wartung selbst vs. gepflegte Action  | hoeher (Setup/Deps/Auth selbst)   |
| Kosten/Token            | messbarer Unterschied am Prototyp?   | keiner (gleiches Modell + Loop)   |
| AI_AGENT-Kompatibilität | Claude/Mistral-Umschalter erhaltbar? | bricht: SDK nur Claude-Seite      |
| Determinismus/CI-Fit    | reproduzierbar, Auth via Secrets     | gleichwertig, headless lauffaehig |

Details je Kriterium (pipe-frei, damit die Tabelle kompakt bleibt):

- **Kontrolle:** `query()` streamt strukturierte Nachrichten (assistant/result); Optionen wie
  `permissionMode`, `allowedTools`, `resume` sind pro Aufruf im Code setzbar. Die Action
  kapselt denselben Loop hinter YAML-Inputs — feiner steuerbar, dafuer mehr Eigenverantwortung.
- **Aufwand:** eigener Einstiegscode plus eigenes Dependency-/Runner-Setup (`tsx`, SDK-Version
  pinnen, Auth verdrahten) statt einer von Anthropic gepflegten Action mit fertigem
  GitHub-Kontext (Checkout, Permissions, Kommentar-Posting).
- **Kosten/Token:** gleiches Modell und gleicher Agent-Loop → keine systematische Ersparnis;
  Diff/Prompt dominieren. Abrechnung in beiden Faellen ueber dasselbe Anthropic-Konto; fuer
  SDK/Headless ist laut Recherche der API-Key der eindeutig unterstuetzte Pfad.
- **AI_AGENT-Kompatibilität:** Der Umschalter waehlt heute zwischen zwei **Actions**
  (`claude-code-action` / `mistral-vibe`). Ein SDK-Pfad bildet nur die Claude-Seite ab; die
  Mistral-Vibe-Action laesst keine Extra-Flags durch und hat kein analoges SDK im Repo. Ein
  einheitlicher SDK-Pfad fuer beide Agents ist **nicht** trivial.
- **Determinismus/CI-Fit:** `query()` laeuft headless mit `permissionMode: 'bypassPermissions'`
  und Auth aus der Umgebung — lokal wie im Runner reproduzierbar. Gleichwertig zur Action; der
  Mehraufwand ist das fehlende GitHub-Drumherum (Checkout/Kommentar selbst bauen).

## Empfehlung

**Teilweise — derzeit kein Umstieg.**

Begruendung: Der einzige echte Mehrwert des Agent SDK gegenueber der Action ist **feinere
Kontrolle** ueber Tool-Loop und Context-Management (langfristig session-uebergreifende Ketten
Triage → Umsetzung → Review). Dem stehen **hoeherer Wartungsaufwand** und ein **gewichtiger
Kompatibilitaetsbruch** gegenueber. Kosten/Token bringen am Prototyp keinen messbaren Vorteil,
der CI-Fit ist gleichwertig.

**Auswirkung auf den `AI_AGENT`-Umschalter:** Ein SDK-Umstieg wuerde den heutigen
`AI_AGENT=claude|mistral`-Mechanismus aufbrechen — der Claude-Pfad liefe ueber den SDK, der
Mistral-Pfad weiter ueber die Vibe-Action. Damit zwei divergierende Code-Pfade statt eines
einheitlichen Action-Switches. Solange Mistral eine echte Option bleiben soll, ueberwiegt der
Erhalt des einheitlichen Umschalters.

**Konkret empfohlen (teilweise):** SDK **nicht** flaechendeckend einfuehren. Sinnvoll waere ein
gezielter SDK-Einsatz nur dort, wo session-uebergreifende Kontrolle echten Nutzen bringt (z. B.
eine fortgesetzte Triage→Umsetzung→Review-Session) **und** der Schritt ohnehin Claude-only ist —
dann als zusaetzlicher, klar abgegrenzter Pfad neben dem bestehenden Action-Switch, nicht als
Ersatz. Vor einer breiteren Entscheidung muesste ein Folge-Spike die Mistral-Seite einbeziehen.

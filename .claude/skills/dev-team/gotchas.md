# Gotcha-Katalog (Dev-Team)

Ausgelagerter Katalog zu [SKILL.md](SKILL.md). Der Architect liest ihn in Phase 1 **einmal pro
Lauf** und zieht die zutreffenden Einträge **wörtlich** in die Gotcha-Box der Briefings — Rollen
erhalten die Auszüge, nicht diesen Pfad. Jeder Eintrag steht hier, weil er in einem Lauf real Zeit
gekostet hat.

## KoliBri-Laufzeit

- **Imperative Dialoge** (`KolDialog`/`KolDrawer`): persistent rendern, `showModal()` erst **nach**
  `customElements.whenDefined('kol-dialog')`. Naiver Conditional-Mount plus sofortiges `showModal`
  öffnet nichts. Fokus-Rückgabe muss shadow-durchdringend arbeiten (`deepActiveElement`), sonst
  landet der Fokus im Nichts.
- **StrictMode-Dialog-Race:** Imperativer Dialog + `close()` im Effekt-Cleanup reiht das native
  Close-Event als **Macrotask** ein, der den StrictMode-Re-Mount überlebt → sporadischer
  Sofort-Schließer. Wurzel ist meist ein **Remount** (zweiter Dialog für einen Schrittwechsel)
  statt eines persistenten Dialogs mit Kindtausch. Muster: **kein** `close()` im Unmount-Cleanup
  (die DOM-Entfernung räumt den Top-Layer laut Spec ohne Close-Event), `showModal()` über einen
  remount-überdauernden Ref guarden, Owner-Callbacks beim Unmount neutralisieren. Beim Fix per
  Negativ-Kontrolle beweisen: altes Remount-Muster temporär wiederherstellen → neuer Test **rot**,
  auf den Fix **grün**. Genau dieser rot-fähige Test fehlte zwei Schein-Fixes zuvor.
- **Geteilter Zustand gehört in den globalen Singleton** (`window.A11yUi`), nie in eine
  modul-lokale `new Map()`: im Multi-Bundle-Aufbau existiert das Modul mehrfach. „Funktioniert
  isoliert, nicht in der App" → **erste RCA-Hypothese: Bundle-/Modul-Instanz**.
- **KoliBri-First:** Erst im KoliBri-MCP nach der passenden Komponente suchen. Shadow-DOM-CSS ist
  unpublizierte API — eigenes Styling nur, wenn keine Komponente passt.

## KoliBri-Locators (Playwright, Shadow-DOM)

- Aktionszellen tragen ein sprechendes Label → `getByRole('cell', { name, exact: true })` statt
  Positions-Selektoren.
- `KolSingleSelect` rendert ein `<input role="combobox">` — **kein** `selectOption`; stattdessen
  klicken und `getByRole('option')` wählen.
- `KolInputRange` hat weder `role="slider"` noch `aria-label` → über `input[type="range"]`
  (shadow-piercing CSS) ansprechen.
- Auf Hydration über `:not(:defined)` und `document.fonts.ready` warten, nie über feste Timeouts.
- **`locator.evaluate(fn, arg)` ab Playwright 1.62:** der in-page-Arg ist `Unboxed<Arg>` —
  `Unboxed<Date>` ist **kein** `Date` (jede Methode wird `() => Promise<…>`). Folgen: (a) eine
  `date: Date`-Annotation am Parameter ist TS2345; (b) ein `Date` **nie** vorab per
  `.toISOString()` auf einen String kollabieren, wenn der Test ein `Date` erwartet — typ-erhaltende
  Komponenten liefern dann fälschlich einen String und `toBeInstanceOf(Date)` wird rot, **während
  das Lint-Gate grün bleibt**. Cast-frei korrekt: ISO-String übergeben und in-page `new Date(iso)`;
  bei Date/String-Gemisch einen diskriminierten Payload (`{kind:'date',iso} | {kind:'string',value}`).
- **e2e laufen lassen, nicht nur linten:** `tsc --noEmit`-grün sagt über eine Laufzeit-Regression in
  einer Spec nichts aus.

## Vertrags- und Doku-Fallen

- **Generierte Vertragsdateien nie handeditieren:** `server/src/api.d.ts` und
  `client/src/schema.d.ts` entstehen aus `openapi.yml`; Handeditierungen überschreibt der nächste
  Build oder Pre-Commit-Hook still.
- **Silent-Stub im öffentlichen Vertrag:** Ist ein Feld im Modell als „aktuell nicht ausgewertet"
  kommentiert, MUSS die Einschränkung auch in `openapi.yml` stehen — sonst gilt für Konsumenten
  „im Vertrag funktioniert es". Gilt für jedes Future-Proofing-Feld.
- **Neues Skript/Hook/Export ohne Consumer-Grep = unvollständig:** null Nutzungs-Treffer sind ein
  Finding, kein Erfolg (klassischer Fall: Skript in `package.json` ergänzt, in `lefthook.yml` nie
  verdrahtet).
- **Doku-Drift nach Routing-/Vertragsumstellung ist Critical:** ändert ein PR bestehendes Verhalten
  (etwa einen API-Präfix), die Git-History der Spiegel-Docs gegen das Code-Datum prüfen — stale
  Deploy-Docs bauen eine Konfiguration, die nie greift.
- **Verwaiste Dokumente:** ein neues Dokument unter `docs/` oder `.ai-knowledge/`, das in
  `AGENTS.md` nicht verlinkt ist, existiert für den nächsten Lauf nicht.

## Monorepo / pnpm

- `pnpm -r <script>` läuft im Verzeichnis jedes Sub-Packages und deckt **Root-Dateien**
  (`.github/**`, `.claude/**`, `.ai-knowledge/**`, `docs/**`) **nicht** ab; es ignoriert auch die
  Root-`.prettierignore`. Root-weite Prüfungen brauchen ein Root-Skript
  (`pnpm exec prettier --check .`).
- `pnpm format -- -w` reicht das `--` **literal** an Prettier durch → Exit 2. Flags gehören ins
  `package.json`-Skript, nicht ans pnpm-Forwarding.
- False Positives von knip **konfigurieren statt Code löschen**; `.json`/`.jsonc` trägt die
  Begründung schlecht → Begründung in Commit oder PR, nicht als toter Kommentar.
- Stale `dist/` verfälscht Testläufe: bei unerklärlichen Ergebnissen `dist/` löschen und neu bauen.

## Pipeline (label-getrieben)

- **Automation-Check vor lokaler Arbeit:** trägt das Issue ein `ai:needs-*`-Label oder existiert ein
  Pipeline-PR, läuft die KI-Pipeline bereits — lokale Parallelarbeit erzeugt doppelte Kosten und
  Edit-Wars.
- **Token-Trigger-Falle:** Events des `GITHUB_TOKEN` lösen **keine** Folge-Workflows aus. Wer ein
  Label setzt, das ein weiteres Gate starten soll, braucht ein App-Token.
- `workflow_run` liest nur vom Default-Branch — ein neues Gate ist auf seinem eigenen PR nicht
  testbar.
- `gh pr list --head` disambiguiert mehrere offene PRs nicht → Fail-safe-No-op statt Raten.
- **Kostensätze:** `.costs/<nr>.json` ist eine Liste, die nur **angehängt** wird. Das CI-Siegel
  merged idempotent über `timestamp|phase|tokensIn|tokensOut` — lokale Sätze überleben, doppelte
  nicht.
- **Lokal geschriebene Kostensätze sind prettier-dirty:** Die Erfassung schreibt JSON mit zwei
  Leerzeichen, das Repo formatiert mit Tabs. Wer einen Satz lokal schreibt und committet, ohne
  `pnpm exec prettier --write .costs/<nr>.json` nachzuschieben, bekommt einen roten CI-Verify.
  In CI fällt das nie auf: dort wandert der Satz ins Artefakt, nicht in den Checkout.

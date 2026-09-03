# pi-Konfiguration der CI

`model-aliases.json` gehört zu `.github/actions/setup-pi` und wird **nur im CI-Lauf**
ausgewertet. Die Paketliste des Projekts steht woanders: [`.pi/settings.json`](../../.pi/settings.json).

JSON kennt keine Kommentare — deshalb steht die Begründung hier.

## Warum es hier KEINE `models.json` gibt

Alle drei Provider der Pipeline sind in pi **eingebaut**: `anthropic` (`ANTHROPIC_API_KEY`),
`openrouter` (`OPENROUTER_API_KEY`) und — anders als bei Claude Code, wo z.ai über
`ANTHROPIC_BASE_URL` umgebogen werden muss — auch `zai` (`ZAI_API_KEY`), inklusive der drei
gebuchten Modelle `glm-5.3`, `glm-5-turbo` und `glm-4.7`. `setup-pi` setzt deshalb nur den Key.

Ein eigener Custom-Provider in `models.json` wäre nicht bloß überflüssig, sondern schädlich:
Mit `pi --list-models` nachgemessen liefert der eingebaute Eintrag für `glm-5.3` ein
**1M-Kontextfenster bei 131K max. Tokens**; eine handgeschriebene Zeile hätte daraus 200K/32K
gemacht und damit genau das `[1m]`-Fenster gekappt, auf das die Pipeline baut.

## `model-aliases.json` — Alias → Modell-ID je Provider

Dieselben vier Aliase wie unter Claude Code (`fable | opus | sonnet | haiku`, siehe
Modell-Allowlist in `docs/ci-architecture.md`), aber als pi-Modellreferenzen der Form
`provider/id`.

**`openrouter` ist absichtlich leer.** Die OpenRouter-Modell-IDs sind unter Claude Code
bewusst nicht im Repo gespiegelt — Source of Truth ist die GitHub-Variable
`CLAUDE_CODE_SETTINGS_LOCAL_OPENROUTER`. Für pi gilt dasselbe Prinzip: Die Zuordnung kommt aus
der Variable **`PI_MODEL_ALIASES`** (JSON in derselben Struktur wie diese Datei) und wird über
die Einträge hier gelegt. Fehlt für den gewählten Provider ein Alias in beiden Quellen, bricht
`setup-pi` laut ab — ein geratenes Modell wäre genau der stille Fehlgriff, gegen den die
Modell-Allowlist antritt.

Beispiel:

```bash
gh variable set PI_MODEL_ALIASES --body '{"openrouter":{"opus":"openrouter/moonshotai/kimi-k2.6","sonnet":"openrouter/deepseek/deepseek-v3.2","haiku":"openrouter/nvidia/nemotron-3-nano-30b-a3b:free","fable":"openrouter/moonshotai/kimi-k2.6"}}'
```

Beim Freigeben eines neuen Alias ist diese Datei die pi-Seite der Synchronisierungsliste in
`docs/ci-architecture.md` → „Modell-Allowlist & Freigabe neuer Modelle".

## Pakete: keine CI-eigene Liste

`setup-pi` installiert genau die Pakete aus [`.pi/settings.json`](../../.pi/settings.json) — dem
Projektfile, das ohnehin für jede pi-Session in diesem Repo gilt. Eine zweite, CI-eigene Liste
würde erzeugen, was die Pilotphase widerlegen soll: einen CI-Lauf, der anders arbeitet als der
lokale. Die Auswahl der Pakete ist damit eine Entscheidung des Projekts, keine der Pipeline.

Alle Einträge sind auf eine Version **gepinnt** — ohne Pin zöge die CI bei jedem Lauf den
aktuellen Stand, und zwei Läufe basierten auf verschiedenen Erweiterungsversionen, was jeden
Kostenvergleich wertlos macht. Pinnen allein ließe die Pakete aber veralten, deshalb pflegt ein
**Renovate-CustomManager** (`renovate.json5`) genau diese Zeilen: eigene PR-Gruppe
„pi-Erweiterungen", bewusst **ohne** Automerge, weil diese Pakete das Verhalten des Agenten
ändern und nicht nur Bibliothekscode. `setup-pi` warnt, falls doch ein Eintrag ohne Version
nachgetragen wird.

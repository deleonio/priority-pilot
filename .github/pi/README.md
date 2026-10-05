# pi-Konfiguration der CI

Die Modell-Settings von pi kommen aus **[`.github/model-settings.json`](../model-settings.json)**
(die `'pi'`-Form je Alias) — dieselbe Datei, aus der auch Claude Code seine `cc`-Formen liest.
Einheitliche Quelle seit 05.10.; die frühere `model-aliases.json` und die Variable
`PI_MODEL_ALIASES` sind eingestellt. Die Paketliste des Projekts steht woanders:
[`.pi/settings.json`](../../.pi/settings.json).

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

## Provider-Matrix: pi nur gegen zai | openrouter

Claude Code läuft gegen alle drei Provider (claude/zai/openrouter); **pi nur gegen zai und
openrouter** — das Anthropic-Abo ist an Claude Code gebunden, pi kann es nicht nutzen.
`setup-agent` bricht bei `runtime=pi` + `provider=claude` laut ab, `set-agent-config`
prüft die Kombination schon VOR dem Setzen der Variablen. Deshalb hat `claude` in
`model-settings.json` keine `pi`-Formen.

Beim Freigeben eines neuen Alias ist `model-settings.json` die eine Stelle der
Synchronisierungsliste in `docs/ci-architecture.md` → „Modell-Allowlist & Freigabe neuer
Modelle" — pi-Form und cc-Form stehen dort je Alias nebeneinander.

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

# Triage-Notizen Issue #1037 — Schalter/Buttons im Settings-Tab „KI-Provider"

## Erledigt

- Erst-Triage (kein KI-ANALYSE-Block, 0 Kommentare, Label `ai:needs-analyse`).
- Code gelesen: `frontend/src/components/LlmSettings.tsx:296-358` (Buttons „Neuer Provider",
  „Testen", „Bearbeiten", „Löschen"), `frontend/src/components/SettingsPage.tsx:203-221`
  (`class="settings-action-btn"` am Push-Button), `frontend/src/app.css:1442-1451`
  (`.settings-action-btn`: mobil `align-self: stretch`, ab 768px `flex-start`),
  `frontend/src/app.css:1861-1919` (`.llm-provider-admin*`).
- Vorbild-Spec gefunden: `frontend/e2e/settings-action-buttons.spec.ts` (#1017) — misst
  `kol-button`-Host-BoundingBox gegen Container-Innenbreite aus Computed Style.
- Titel praeziser gefasst, Body lektoriert + KI-ANALYSE-Block geschrieben, Labels gesetzt.

## Relevante Stellen

- `frontend/src/components/LlmSettings.tsx:298` — „Neuer Provider"-Button, traegt keine Layout-Klasse.
- `frontend/src/components/LlmSettings.tsx:315-337` — `.llm-provider-admin__actions` mit
  Testen/Bearbeiten/Loeschen.
- `frontend/src/app.css:1442-1451` — `.settings-action-btn`, das zu uebernehmende Muster.
- `frontend/src/app.css:1904-1919` — `.llm-provider-admin__actions` (flex row wrap, ab 48rem
  `flex-shrink: 0`, Zeile per `justify-content: space-between` rechtsbuendig).
- `frontend/e2e/settings-action-buttons.spec.ts` — Messmuster fuer die neuen Tests.
- `frontend/e2e/llm-settings.spec.ts:26-37` — `openLlmTab()` + `cleanupCustomProviders()` als Szene-Setup.

## Annahmen

- „Schalter" = Aktions-Buttons (KolButton) im KI-Provider-Tab; der Tab enthaelt keine
  Switch-Elemente (`_variant="switch"` kommt nur in SettingsPage/Allgemein vor) — daher kann
  nur Buttons gemeint sein.
- Dialog-Buttons (LlmProviderFormDialog/DeleteDialog) sind nicht gemeint (im Screenshot nicht sichtbar).
- Desktop-Zeilenlayout der Provider-Liste (Aktionen rechtsbuendig, #951) bleibt; „links inline"
  bezieht sich auf Inhaltsbreite statt Vollbreite.

## Verworfen

- Deutung „Schalter = KolInputRadio-Provideroptionen": Radios haben kein
  Vollbreite/Inline-Breitenproblem, und `_orientation` schaltet bereits mobil auf vertikal
  (LlmSettings.tsx:209).
- Zerlegung in Sub-Issues: eine CSS-Regel + eine e2e-Datei, in einem PR machbar.

## Offen

- -

## Naechster Schritt

- UX-Phase (`ai:needs-ux-ui`) laeuft als naechstes; danach Spec.

## Fallstricke

- `align-self` wirkt nur auf den `kol-button`-HOST; Shadow-DOM ist black box → Tests messen den Host.
- `.llm-provider-admin__actions` ist selbst ein Flex-Container → `align-self: stretch` am Kind
  greift dort NICHT wie in einer Column; mobil braucht es `flex-direction: column`.
- Breakpoints im File gemischt: `768px` (settings-action-btn) vs. `48rem` (llm-provider-admin) —
  wertgleich, aber konsistent halten.
- Body-Edit nur per `Write` in `.ai-memory/issue-1037-*.md` + `gh issue edit --body-file`
  (Heredoc scheitert am Bash-Tool-Parser, /tmp ist gesperrt).

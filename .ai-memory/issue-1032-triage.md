# Phasen-Notiz — Issue #1032, Phase 1 (Triage)

Ticket: "UX/UI - Update Message mobile Styling" (Autor deleonio). Erst-Triage (kein
KI-ANALYSE-Block im Body vorgefunden, Label `ai:needs-analyse`).

## Erledigt

- Issue-Body gelesen (`gh issue view 1032`): IST-Screenshot (1713x182) + zwei Wuensche —
  Notifikation mobil besser bedienbar (Schalter leicht antippbar), Text menschlicher.
- Code lokalisiert: `frontend/src/components/UpdatePrompt.tsx` (ganze Datei, 49 Zeilen),
  Styles `frontend/src/app.css:1555-1572` (`.update-prompt`, `.update-prompt kol-card`).
- Titel geschaerft, Body lektoriert, KI-ANALYSE-Block geschrieben, Ping-Kommentar gepostet.
- Labels NICHT manuell gesetzt — Workflow `01-claude-triage.yml:355-400` setzt
  `ai:model:*`, `ai:analysed` und den Folge-Trigger selbst aus VERDICT + Block.

## Relevante Stellen

- `frontend/src/components/UpdatePrompt.tsx:29-48` — Markup: `.update-prompt` > `KolCard`
  (`_label="Update"`) > `<p>Neue Version verfuegbar</p>` + `<span data-testid="pwa-update-reload">`
  > `KolButton _label="Neu laden"`. Zweite Card "Offline" analog mit `pwa-offline-close`.
- `frontend/src/app.css:1555` — `.update-prompt` position:fixed, bottom:0, padding 1rem,
  `padding-bottom: calc(1rem + env(safe-area-inset-bottom))`, flex column, `pointer-events:none`;
  `.update-prompt kol-card { pointer-events:auto }`. Keine Regel fuer den Button.
- `frontend/src/components/UpdatePrompt.test.tsx` — Vitest, mockt `virtual:pwa-register/react`
  und `@public-ui/react-v19`; Texte werden per Regex geprueft (Zeile 85, 113, 164, 182) →
  Textaenderung bricht genau diese Zeilen.
- `frontend/e2e/pwa-update-prompt.spec.ts:49-95` — Praezedenzfall: echter SW-Update-Zyklus ist in
  Playwright NICHT reproduzierbar; geprueft wird der CSS-Kontrakt ueber ein per
  `document.createElement` injiziertes Stellvertreter-Element mit Klasse `.update-prompt`.
- `frontend/src/main.tsx:42` — `register(DEFAULT, defineCustomElements)`: KoliBri-Elemente sind
  global registriert → injizierte `kol-button`/`kol-card` hydrieren auch in e2e.
- `docs/mobile-ui-rules.md` — Regel 2 (44px Minimum Repo-Abstimmung, 8dp Abstand), Regel 1
  (Daumenzone unteres Drittel), Regel 3 (kein h-Scroll bei 320dp).

## Annahmen

- Der Screenshot zeigt die Update-Card aus `UpdatePrompt.tsx` (Breite 1713px = Desktop,
  volle Viewport-Breite, Hoehe 182px passt zur KolCard mit Label+Text+Button). Nicht
  verifiziert — Bild nicht abgerufen.
- "Schalter" = der Reload-Button ("Neu laden"), nicht ein Toggle/Switch.
- Injizierte `kol-button`-Stellvertreter hydrieren in Playwright (siehe main.tsx:42).
  Fallback fuer die Spec-Phase: nur die eigene Light-DOM-Huelle
  (`span.update-prompt-action`) messen, deren Groesse unser CSS bestimmt.

## Verworfen

- Zerlegung in Sub-Issues: eine Komponente, eine CSS-Regel, zwei Texte → ein PR reicht.
- Autonomes Schliessen (Skill Schritt 6): app.css hat keine Button-/Touch-Target-Regel
  fuer `.update-prompt`, Text ist unveraendert das Fragment "Neue Version verfuegbar" →
  Anforderung nachweislich NICHT erfuellt.
- `scrollWidth <= viewport` als Overflow-AK: laut MEMORY.md (2026-08-24) strukturell
  untauglich, App-Shell clippt mit `overflow-x:hidden` → Bounding-Box messen.
- Manuelles Label-Setzen: doppelte `labeled`-Events, Workflow macht es ohnehin.

## Offen

- Zwei untracked Hilfsdateien liegen noch da: `.ai-memory/1032-body.md`, `.ai-memory/1032-ping.md`
  (Heredoc nach /tmp war blockiert, `rm`/`mv` nicht freigegeben). Nicht von `.gitignore`
  (`.ai-memory/issue-*.md`) gedeckt → vor einem Commit loeschen.
- Offline-Card ("App ist offline-bereit"): Ticket nennt nur die Update-Message. Textaenderung
  bleibt deshalb auf die Update-Card beschraenkt; das Touch-Target-CSS greift ueber den
  gemeinsamen Selektor fuer beide Cards (im Block als Randbedingung notiert).

## Naechster Schritt

Phase 2 (UX): konkrete mobile Layout-Entscheidung fuer die Update-Card treffen
(Button vollbreit im unteren Drittel, Abstand zu Safe-Area) und Textvorschlaege im
KI-UX-Block festhalten.

## Fallstricke

- Textaenderung MUSS `UpdatePrompt.test.tsx` Zeilen 85/113/164/182 mitziehen, sonst rot.
- Desktop nicht mitverbreitern: bei 1280px soll der Button inhaltsbreit bleiben (AK6),
  sonst entsteht ein 1700px breiter Button.
- KoliBri-Host ist block-level (MEMORY 2026-08-24) → `width:auto` = 100%; Breiten in
  Flex-Zeilen explizit teilen, nie `flex-shrink:0` auf einem 100%-Host.
- Shadow-DOM-CSS ist unpublizierte API (AGENTS.md KoliBri-First) → Touch-Target ueber den
  Host bzw. die eigene Light-DOM-Huelle setzen, nicht ueber interne Teile.

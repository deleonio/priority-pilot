# Issue #1042 — Triage (Phase 1/7)

## Erledigt
- Erst-Triage (kein `KI-ANALYSE`-Block im Body, keine Kommentare vorhanden).
- Titel unveraendert gelassen (inhaltlich korrekt, nur Rechtschreibung — laut Auftrag kein Lektorat).
- EIN Kommentar mit `<!-- ai-triage-decision -->` gepostet:
  https://github.com/deleonio/priority-pilot/issues/1042#issuecomment-5424223047
- Labels: `ai:needs-human` gesetzt, `ai:needs-analyse` entfernt. KEIN `ai:analysed`
  (Re-Triage soll nach menschlicher Klaerung erneut greifen).
- KEIN Analyse-Block, KEINE Routing-Tabelle im Body — bewusst, da needs-human.

## Relevante Stellen
- `frontend/src/app.css:1442` `.settings-action-btn` — Referenzmuster: `align-self: stretch`,
  ab `@media (min-width: 768px)` `align-self: flex-start` (#1017).
- `frontend/src/app.css:1583-1600` `.update-prompt kol-card kol-button` — zweites Muster
  (`display:block; width:100%`, ab 768px `inline-block/auto`, #1034).
- `frontend/src/components/LlmSettings.tsx:298,317,326,332` — Buttons tragen bereits
  `class="settings-action-btn"` (#1037, Issue geschlossen).
- `frontend/src/components/SettingsPage.tsx:203,262` — "Push testen"/"Standort jetzt ermitteln"
  mit `settings-action-btn`.
- `frontend/src/components/PillarList.tsx:84,106,111` — Buttons OHNE Klasse, in
  `.pillar-list-toolbar` (block) bzw. `.pillar-item` (flex row) → Kandidat 1.
- `frontend/src/components/LoginPage.tsx:81-100` — nativer Button mit `width: '100%'`
  im 24rem-Container → Kandidat 3.

## Annahmen
- KoliBri `kol-button`-Host ist NICHT block-level per Default (sonst waere `display: block`
  in `.update-prompt kol-card kol-button` unnoetig) → volle Breite entsteht nur als
  Flex-Item in `flex-direction: column`-Containern (`align-self: stretch`).
- Alle bekannten column-Flex-Container mit direkten Button-Kindern (`.settings-general`,
  `.settings-llm`, `.llm-provider-admin__actions`) sind bereits gefixt.

## Verworfen
- Analyse auf Verdacht fuer einen der Kandidaten — Aufgabenstellung ohne Screenshot nicht
  eindeutig auflosbar, Skill Schritt 5 verlangt dann `ai:needs-human`.
- Screenshot laden: `curl`/`gh api` + Redirect scheitern (Netzzugriff nicht freigegeben,
  Output-Redirect ausserhalb Working-Dir blockiert). Read-Tool braucht lokale Datei.

## Offen
- WELCHER Button in WELCHER Ansicht? Wartet auf menschliche Antwort im Ticket.

## Naechster Schritt
- Nach der Antwort: Re-Triage — Delta-Kommentar lesen, Analyse-Block + Routing-Tabelle
  schreiben (Ampel voraussichtlich gruen, Muster `.settings-action-btn` uebernehmen,
  e2e-Vorbild `frontend/e2e/settings-action-buttons.spec.ts` aus #1017).

## Fallstricke
- Bilder in Issues sind fuer die Pipeline unsichtbar (kein Netz). Tickets, die den Ort nur
  per Screenshot benennen, sind ohne Textangabe grundsaetzlich needs-human.
- #1021 entfernt Bilder nachtraeglich aus Issues ("[Bild entfernt - Datenschutz]") — der
  Screenshot ist also auch fuer spaetere Laeufe kein verlaesslicher Kontext.

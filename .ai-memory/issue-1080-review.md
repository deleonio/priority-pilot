# Issue 1080 — Review-Phase-Notizen (Kreuzverhör Runde 1, 2026-08-28)

## Erledigt
- MODE = Kreuzverhör (kein `<!-- ai-review -->`-Kommentar vorhanden); Review ohne Issue? Nein —
  `closingIssuesReferences` length = 1 (#1080), AK1–AK6 aus dem KI-ANALYSE-Block als Massstab.
- Full-Diff geprüft (6a723ff6 rot → 1ca138cf grün), Review **5047911581** mit 2 Inline-Findings
  gepostet (event=COMMENT): F1 `frontend/src/App.tsx:411`, F2 `frontend/e2e/ai-disable.spec.ts:114`.
- Sammelkommentar (id **5448425575**, Marker `<!-- ai-review -->`) erstellt: verdict needs-fixup,
  Sektionen Behobene Anmerkungen (leer) / Entscheidungs-Findings (keine) / Offene Findings (F1, F2).
- Title-Gate: PR umbenannt → `feat(frontend): make ai features disableable (#1080)` (war
  „Settings KI deaktivierbar (#1080)“, kein Conventional Commit).
- CI bei Review-Zeit: precheck/verify SUCCESS, review + e2e(1..4) laufen noch (kein Abschluss-🟢 nötig,
  da needs-fixup).

## Relevante Stellen
- `frontend/src/App.tsx:411` + `App.tsx:478` (`if (showSettings)`) + `closeSettings` — App bleibt beim
  Settings-Besuch gemountet; `useAiPreferences()`-State in App ist stale → F1 (wirkt erst nach Reload).
- `frontend/src/components/SettingsPage.tsx:418` — eigene Hook-Instanz, Toggle ändert nur ihren State.
- `frontend/src/lib/aiPreferences.ts` — Muster voiceAutostart korrekt; `useAiPreferences` nur für
  SettingsPage sinnvoll statebehaftet.
- `frontend/src/components/TaskForm.tsx:228` — `useMemo(() => readAiPreferences(), [])`: pro Dialog-Mount
  gelesen → von F1 NICHT betroffen (bewusst so belassen).
- `frontend/e2e/ai-disable.spec.ts:114` (AK4-Test) — nur Toolbar-Einstieg; Berater-Prefill
  `initialText` → `initialValues.description` (#327) wird nirgends geassertet → F2.
- Positiv geprüft: `.settings-llm-switch-row` mit `min-width`-Query (Mobile-first), keine
  `max-width`-Downgrades; Ausblendung per Nicht-Render (kein Fokus-Leak); #971-Count-Guard-Umgehung
  im Code + PR-Body begründet; Spec-Testkorrekturen (status 'Open', Navigationsschritte,
  Shadow-DOM-Input) im PR-Body dokumentiert → keine Separation-of-Duties-Verletzung.

## Annahmen
- F1 ist real: kein `key`-Remount von App, keine storage-Event-Subscription (per Lesezugriff auf
  App.tsx verifiziert; nicht im Browser ausgeführt).
- Defaults = Status quo halten bestehende e2e grün (Impl-Phase hat quick-capture/lektorat
  erfolgreich laufen lassen).

## Verworfen
- Architektur-Finding „KI-Ausblendung nur clientseitig, Server-Endpunkte offen“ — von AKs explizit
  gedeckt (reine UI-Ausblendung, im Issue-Analyseblock + Spec dokumentiert).
- Eigenes CSS statt `.settings-switch-row` — bewusst wegen #971-Guard, begründet, kein Finding.
- AK2-Wortlaut-Irrtum im AK-Text („Ist der Hauptschalter **aktiv** … nicht gerendert“ = Tippfehler
  im Issue, gemeint „deaktiviert“) — nicht als Finding geführt.

## Offen
- Fixup für F1 + F2 steht aus; danach Fixup-Nachweis-Runde (MODE wechselt, da ai-review-Kommentar
  jetzt existiert → Diff-Scoping ab `updatedAt` des Sammelkommentars).

## Nächster Schritt
- Fixup implementiert F1 (Präferenz-Read in App render-frisch machen, z. B. `readAiPreferences()`
  im Renderkörper) + F2 (Prefill-Assertion); danach Fixup-Nachweis-Review nur gegen diese Stellen.

## Fallstricke
- `gh api .../reviews -f body=… -F comments=…` splittert bei Inline-JSON → **JSON-Payload-Datei +
  `--input`** verwenden (hat hier funktioniert).
- `gh pr edit` hat kein `--jq` Flag.
- F1 ist leicht zu übersehen: Unit-Tests und alle e2e setzen die Präferenz VOR dem Laden — der
  Live-Apply-Pfad (Toggle → Zurück) ist testseitig ungedeckt; im Fixup den e2e-Fall mitliefern.
- Findings-Nummern F1/F2 stabil halten für die Fixup-Nachweis-Runde.

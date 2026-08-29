# Issue 1125 (PR #1125) — Fixup (Runde 1), Stand 2026-08-29

## Erledigt
- Finding 1 (🟡, NearbyCard-Region) umgesetzt: `frontend/src/components/NearbyCard.tsx` — Card-Host
  erhält `role="region"` + `aria-label={cardTitle}`; neuer `cardTitle`-Konstante im Component-Body
  (Zeile ~38) ersetzt die `_label`-Ternary, damit Titel und aria-label aus EINEM Ausdruck stammen
  (keine Duplikat-Ternary, dynamisch inkl. `(${displayDistanceKm} km)`). `_level={0}` unverändert
  gelassen (wie bei „Nächste Aufgabe“ trägt jetzt die Region den Namen; KoliBri rendert _level 0 als
  fetten Text — Review hatte das nur zusammen mit fehlender Region moniert).
- Tests: `frontend/e2e/issue-1066-nearby-card.spec.ts` — AK4-Test assertiert
  `getByRole('region', { name: 'In der Nähe' })` (Basis-Titel vor Label-Fetch) neben dem bestehenden
  „Nächste Aufgabe“-Check; AK2/AK3-Test assertiert `region name: /In der Nähe \(\d+([.,]\d+)? km\)/`
  (dynamischer Titel). Unit-Test in `NearbyCard.test.tsx` bewusst NICHT erweitert — KolCard ist dort
  gemockt (`data-label`), eine aria-label-Assertion würde nur den Mock prüfen (Fallstrick aus der
  Review-Notiz).

## Relevante Stellen
- `frontend/src/components/NearbyCard.tsx:95-102` — KolCard-Host mit role/aria-label/_label/_level.
- `frontend/src/components/Dashboard.tsx:181-186` — Vorbild-Muster (`dashboard-next-task`, role=region).
- `frontend/e2e/issue-1066-nearby-card.spec.ts:96-100,117-120` — neue Region-Assertions.
- `frontend/src/components/NearbyCard.test.tsx:33-34` — KolCard-Mock (Grund für E2E- statt Unit-Absicherung).

## Annahmen
- Attribute-Forwarding (role/aria-label) an KolCard-Host funktioniert im echten Browser — durch den
  grünen issue-1118-Region-Check für next-task belegt; issue-1066-Spec läuft als Gegenprobe.
- `displayDistanceKm` kommt als Zahl (Default 5) → Label „In der Nähe (5 km)“; Regex toleriert
  Komma/Punkt-Nachkommastellen.

## Verworfen
- `NearbyCard.test.tsx` um aria-label-Assertion erweitern — Mock deckt Forwarding nicht ab.
- `_level={0}` auf 3 ändern — sichtbare Überschriftengröße/Struktur wäre Verhaltensänderung über den
  Finding-Scope hinaus.

## Offen
- Gate- und gezielte E2E-Läufe (issue-1066 + issue-1118-Spec) — Ergebnisse im Commit/PR nachtragen.

## Nächster Schritt
- Gate (format/prettier/lint/knip/test) + gezielte E2E, commit+push, Review-Thread schließen,
  Sammelkommentar (`<!-- ai-review -->`) Finding 1 abhaken.

## Fallstricke
- aria-label dynamisch halten (Spiegel des `_label`) — nicht statisch „In der Nähe“.
- E2E-Run direkt `npx playwright test e2e/<datei>` im frontend-Verzeichnis (`--`-Filter funktioniert nicht).
- Sammelkommentar des Reviews nicht neu anlegen — bestehenden per PATCH aktualisieren.
- Keine Labels setzen (Workflow macht das).

## Erledigt (nachtrag, gleicher Lauf)
- CI-Regression aus demselben PR-Muster nachgezielt: `frontend/src/components/Dashboard.tsx:214-220`
  (Suggestions-Karte) trägt jetzt ebenfalls `role="region"` + `aria-label="Was ist jetzt dran?"` am
  Host — die entfernte Außen-`<section aria-label>` war in `suggestions.spec.ts:49` als Region
  verankert; CI e2e(4) schlug daran an (Commit `cb5a5d1b`). Review-Statement „Verlust der
  Außen-aria-labels unproblematisch" traf nur die Heading-Navigation, nicht diese Region-Assertion.
- CI-Verlauf: Run 33276646834 — e2e(4) rot an suggestions.spec.ts + tasks-tab-filter.spec.ts (AK4);
  Fix lokal verifiziert (8/8 grün inkl. tasks-tab-filter → dort Flaky). Run 33277220502 (Commit
  cb5a5d1b): e2e(1) rot an delete-dialog-focus.spec.ts AK9 (Fokus-Timing, PR-unberührt) →
  `gh run rerun --failed` → E2E(1)-(4) + verify ALLE GRÜN auf cb5a5d1b.
- Thread PRRT_kwDONloM186dcw8x beantwortet + resolved; Sammelkommentar 5464954841 gepatcht
  (Finding 1 in „Behobene Anmerkungen", offene Findings leer).
- Kein Playwright-MCP-Layout-Check nötig: nur Attribute, kein CSS; 375px-AKs laufen in den
  issue-1066/issue-1118-Specs (lokal + CI grün).

## Verworfen (nachtrag)
- tasks-tab-filter/delete-dialog-focus-CI-Rots jagen — beide Specs PR-unberührt und lokal grün
  (bzw. im Rerun grün): Flaky/Timing, dokumentiert statt gefixt.

## Offen
- Wegwerf-Artefakt: `.ai-memory/issue-1125-fixup-collected.md` (Body-Staging für den
  Sammelkommentar-PATCH) — NICHT committen; diese Datei ist die Phasen-Notiz.

## Nächster Schritt
- Fixup-Verifikation des Review-Workflows (Delta = 482aa826 + cb5a5d1b); kein weiterer Fix nötig —
  alle Findings behoben, CI grün. Re-Review übernimmt Phase 7.

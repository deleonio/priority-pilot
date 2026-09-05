# Issue 1219 — Fixup (Review Runde 1, PR #1233), Stand 2026-09-05

Kontext: Kreuzverhör Runde 1 → needs-fixup. 2 Blocker-Findings (beide fixable, KEINE
Entscheidungs-Findings), 1 nicht-blockierender Nit. Review-Kommentar-IDs: 5550353239
(ai-review, collected), Inline-Kommentare 3939894330 (SettingsPage.tsx:328) und
3939894339 (profile-display-name.spec.ts:44).

## Erledigt
- Findings SCOPED gelesen (ai-review-Kommentar + 2 Threads + CI-Verweis Lauf 33952363975,
  e2e-Shard 3 rot durch issue-843.spec.ts).
- **Finding 1 (Regession #843 AK1) gefixt:** `frontend/src/components/SettingsPage.tsx` —
  KolInputText + KolButton („Anzeigename speichern") in neuen Wrapper
  `<div className="settings-profile">` gesteckt; Button ist damit kein direktes Kind mehr von
  `.settings-general` und fällt aus der #843-Control-Liste
  (`issue-843.spec.ts:33`: `.settings-general > kol-button`) heraus. Kommentar im TSX erweitert.
- **CSS dazu:** `frontend/src/app.css` nach dem `.settings-action-btn`-Media-Block (vor
  `.settings-switch-row`) — `.settings-profile { display:flex; flex-direction:column;
  gap: var(--pp-gap-base); }` (16dp-Rhythmus wie Parent; `.settings-action-btn`-align-self
  greift im neuen Flex-Kontext weiter).
- **Finding 2 (Spec-Test AK7) gefixt:** `frontend/e2e/profile-display-name.spec.ts` —
  Kopfzeilen-Assertion von `toContainText(uniqueName)` auf `.app-header__user` umgestellt auf
  `toHaveAttribute('_label', uniqueName)` auf `.app-header__user kol-avatar` (per #865 steht
  sichtbar nur die Initiale „E1" dort; Präzedenz header-appearance.spec.ts:33-39; Begründung
  als Test-Kommentar). Korrektur war vom Review ausdrücklich freigegeben.
- **Nit mitgenommen:** `frontend/src/components/SettingsPage.test.tsx:545` — Spec-Kommentar
  „onSaved → Root → checkAuth" ersetzt durch tatsächlichen Mechanismus
  (`notifyProfileChanged` → Root hört auf `PROFILE_CHANGED_EVENT`, kein /auth/me-Roundtrip).

## Relevante Stellen
- `frontend/e2e/issue-843.spec.ts:33` — Control-Selektor `> kol-button` (nur oberste Ebene);
  Grund für den Wrapper.
- `frontend/e2e/settings-action-buttons.spec.ts:139` — `.settings-general > kol-button`
  .filter('Push testen'): „Push testen"-Button muss direktes Kind BLEIBEN (nicht in den
  Wrapper packen!).
- `frontend/src/App.tsx:663-664` — `.app-header__user` enthält `KolAvatar _label={user.displayName}`.
- `frontend/src/lib/profileChanged.ts` — PROFILE_CHANGED_EVENT + notifyProfileChanged.

## Annahmen
- Wrapper ändert das sichtbare Layout nicht (gleicher flex-column + 16px-gap-Rhythmus,
  gleiche DOM-Reihenfolge) — deshalb kein zusätzlicher Playwright-MCP-Screenshot-Lauf;
  die 375px-Layout-AK bleibt durch profile-display-name.spec.ts selbst abgesichert.
- Review meinte mit „z. B. `.settings-profile`" genau diesen Klassennamen — übernommen.

## Verworfen
- #843/#1017-Locatoren lockern — vom Review explizit verboten.
- „Push testen"/„Standort ermitteln"-Buttons mit in den Wrapper — würde settings-action-
  buttons.spec.ts:139 (`.settings-general > kol-button`) brechen.

- Fix-Commit c76e4272 gepusht (inkl. Phasen-Notiz), Gate grün (274/274), e2e issue-843 +
  profile-display-name + settings-action-buttons lokal grün, ai-fixup-decisions-Kommentar
  5550430667 angelegt (✅-Tabelle), beide Threads (PRRT_...Vwq, PRRT_...Vwz) resolved.
- **CI-Fix nachgezogen:** Run 33953915593 (e2e-Shard 3) fiel 2× identisch an issue-969.spec.ts
  AK4 — `panel.boundingBox()` null direkt nach `toBeVisible` (KI-Provider-Panel; Fehler-Kontext-
  Snapshot belegt: Panel gerendert). Lokal: ganzer Shard + 25× Wiederholung grün → Mess-Race
  auf langsamen Runnern. Fix: pollende Box-Abfrage via `expect.poll`, Assertion unverändert.

## Offen
- CI nach dem zweiten Fix-Commit beobachten (e2e-Shard 3 muss grün werden).

## Nächster Schritt
- Commit <SHA2> (issue-969-Poll-Fix) pushen, ✅-Tabelle im Kommentar 5550430667 um CI-Zeile
  ergänzen, Runde beenden (kein Verdict — Commits zählen).

## Fallstricke
- Keine Labels setzen (Workflow macht das selbst).
- ai-fixup-decisions-Kommentar: NEU anlegen (noch keiner da — geprüft? NEIN, vor dem Posten
  via `gh api .../issues/1233/comments --jq 'select(startswith("<!-- ai-fixup-decisions -->"))'`
  prüfen, ob Runde-x schon einen angelegt hat) und danach PATCHen, nie neu anlegen.
- Threads sind GraphQL-only; resolveReviewThread mit threadId (nicht commentId).

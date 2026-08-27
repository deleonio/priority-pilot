# Issue 1073 — Impl-Phase

## Erledigt
- Draft-PR #1076 übernommen, `feat/issue-1073-footer-address` ausgecheckt, Implementierung committet (f7e6480c) und gepusht; PR über `gh pr ready 1076` review-fertig, Body erweitert.
- `frontend/src/components/Footer.tsx:4-17` — konsumiert jetzt `address`; `location = address?.trim() || (geoEnabled && position ? coords : null)`; Separator `" | "` als `aria-hidden`-Span; `min-width:0` + `overflow-wrap:anywhere` am Text-Span; 📍-Emoji entfernt (KI-UX).
- Gate: format/prettier/lint/knip ✅; `pnpm test` nur mit dem bekannten pre-existing Redis-Fehler (`server/src/express/session.test.ts:249`, per `git stash` auf sauberem Stand verifiziert); frontend unit 426 passed ✅; e2e neue Spec 3/3 ✅, `footer-version.spec.ts` 2/2 ✅.
- PR-Body mit Gate-Ergebnissen + Test-Pflege-Bedarf in `.ai-memory/issue-1073-pr-body.md` (Quelle für `gh pr edit --body-file`).

## Relevante Stellen
- `frontend/src/components/Footer.tsx` — einzige Produktionsänderung.
- `frontend/src/lib/useGeolocation.ts:17-27` — Präferenz aus `localStorage['pp-geolocation-enabled']`, Default **aus**; Grund für den e2e-Testpflege-Fix.
- `frontend/e2e/issue-1073-footer-address.spec.ts:29` — neuer Helper `enableGeolocationPreference` (`addInitScript` setzt localStorage), in allen 3 Tests vor `goto('/')` aufgerufen; keine Assertions verändert.
- `frontend/src/components/Footer.test.tsx` — unverändert (Spec-Vertrag), 8/8 grün mit der Implementierung.

## Annahmen
- AK4/AK5 durch bestehende #290-Tests abgedeckt — keine Duplikate.
- e2e-Mocks: `**/auth/me` (Auth-Gate) und `**/reverse-geocode*` (429 für Fallback-Fall).

## Verworfen
- KolAlert/Skeleton/Ladezustand — stiller Fallback laut KI-UX-Block.
- KoliBri-Komponente — keine bedienbare Komponente, reiner Text-Span.
- Aria-hidden-Separator weglassen — KI-UX-Kür, günstig umgesetzt.

## Offen
- -

## Nächster Schritt
- Review-Phase ( Kreuzverhör-Loop, SKILL.md Step 5): `gh pr checks 1076` beobachten, auf Review-Kommentare reagieren.

## Fallstricke
- Spec-e2e hatte NUR `test.use({permissions:['geolocation']})` — das schaltet die App-Präferenz NICHT ein; Footer rendert dann nur "Version …". Ohne localStorage-Init-Script bleiben alle 3 Tests rot trotz korrekter Implementierung.
- `pnpm test` bricht beim Server-Redis-Fehler ab, bevor frontend test läuft → frontend-Tests separat (`pnpm --filter frontend test`) verifizieren.
- e2e direkt im `frontend/`-Verzeichnis mit `npx playwright test <datei>` laufen lassen (pnpm-Filter arglosen Aufruf läuft ganze Suite).

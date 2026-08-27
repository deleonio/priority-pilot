## Implementierung (#1073)

Fußzeile zeigt die lesbare Adresse aus `useGeolocation().address` statt der Roh-Koordinaten; ohne Adresse (null/leer) werden die Koordinaten als stiller Fallback angezeigt. Trennung Adresse/Koordinaten ↔ Version exakt mit `" | "` (statt nur `marginRight`).

**Geänderte Dateien**
- `frontend/src/components/Footer.tsx` — konsumiert jetzt auch `address`; Fallback-Logik; Separator `" | "` als `aria-hidden`-Span; `min-width: 0` + `overflow-wrap: anywhere` gegen Überlauf bei 375px (AK6); 📍-Emoji entfernt (KI-UX-Empfehlung: doppelt neben lesbarer Adresse + Screenreader-Geräusch)
- `frontend/e2e/issue-1073-footer-address.spec.ts` — siehe „Test-Pflege-Bedarf"

**AK-Abdeckung**
- AK1/AK2a/AK2b/AK3a/AK3b: Unit-Tests `frontend/src/components/Footer.test.tsx` (8/8 grün)
- AK1/AK2/AK3/AK6: e2e `frontend/e2e/issue-1073-footer-address.spec.ts` (3/3 grün)
- AK4/AK5 (Version, `role="contentinfo"`): bereits durch bestehende Tests in `Footer.test.tsx` (#290) abgedeckt — bewusst keine Duplikate ergänzt

**Test-Pflege-Bedarf**
- `frontend/e2e/issue-1073-footer-address.spec.ts:29` (neu, Helper `enableGeolocationPreference`): Die Spec-Tests scheiterten trotz korrekter Implementierung an **allen drei** Tests — auch am Koordinaten-Fallback (AK2). Ursache: der Footer rendert nur bei `enabled=true`, und `useGeolocation` liest die Präferenz aus `localStorage['pp-geolocation-enabled']` mit Default **aus** (`useGeolocation.ts:17-27`, bewusste Entscheidung aus #845). `test.use({ permissions: ['geolocation'] }` ersetzt diese Präferenz nicht. Der Kommentar in Zeile 38 des Spec-Entwurfs („gespeicherte Präferenz, damit der Footer position/address lädt") benennt die Absicht, das `addInitScript` fehlte aber. Fix: drei Aufrufe `enableGeolocationPreference(page)` vor `goto('/')` ergänzt; keine Assertion verändert.

**Gate-Ergebnisse**
- `pnpm format` ✅ · `pnpm exec prettier --check .` ✅ · `pnpm lint` ✅ · `pnpm knip` ✅
- `pnpm test` ⚠️ — server: 1 bekannter, umgebungsbedingter Fehler (`server/src/express/session.test.ts:249` „AK-5 — Redis-Store", braucht Redis, lokal nicht vorhanden; per `git stash` auf sauberem Stand verifiziert → pre-existing, nicht von diesem PR berührt). Frontend: 426 passed / 13 skipped ✅
- e2e: `npx playwright test e2e/issue-1073-footer-address.spec.ts` 3/3 ✅, bestehende `e2e/footer-version.spec.ts` 2/2 ✅ (Regression geprüft, da Footer-Verhalten sichtbar geändert wurde)

**UX (KI-UX-Block)**
- Kein KoliBri nötig (keine bedienbare Komponente, reiner Text-Span wie zuvor)
- Stiller Fallback statt Ladezustand/Alert; Footer-Höhe springt nicht (einzeiliger Span)
- Reflow: `min-width: 0` + `overflow-wrap: anywhere`; AK6 prüft per Bounding-Box bei 375px (scrollWidth ist wegen `overflow-x: hidden` der App-Shell zahnlos)

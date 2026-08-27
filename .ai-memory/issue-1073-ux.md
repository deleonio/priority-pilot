# Issue 1073 — UX-Phase

## Erledigt
- UX-Review abgeschlossen und als KI-UX-Block in den Issue-Body geschrieben (nach `<!-- KI-ANALYSE:END -->`, vor nichts weiter; Body via `gh issue edit 1073 --body-file .ai-memory/issue-1073-body-new.md`). Vollständiger Body liegt in `.ai-memory/issue-1073-body-new.md`.
- Geprüfte Quellen (statisch, kein Browser): `frontend/src/components/Footer.tsx`, `docs/mobile-ui-rules.md` (10 Regeln + Repo-Abstimmung: 375px, 44px Targets), `.ai-knowledge/ux-design.md` (Farbrollen `--pp-*`, Skalen, KoliBri-Pflicht, Roh-HTML-Ausnahmen).
- Kernempfehlungen im Block: kein Überlauf bei 375px/200 % (`min-width:0` + `overflow-wrap`), Footer-Höhe darf beim Adressnachladen nicht springen, stiller Fallback statt KolAlert, `--pp-space-*` statt `marginRight: 1rem`, 📍-Emoji `aria-hidden` oder streichen, Kontrast in hell+dunkel rechnen.

## Relevante Stellen
- `frontend/src/components/Footer.tsx:3-16` — Zielfichier; aktuell Koordinaten + `Version`, Trennung nur via `marginRight: 1rem` (Zeile 8), 📍-Emoji ohne `aria-hidden`, `role="contentinfo"` Zeile 7.
- `frontend/src/lib/useGeolocation.ts:167,247` — liefert `address: string | null` (Nominatim), async verzögert → Basis für Fallback-/Sprungfreiheit-Empfehlung.
- `docs/mobile-ui-rules.md` — Regel 3 (Reflow 320px/200 %), Regel 6 (Tokens), Regel 7 (async Zustände).
- `.ai-knowledge/ux-design.md` §2 (Kontrast beidseitig, Fläche+Text reisen zusammen), §3 (Skalen), §4 (KoliBri zuerst, Roh-HTML nur Layout).

## Annahmen
- Separator „ | " bleibt wie in AK3 verankert.
- `--pp-font-size-sm` ist die bestehende Footer-Metadaten-Konvention (im Body als Beibehalten empfohlen, nicht nachgemessen).

## Verworfen
- KoliBri-Komponentenempfehlung für den Footer-Text — keine bedienbare Komponente im Spiel, reines `span` ist etabliert und zulässig.
- KolAlert/Skeleton für fehlende/ladende Adresse — stiller Fallback ist die richtige UX (Fußzeilen-Metadaten, kein Fehlerfall).
- Browser-/Playwright-Prüfung — laut Auftrag nicht erlaubt; nur statische Regelprüfung.

## Offen
- -

## Nächster Schritt
- Spec-Phase (`ai:needs-ux-ui` → Labelwechsel durch Workflow): rote Tests je AK gemäß KI-ANALYSE-Testfällen, e2e zusätzlich 200 %-Textvergrößerung/320px laut KI-UX-Empfehlung.

## Fallstricke
- 📍-Emoji in `Footer.tsx` hat kein `aria-hidden` — muss in der Umsetzung mitgedacht werden, sonst Screenreader-Geräusch (im KI-UX-Block vermerkt).
- Adressen sind variabel lang: reine 375px-Breitenprüfung reicht nicht, Reflow-Fall (200 %, 320px) ist der eigentliche Test.
- Body-Dateien unter `.ai-memory/` per Write + `gh issue edit --body-file` (Heredoc/gh-Body-Quoting-Falle, siehe MEMORY.md 2026-08-26).

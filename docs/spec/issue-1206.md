# Spec #1206 — Changelog-Tab: Aggregation nach Kategorien und klickbare Links

Status: rot (Spec-Phase, Tests noch nicht erfüllt) · Issue: #1206 · Vorgänger: #1190 (`docs/spec/issue-1190.md`)

## Ziel

Der Changelog-Tab der Hilfe-Seite aggregiert die Release-Bodys aller geladenen Releases
nach Kategorien (wie sie `.github/release.yml` erzeugt: 💥 Breaking Changes, 🎉 New
Features, 🐞 Bug Fixes, 🚀 Improvements, 🔧 Engineering, Other Changes) und linkifiziert
URLs im Eintragstext. Lazy-Load/Retry aus #1190 bleiben unverändert.

## Vorbedingungen

- Hilfe-Seite `/hilfe` mit Tabs „Handbuch" (Index 0, initial aktiv) und „Changelog"
  (Index 1) — Vertrag aus #1190.
- GitHub-Releases-API liefert Bodys mit `### <Emoji> <Kategorie>`-Abschnitten und
  Bullets (`- Eintrag`); URLs darin sind überwiegend nackt (`https://…`), teils als
  Markdown-Links `[Text](url)`. Bodys können einen führenden
  `<!-- Release notes generated … -->`-HTML-Kommentar enthalten (wird ignoriert).

## Schritte / Verhalten

1. **Links (AK1):** Der Changelog-Body wird mit GFM-Autolink-Unterstützung gerendert:
   Nackte URLs werden ebenso wie `[Text](url)`-Markdown-Links zu echten
   `<a href="…">`-Elementen. Externe Links öffnen in neuem Tab
   (`target="_blank"` + `rel="noopener noreferrer"`, KI-UX).
2. **Aggregation (AK2):** Je Kategorie erscheint genau EIN Abschnitt mit
   Überschrift (Kategoriename als Text, nicht nur Emoji — WCAG 1.4.1), in der
   Reihenfolge Breaking Changes → New Features → Bug Fixes → Improvements →
   Engineering → Other Changes. Leere Kategorien entfallen. Die bisherige
   h2-je-Release-Struktur mit Releasedatum entfällt (KI-UX: Datum statt pro Bullet
   lieber ganz weglassen).
3. **Vollständigkeit (AK3):** Kein Eintrag geht verloren — Anzahl gerenderter
   Bullets = Summe der Bullets aller Release-Bodys. Jeder Bullet trägt eine
   erkennbare Ursprungs-Version (Klammer-Suffix, KI-UX-Empfehlung; andere
   Darstellung erlaubt, solange die Version im Bullet-Text sichtbar ist).
4. **Mobile-First (AK4):** Bei 375 px clippt kein sichtbares Element (inkl.
   Shadow-DOM) horizontal aus dem Viewport — Bounding-Box-Prüfung, kein
   `scrollWidth` (App-Shell clippt `overflow-x`, Erfahrung 2026-08-24). Lange
   nackte URLs brauchen Wortbruch (`overflow-wrap`).
5. **Lazy-Load/Retry unverändert (AK5):** Erstes Aktivieren lädt, Ladefehler →
   Meldung, erneutes Aktivieren startet neuen Versuch, Handbuch-Tab unberührt —
   die #1190-Tests dafür laufen weiter (nur angepasst, wo die neue
   Kategoriestruktur sie bewusst ändert: keine h2-je-Release-/`<time>`-Assertions
   mehr).

## Erwartetes Ergebnis (Tests)

- `frontend/src/components/HelpPage.test.tsx` — neue Describe-Gruppe `#1206`:
  AK1 (Autolink + Markdown-Link als `a[href]`), AK2 (eine Überschrift je Kategorie,
  Reihenfolge, leere Kategorien fehlen, Bullets beider Versionen unter derselben
  Kategorie), AK3 (li-Gesamtzahl = Bullet-Summe, Version je Bullet sichtbar).
  Bestehende #1190-Tests: AK1/AK5 unverändert, AK2/AK3 an die aggregierte Struktur
  angepasst (Test-Pflege).
- `frontend/e2e/help-changelog.spec.ts` (neu) — AK4: 375-px-Viewport, gemockte
  Releases mit langer nackten URL, Kategorie-Blöcke sichtbar, kein Clipping.

## Abgrenzungen

- Keine Tests für reines CSS (Link-Styling/Focus-Ring aus KI-UX) und die neue
  Abhängigkeit `remark-gfm` — visuell bzw. über AK1/AK4 verifiziert.
- Renovate-/Dependabot-Filterung passiert upstream (release.yml) — Frontend
  filtert weiter nichts (kein Test).

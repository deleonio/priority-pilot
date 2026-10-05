# Spec #1976 — Vorlagen-Seiten für Lebensprojekte

Ziel: Statische deutsche Website-Seiten `/vorlagen/` (Übersicht) und `/vorlagen/<slug>/` (je Lebensprojekt) mit Checkliste in Abhängigkeitsreihenfolge; Datenbasis für den späteren Vorlagen-Import (#1993, nicht Scope).

## Datenvertrag (`website/src/templates.ts`)

- Export `TEMPLATES`: Liste von `{ slug, title, description, steps }`; `steps`: `{ id, title, after: string[] }[]`.
- Mindestens sechs Vorlagen, eindeutige Slugs, je mindestens fünf Schritte.
- `after` verweist nur auf Schritt-`id`s derselben Vorlage; Reihenfolge der Schritte topologisch gültig (Vorgänger stehen davor, keine Zyklen).

## Rendering (`website/src/render.ts`)

- `renderTemplateIndex({ locale: 'de', messages, siteUrl, allMessages })` und `renderTemplatePage({ ...gleicher Kontext, template })`.
- Jede Seite: eigener `<title>`, nicht-leere Meta-Description, `<link rel="canonical">` auf ihre URL, genau eine `h1`.
- Vorlagen-Seite: Schritte als `ol > li` in Datenreihenfolge; Schritte mit Vorgängern nennen diese als sichtbaren Text „nach: <Titel>“ (mit Namen, nicht Nummer).
- Vorlagen-Seite und Übersicht verlinken die App (`href="/app/"`); Übersicht verlinkt alle Vorlagen-Seiten; deutsche Startseite verlinkt `/vorlagen/`.

## Build

- Schreibt `dist/vorlagen/index.html` und `dist/vorlagen/<slug>/index.html`; alle Pfade in `sitemap.xml`; `robots.txt` sperrt `/vorlagen/` nicht.

## Mobile (375 px)

- Kein horizontaler Überlauf (Bounding-Box), Checkliste und App-Link sichtbar.

## Abdeckung

AK1–AK5: `website/src/templates.test.ts`; AK2/AK5/AK6: `website/e2e/templates.spec.ts`.

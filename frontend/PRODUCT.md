# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primärnutzer ist der Eigentümer selbst: Priority Pilot ist sein Daily Driver — die reale tägliche Arbeitsplanung passiert in der App. Zugang ausschließlich über Google-Login mit E-Mail-Allowlist; neben dem Eigentümer sind nur freigeschaltete Adressen zugelassen. Bestätigte Ambition (2026-08-18): »Aspiring Product« — die Allowlist ist der heutige Zustand, mittelfristig soll Priority Pilot für eine breitere Nutzerschaft geöffnet werden.

## Product Purpose

Priority Pilot beantwortet die Frage »Woran sollte ich als Nächstes arbeiten?« für Situationen, in denen Aufgaben voneinander abhängen und zugleich auf unterschiedliche Lebensbereiche einzahlen. Zwei Rechen-Kernkonzepte:

- **Gewichteter Abhängigkeitsgraph:** Abhängigkeiten tragen Gewichte. Pro Aufgabe werden Wertbeitrag (eigene Priorität plus gewichtete Werte der abhängigen Aufgaben) und Gesamtaufwand inklusive transitiver Abhängigkeiten berechnet; Zyklen werden erkannt und abgelehnt.
- **Lebensbalance-Säulen:** nutzerdefiniert (neue Konten starten mit fünf Defaults: Körper, Beziehungen, Sinn, Mentale Gesundheit, Wirksamkeit — frei bearbeitbar). Jede Aufgabe zahlt auf 0..n Säulen ein (Investitionsanteil `share` mit Konfidenz `confidence`); die Säulen-Gewichtung (Summe 100 %) skaliert den Wertbeitrag multiplikativ. Gleichverteilung bleibt neutral.

Erfolg bedeutet heute: Der Eigentümer plant seine echte Arbeit täglich darin. Der bewusst kleine Funktionsumfang (Prototyp-Stadium) ist eine Phase-Beschreibung, kein dauerhaftes Dogma — der Umfang wächst bewusst mit.

## Positioning

Die Kombination ist der Unterschied: Priorität als **berechneter Wertbeitrag aus einem gewichteten Abhängigkeitsgraphen**, multiplikativ gesteuert durch **persönliche Lebensbalance-Säulen**. Lineare To-do-Listen und Kanban-Boards rechnen nicht über einen DAG; Projektmanagement-Tools modellieren Lebensbalance nicht als Steuereingabe. Priority Pilot liefert beides in einer Zahl pro Aufgabe — wertvollste Aufgaben zuerst, sinnvolle nächste Aufgabe (höchste Priorität bei erledigten Abhängigkeiten) sichtbar.

## Operating Context

- Persönliche Aufgabenplanung, Desktop und mobil; als PWA installierbar (Install-/Update-Prompt, Web-Push).
- Spracheingabe (Voice-Field mit Mikrofon-Freigabe, Autostart-Option), Quick-Capture, Geolocation-Nutzung im Frontend vorhanden.
- KI-Kaskade Mistral + OpenRouter für den Säulen-Beraten (Pillar Advisor, `suggest-pillars`); ohne konfigurierten Key antwortet der Endpoint mit HTTP 503.
- Zwei Betriebsarten: Cloud (dedizierter Linux-Server, Caddy TLS, PM2, Deploy via GitHub Actions) und Local (Entwicklung/Selbsthosting); nightly SQLite-Backup via `maintenance.sh`.
- UI durchgehend Deutsch, Du-Form.
- Mobile Einhandbedienung ist der Leitfall: Referenz-Viewport 375px.
- `/bahn`: öffentlicher Bahnroutenplaner ohne Login (#225) — eigenständiges Mini-Tool auf derselben Domain, kein Teil der Priorisierungs-Workflows.

## Capabilities and Constraints

- Vier Hauptansichten per Tab-Leiste: **Dashboard**, **Aufgaben** (Umschalter offen/erledigt), **Serien** (wiederkehrende Aufgaben), **Wald** (Aufgabenbaum). Kopfzeile mit fünf Icon-Aktionen: Task anlegen, Säulen-Berater, Einstellungen, Hilfe, Abmelden.
- Technik verbindlich: KoliBri (`@public-ui`) als Komponenten-Bibliothek, React 19, Vite-PWA; typsichere API-Anbindung per `openapi-fetch` gegen die gemeinsame `openapi.yml` (Express 5 + Sequelize 6/SQLite im Backend).
- Farb-Tokens `--pp-*` existieren in `frontend/src/app.css`; Spacing-/Radien-/Typografie-Tokens existieren (noch) nicht — Token-Pflicht gilt für neues CSS.
- Deutschsprachige UI ohne i18n-Infrastruktur ist Ist-Zustand, aber nicht als bindende Festlegung bestätigt (offenes Faktum für künftige Produktarbeit).

## Brand Commitments

Name **Priority Pilot** und vorhandenes Logo (Frontend-Assets, Transparenz durch Tests gesichert) sind bestehende Assets. Weitere bindende Marken-Vorgaben (Stimme, Stil, Wortmarke) wurden nicht festgelegt.

## Evidence on Hand

- `docs/user-guide.md` (vollständiges Nutzerhandbuch), `README.md` (Fachlogik), ADRs unter `docs/adr/`, verbindliches Mobile-UI-Regelset `docs/mobile-ui-rules.md`, UX-Pattern-Doku (`docs/ux-pattern-sequential-confirmation.md`).
- Stärkster Beweis: die echte tägliche Nutzung durch den Eigentümer.
- Keine Testimonials, Fallstudien, Presseberichte oder Nutzerzahlen vorhanden — künftige Flächen dürfen solche Nachweise nicht erfinden.

## Product Principles

1. **Berechneter Wert statt Bauchgefühl.** Die Antwort auf »Was als Nächstes?« kommt aus dem Graphen, nicht aus einer Meinung.
2. **Lebensbalance ist Eingabe, nicht Bericht.** Säulen lenken die Priorisierung multiplikativ, bevor Arbeit erledigt wird — nicht erst in der Rückschau.
3. **Daily-Driver-First.** Jede Funktion beweist sich zuerst in der echten täglichen Nutzung des Eigentümers.
4. **Gebaut, um sich zu öffnen.** Entscheidungen halten den Weg zur breiteren Nutzerschaft offen (Zugänglichkeit, Onboarding), ohne Wachstum vorzugaukeln.
5. **Barrierefreiheit ist tragend.** KoliBri plus WCAG 2.2/BITV 2.0 sind strukturelle Basis, kein Nachtrag.

## Accessibility & Inclusion

Verbindlich laut `docs/mobile-ui-rules.md`: WCAG 2.2 / BITV 2.0 als Maßstab; Touch-Targets mindestens 44px (KoliBri `--a11y-min-size: 2.75rem`), 48dp als Designziel, ≥8dp Abstand; Icon-only-Buttons immer mit `aria-label`; kein horizontales Scrollen bei 375px Viewport und 200 % Textvergrößerung (WCAG 1.4.10 Reflow); Referenzgerät 375px-Viewport, Einhandbedienung mit dem Daumen.

# Issue 1190 — Changelog-Tab neben dem Handbuch auf der Hilfe-Seite

Spezifikation (Stufe 1 TDD, rote Tests): `docs/spec/issue-1190.md`.
Basis: Issue #1190 + KI-ANALYSE-Block (Harness-Kommentar, stand 2026-09-03T10:42:00Z)

- KI-UX-Block (advisory, nicht blockend).

## Ziel

Die Hilfe-Seite (`/hilfe`, `frontend/src/components/HelpPage.tsx`) bekommt eine
Tab-Navigation mit zwei Tabs: **„Handbuch“** (initial aktiv, Inhalt wie bisher aus
`/user-guide.md`) und **„Changelog“**. Der Changelog-Tab lädt beim **ersten Aktivieren**
(lazy, nicht beim Betreten der Hilfe-Seite) die letzten Releases über die öffentliche
GitHub-Releases-API und zeigt sie als flache Liste: neueste zuerst, je Eintrag
Versionsnummer (`tag_name`) und Datum (`published_at`, de-DE formatiert), darunter der
Release-Body mit ReactMarkdown gerendert. Schlägt das Laden fehl, erscheint eine
verständliche Meldung im Changelog-Panel; ein erneutes Weg-/Zurückschalten des Tabs
startet einen neuen Versuch. Zurück-Button, `/hilfe`-Route und die bestehenden
#256-e2e-Tests bleiben unberührt.

## Voraussetzungen

- `KolTabs` nach dem Bestandsmuster `frontend/src/components/SettingsPage.tsx:243`:
  `_tabs`-Modulkonstante, `_on={{ onSelect }}`-Callback, beide Panels bleiben gemountet,
  inaktive nur hidden. Der React-Wrapper von @public-ui setzt Objekt-Props
  (u. a. `_tabs`, `_on`) als **Properties** auf das `kol-tabs`-Element — auch in jsdom
  ohne Custom-Element-Upgrade; Unit-Tests greifen deshalb auf `_tabs`/`_on.onSelect`
  direkt zu (Muster `SettingsPage.test.tsx:301-309` für die Slot-Container).
- Datenquelle (fix im Code, kein UI-Regler):
  `https://api.github.com/repos/deleonio/priority-pilot/releases?per_page=30`
  (öffentlich, kein Token). Felder `tag_name`, `published_at`, `body`. Das Frontend
  rendert die Releases **in API-Reihenfolge** (die API liefert neueste zuerst) und
  filtert nichts selbst — Renovate-/Dependabot-Ausschluss passiert upstream
  (`.github/release.yml`, AK4).
- Fehler-Fallback analog zum bestehenden Handbuch-Fallback (`HelpPage.tsx:17-20`);
  gemäß KI-UX genügt eine verständliche Text-Meldung („Changelog konnte nicht geladen
  werden“), KolAlert ist optional.
- Markdown-Rendering: Release-Bodys beginnen bei `###` — die Kategorie-Abschnitte
  erscheinen als `h3`, die Versionsnummer jedes Releases als `h2` (kein
  Überschriftensprung hinter der Seiten-überschrift, KI-UX A11y).
- Datum maschinenlesbar: `<time datetime="<published_at>">` mit sichtbarem de-DE-Text
  (`new Date(published_at).toLocaleDateString('de-DE')`, z. B. „2.9.2026“), KI-UX A11y.

## Akzeptanzkriterien

### AK1 — Zwei Tabs, Handbuch initial, Panel-Inhalte bleiben erhalten

- Ablauf: Hilfe-Seite rendern (Unit: `/user-guide.md` gemockt); Tab-Labels prüfen;
  auf den Changelog-Tab schalten.
- Erwartetes Ergebnis: `kol-tabs` trägt `_tabs`-Labels `['Handbuch', 'Changelog']`
  (Handbuch zuerst = initial aktiv). Das Handbuch (`[slot="tab-0"]`) wird gerendert und
  **nicht neu geladen**: `fetch('/user-guide.md')` wird trotz Tab-Wechsels genau einmal
  aufgerufen; der Handbuch-Inhalt bleibt im DOM (Panel bleibt gemountet).

### AK2 — Changelog lädt lazy, 30 Releases, neueste zuerst, Version + Datum

- Ablauf: Render mit gemocktem `fetch`; **vor** dem Tab-Wechsel darf kein
  GitHub-API-Call passiert haben (lazy, Rate-Limit-Schonung); dann Changelog-Tab
  aktivieren.
- Erwartetes Ergebnis: Es wird genau die URL mit `per_page=30` abgerufen. Im Panel
  `[slot="tab-1"]` erscheint pro Release ein Block mit der Versionsnummer als `h2`
  (Text = `tag_name`) und einem `<time datetime="<published_at>">` mit de-DE-Datum —
  in API-Reihenfolge (Fixture: neuestes Release zuerst).

### AK3 — Release-Body mit ReactMarkdown gerendert

- Ablauf: Fixture-Body mit `### 💥 Breaking Changes`-Abschnitt rendern.
- Erwartetes Ergebnis: Der Kategorie-Abschnitt erscheint als sichtbare `h3`-Überschrift
  mit dem Abschnittstitel; Listen-Items des Bodys werden als `li` gerendert. Der Body
  wird unverändert gerendert (kein Frontend-Filter).

### AK4 — Kein Renovate-/Dependabot-Filter im Frontend

- Erwartetes Ergebnis: gewährleistet upstream durch `.github/release.yml` (exclude
  authors + `release:ignore`); das Frontend rendert den Body unverändert.
- **Kein eigener Test** (Non-Application-Code / Upstream-Konfiguration — ein
  YAML-String-Match wäre ein zahnloser Change-Detector, ADR 0001). Die
  „unverändert-gerendert“-Seite deckt AK3 mit ab (Fixture enthält einen
  upstream-typischen Body).

### AK5 — Ladefehler: verständliche Meldung, Handbuch unberührt, Retry

- Ablauf: `/user-guide.md` erfolgreich, GitHub-API-Fetch rejected (Netzwerk-/
  Rate-Limit-Fehler); Changelog-Tab aktivieren; danach weg- und zurückschalten.
- Erwartetes Ergebnis: Im Changelog-Panel erscheint eine Meldung, die
  „konnte nicht geladen werden“ thematisiert. Der Handbuch-Inhalt bleibt sichtbar/
  im DOM. Beim erneuten Aktivieren des Changelog-Tabs wird die API erneut aufgerufen
  (Lazy-Merkzeller wird im Fehlerfall zurückgesetzt, KI-UX Recovery-Pfad).

### AK6 — Mobile-First: 375 px ohne horizontales Clipping

- Ablauf (e2e, GitHub-API per `page.route` mit Fixture erfüllt — bewusst kein
  Live-Abruf): 375-px-Viewport, `/hilfe` öffnen, beide Tabs über ihre Rollen finden,
  „Handbuch“ ist initial gewählt (`aria-selected`), auf „Changelog“ wechseln, Release
  aus der Fixture abwarten.
- Erwartetes Ergebnis: Tab-Wechsel gelingt; kein sichtbares Element (inkl. Shadow-DOM,
  KoliBri-Trigger) ragt über den Viewport hinaus (Bounding-Box-Prüfung
  `rect.right <= window.innerWidth`, da die App-Shell `overflow-x: hidden` clippt und
  `scrollWidth` strukturell unauffällig bleibt).

## Abgrenzungen / bewusst nicht getestet

- Leerzustand (0 Releases), Ladezustand (`KolSpin`), Akkordeon/Pagination: laut KI-UX
  gestalten, aber kein Akzeptanzkriterium → kein roter Test.
- Links zu github.com pro Release: vom Issue-Autor nicht gewollt, nachrüstbar.
- `per_page=30`-„rund 30“-Semantik: fix im Code verankert (AK2-URL-Assert deckt ab).

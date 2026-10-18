# ADR 0025 — Geteilte Fachlogik zwischen Server und Frontend: bewusstes Duplikat mit Spiegel-Tests

- **Status:** Accepted (2026-10-18)
- **Datum:** 2026-10-18
- **Kontext:** Entscheidungsteil des Code-Review-Protokolls #2675 (Finding F-8), Epik #2684

## Kontext

Die Anteils- und Rundungslogik der Säulen existiert doppelt: `server/src/logics/pillarShares.ts`
und `frontend/src/lib/pillar.ts` tragen denselben Algorithmus (Soll-Summe 100, Mindestanteil 5,
Largest-Remainder-Rundung, Verteilung mit Mindestanteil, Rang-Treppe 50/20/15/10/5) und sind
bisher nur per Kommentar aneinander gebunden („Wer hier etwas ändert, ändert es auch im
Frontend"). Für geteilte Fachlogik gibt es im Monorepo kein Zuhause: `pnpm-workspace.yaml` kennt
die fünf Pakete client, frontend, native, server und website, und keines ist für Code ausgelegt,
den beide Seiten importieren. Das `client`-Paket enthält ausschließlich die aus `openapi.yml`
generierten Typen und wird nur vom Frontend konsumiert.

Zwei Eigenschaften der heutigen Grenzen tragen die Entscheidung:

- **Der Server läuft kompiliert.** `tsc` baut nach `dist`, PM2 startet `node dist/index.js`.
  Ein Paket, das — wie `client` — TypeScript-Quellen direkt exportiert, funktioniert deshalb nur
  dort, wo ein Bundler sie auflöst (Vite im Frontend), nicht im Server-Betrieb.
- **`client` ist Generator-Besitz.** Quelle ist `openapi.yml`, Ausgabe `schema.d.ts`; jede
  handgeschriebene Datei dort stünde außerhalb des Generierungsvertrags.

Geprüfte Kandidaten waren: ein neues Workspace-Paket, das beide Seiten importieren; das bewusste
Duplikat mit Spiegel-Tests, die beide Fassungen aneinanderpinnen; die Erweiterung des
`client`-Pakets mit Server-Anbindung.

## Entscheidung

**1. Geteilte Fachlogik bleibt Duplikat — bewusst und gepinnt.** Server- und Frontend-Fassung
wohnen weiterhin in `server/src/logics/pillarShares.ts` und `frontend/src/lib/pillar.ts`. Die
Kommentar-Bindung bleibt bestehen. An beiden Dateien entstehen Spiegel-Tests: dieselben
Eingaben (Gleichverteilung, Kippen unter den Mindestanteil, Rang-Treppe, Rundungsreste) laufen in
beiden Test-Suiten und müssen identische Ausgaben liefern. Driftet eine Seite, wird das im Test
sichtbar, statt sich still im Verhalten zu sammeln.

**2. Die Server-Fassung ist der Referenz-Vertrag.** Regeländerungen werden zuerst in
`pillarShares.ts` gefasst und in die Frontend-Fassung übertragen; die Spiegel-Tests sind der
Nachweis der Übertragung. Damit gibt es eine eindeutige Leserichtung, wenn die Fassungen auseinanderzufallen drohen.

**3. Der Geltungsbereich sind reine, zustandslose Berechnungen.** Diese Entscheidung gilt für
Fachlogik ohne I/O und ohne Framework-Bezug (Berechnungen, Konstanten, Verträge). Was DOM, HTTP,
Datenbank oder Konfiguration berührt, ist kein Kandidat für das Duplikat-Muster und bleibt dort,
wo sein Kontext lebt.

## Verworfene Alternativen

- **Neues Workspace-Paket für geteilte Fachlogik:** damit der Server (kompiliert, `node dist`)
  es laden kann, müsste es JavaScript ausliefern — eigener Build-Schritt, Build-Reihenfolge in
  `pnpm -r build`, Paket-Config für tsconfig/knip/lint. Genau dieses Build/Publish-Setup wird
  hier bewusst vermieden; der heutige Nutzen (eine Logik-Familie) rechtfertigt keine dauerhafte
  sechste Paket-Infrastruktur.
- **Erweiterung des `client`-Pakets:** `client` ist Generator-Besitz (Quelle `openapi.yml`);
  handgeschriebene Fachlogik bräche den Generierungsvertrag, und der Server müsste ein Paket
  importieren, das für API-Typen und das Frontend gebaut ist — mit demselben
  Kompilierungsproblem wie beim neuen Paket.

## Konsequenzen

- Keine Änderung an Workspace-, Build- oder Deployment-Grenzen; die fünf Pakete und ihre Rollen
  gelten unverändert.
- Das Nachfolge-Issue „Säulen: Anteils- und Rundungslogik zusammenführen" setzt diese
  Entscheidung um: es führt die Logik nicht in einem Modul zusammen, sondern pinnt beide
  Fassungen mit Spiegel-Tests aneinander und richtet die Kommentar-Bindung darauf aus.
- Die Redundanz ist eingepreist: jede Regeländerung berührt zwei Dateien und zwei Test-Suiten;
  dafür entfällt jegliche Paket-Mechanik.
- Wächst der Umfang geteilter Fachlogik deutlich (mehrere Logik-Familien, häufige Änderungen),
  kann ein neues ADR diese Entscheidung zugunsten eines geteilten Pakets mit Build-Schritt
  aufweichen.

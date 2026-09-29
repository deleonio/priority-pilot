# Spec #1672 — Datenschutzerklärung auf der Website veröffentlichen

**Issue:** #1672 · **Stand:** 2026-09-25 (Spec-Phase) · **Vertragstyp:** Seiten-Vertrag (Website-Prerender)

## Ziel

Die öffentliche Website bekommt eine vorgerenderte Datenschutzerklärung unter der festen URL `/datenschutz/` (nur Deutsch, PO-Entscheidung 2026-09-25), damit der Play-Store-Eintrag genau eine URL nennen kann. Der Footer aller zehn Sprachversionen verlinkt darauf; nur der Link-Text ist lokalisiert.

## Feste Annahmen (von der Analyse/PO festgezurrt)

1. Eine feste URL `/datenschutz/` an der Wurzel — bewusste Abweichung vom Muster der lokalisierten Slugs (`/en/imprint/` …), weil der Text nur deutsch existiert und der Play-Store-Eintrag genau eine URL braucht.
2. Der deutsche Rechtstext liegt als Konstante/Modul neben `render.ts`, NICHT in den i18n-Dateien (der Key-Parity-Test würde ihn sonst in alle zehn Dateien duplizieren).
3. Neuer i18n-Key `footer.privacy` in allen zehn Sprachdateien (nur Link-Text); das Link-Ziel ist in allen Sprachen identisch `/datenschutz/`.
4. Struktur wie Impressum/Konto löschen: `section > container--narrow imprint`, kein neues CSS nötig.
5. Inhalt (PO): Datensparsamkeit (nur das Nötigste für das Funktionsangebot), keinerlei Auswertung der Daten, keine Weitergabe an Dritte, Ende-zu-Ende-Verschlüsselung für Nutzer, wo technisch möglich; als Empfänger genannt: PayPal, Google-Login, Firebase Cloud Messaging, Google Play.

## Verhalten je Akzeptanzkriterium

### AK1 — `/datenschutz/` liefert die vorgerenderte Seite

**Voraussetzung:** gebaute Website (`pnpm --filter website build`); `renderPrivacy` nach dem Muster `renderAccountDeletion`.
**Schritte:** Seite rendern bzw. `/datenschutz/` öffnen.
**Erwartetes Ergebnis:** H1 „Datenschutz“ + Absätze (Struktur wie Impressum); der Text nennt PayPal, Google-Login, Firebase Cloud Messaging, Google Play sowie die vier Grundsätze (Datensparsamkeit, keine Auswertung, keine Weitergabe an Dritte, Ende-zu-Ende-Verschlüsselung, wo technisch möglich).

### AK2 — Footer-Link in allen zehn Sprachen

**Voraussetzung:** i18n-Key `footer.privacy` je Sprache vorhanden.
**Schritte:** Landing-Page je Locale rendern.
**Erwartetes Ergebnis:** Footer enthält `href="/datenschutz/"` mit lokalisiertem Link-Text; das Ziel ist in allen zehn Sprachen identisch.

### AK3 — Sitemap-Eintrag, Bestandstests bleiben grün

**Voraussetzung:** Build mit gesetzter `SITE_URL`.
**Schritte:** Sitemap und `dist/` prüfen; Website-Tests laufen lassen.
**Erwartetes Ergebnis:** `<loc>{SITE_URL}/datenschutz/</loc>` steht in der Sitemap; `dist/datenschutz/index.html` existiert; Key-Parity-, hreflang- und Impressum/Konto-löschen-Footer-Link-Bestandstests bleiben unverändert grün.

## Tests (rote Spec-Tests)

- TF1 (Vitest, `website/src/render.test.ts`, Erweiterung): `renderPrivacy`-Inhalt (AK1), Footer-Link je Locale (AK2), Build schreibt die Seite und die Sitemap-URL (AK3).
- TF2 (Playwright, `website/e2e/landing.spec.ts`, Erweiterung): Footer-Navigation auf `/datenschutz/` mit sichtbarem H1 — läuft im Mobile-Projekt 375×812 und Desktop; `/datenschutz/` zusätzlich in die Pfadliste „kein horizontales Scrollen“ aufgenommen.

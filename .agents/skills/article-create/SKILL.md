---
name: article-create
description: Erstellt veröffentlichungsreife Fachartikel rund um Balamentum für Internet-Plattformen (Medium, web.dev, dev.to, eigene Website) mit eigenen Bildern — mit vorgelagertem Dialog zum Nutzer, um das passende Fokus-Thema zu ermitteln. Verwenden, wann immer der Nutzer einen Artikel, Blog-Post, Internet-Beitrag oder Fachtext über Balamentum schreiben/erstellen will, auch wenn er nur „schreib einen Artikel“ sagt. Immer zusammen mit dem Skill „vermenschlichen“.
---

# Fachartikel über Balamentum schreiben (Fokus-Thema)

Ziel: ein veröffentlichungsreifer **Fachartikel** (je Plattform einer) zu **einem** Fokus-Thema,
mit eigenen Bildern, abgelegt unter `docs/marketing/artikel/<jjjj-mm-tt>-<slug>/`.

**Genre-Regel:** Der Artikel gehört dem Fachthema; Balamentum tritt als Praxisbeispiel auf.
Kein Quellcode-Artikel: keine Dateinamen, keine Repo-Pfade, keine Komponenten- oder
Architektur-Exegese im Text. Technische Fachartikel (web.dev) erklären allgemeine
Web-Plattform-Techniken und nennen Balamentum als Fallbeispiel; die Snippets sind allgemeine
Muster, keine Repo-Auszüge. Fakten (Zahlen, Verfahren, Namen) dürfen aus dem Repo kommen — ihre
Herkunft nicht.

Mehrere Plattformen bedeuten mehrere eigenständige Artikel zu demselben Thema — kein
1:1-Übersetzen.

## Schritt 1 — Dialog: Thema und Rahmen ermitteln (immer zuerst, vor jeder Recherche)

Mit `AskUserQuestion` klären — eine Frage je Block:

1. **Fokus-Thema** (Einwahl aus der Kandidaten-Tabelle unten; „Other“ deckt eigene Wünsche ab)
2. **Plattform(en)** (Medium, web.dev, dev.to, eigene Website; multiSelect)
3. **Sprache je Plattform** (Standard-Muster: Medium deutsch, web.dev englisch; Alternativen:
   alles deutsch / alles englisch)
4. **CTA** (nur App-Link auf balamentum.modevel.de, Warteliste, bestimmtes Feature, kein CTA)

Nachfragen nur, wenn das gewählte Thema mehrdeutig ist (z. B. „Balance“: Lebensmethode für
Leser oder Design-Prinzip für Fachleser?). Danach ohne weitere Rückfragen durcharbeiten.

### Fachthemen-Kandidaten (mit Material-Quellen im Repo)

| Fachthema                                                                       | Perspektive                   | Material (zur Laufzeit frisch lesen)                                              |
| ------------------------------------------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------- |
| Lebensbalance sichtbar machen (Säulen, Ist/Soll)                                | Methode fürs Selbstmanagement | `docs/zifferblatt-konzept.md`, `docs/fuersorge-tonalitaet.md`                     |
| Fürsorge-Kommunikation: sorgen statt protokollieren                             | Kommunikation/Psychologie     | `docs/fuersorge-tonalitaet.md`                                                    |
| Priorisierung ohne Überlast (Erlaubnis zum Kürzen)                              | Selbstmanagement              | `docs/fuersorge-tonalitaet.md`, `docs/user-guide.md`                              |
| Rückmeldungen ohne Druck (statt Streak-Schuld)                                  | Produkt-Design/Verhalten      | `docs/fuersorge-tonalitaet.md`, `docs/zifferblatt-konzept.md`                     |
| Animierte Daten-Widgets barrierefrei (reduced motion, Uniform statt Shader-Uhr) | Web-Technik (web.dev)         | `docs/zifferblatt-konzept.md`                                                     |
| Farb-Rampen messen statt raten (CIEDE2000, Sehformen)                           | Web-Technik/Farbe             | `.ai-knowledge/ux-design.md`                                                      |
| `light-dark()` und `color-scheme` über Shadow-DOM-Grenzen                       | Web-Technik                   | `.ai-knowledge/ux-design.md`                                                      |
| Mobile-First-Verifikation (375 px, Touch-Targets, e2e)                          | Web-Technik/QA                | `.ai-knowledge/project.md`, `docs/mobile-ui-rules.md`                             |
| Vom Web zur Store-App (Capacitor, Remote-Modus)                                 | Web-Technik                   | `docs/native-apps.md`, `docs/adr/0016-*`                                          |
| KI-gesteuerte Entwicklung im Team von heute                                     | Arbeitsweisen                 | `docs/pipeline-flow.md`, `docs/ci-architecture.md`, `docs/kosten-baseline-912.md` |

Referenz-Paar als Muster (Struktur, Umfang, Genre-Treue, Bilder, Kopf-Kommentar):
`docs/marketing/artikel/2026-10-01-zifferblatt/` — `medium.md` (deutsch, Methode),
`webdev.md` (englisch, Web-Technik mit Fallbeispiel), `images/` inkl. Generator `gen-bilder.mjs`.

## Schritt 2 — Recherche

Lies die Material-Quellen des gewählten Themas zur Laufzeit (Agnostik-Prinzip: nichts aus
diesem Skill einfrieren). Nur Fakten übernehmen, die dort stehen. Keine Kennzahlen, Messwerte,
Zitate oder Studien erfinden; ein Beleg nur, wenn er das wirklich sagt, was er stützen soll.
Demo-Daten in Bildern ausdrücklich als „Illustration“ kennzeichnen.

## Schritt 3 — Schreiben

**Immer zuerst den Skill `vermenschlichen` laden und anwenden — für jede Sprache und jeden
Artikel.** Für englische Texte die Muster übertragen (keine KI-Verräter, keine Werbesprache,
echte Substanz statt Bedeutungsaufladung).

**Medium:** Fachartikel für praktisch interessierte Leser. Titel + Untertitel, 1200–1800
Wörter, 3–7 benennende Zwischenüberschriften, Fließtext vor Listen, kein „Fazit“-Baustein;
wenn möglich ein Anwendungsteil, der auch ohne das Produkt funktioniert.

**web.dev:** Fachartikel für Web-Profis. Sentence-case-Überschriften, TL;DR am Anfang,
Abschnitte mit kurzen allgemeinen Code-Skizzen, „Key takeaways“ am Ende, 1200–1600 Wörter.
Allgemeine Technik lehren, Balamentum als Fallbeispiel nennen, keine Werbesprache.

Beide Artikel erzählen dasselbe Fachthema für verschiedene Leser und verweisen am Ende
aufeinander (Platzhalter als HTML-Kommentar im Kopf, falls die URL noch nicht feststeht).

## Schritt 4 — Bilder

3–5 Bilder je Artikel als SVG, erzeugt per Generator-Skript (`node <name>.mjs`) statt
Hand-SVG — Tick-Ringe und Farbverläufe brauchen Rechnerei. Vorgehen:

1. `images/gen-bilder.mjs` des Referenzartikels kopieren und aufs neue Thema anpassen.
2. Farben aus der App übernehmen: Dark-Theme-Tokens in `frontend/src/app.css`
   (`--pp-pillar-neon-*`, `--pp-balance-ring-*`, `--pp-surface-*`, `--pp-ink*`).
3. Keine Dateinamen oder Repo-Pfade in den Bildern — das gilt fürs Genre, nicht nur für Text.
4. Generieren, Skript im `images/`-Ordner mit ablegen.
5. Verifizieren: jedes Schlüsselbild als PNG rendern und auf Textüberlauf prüfen, z. B.
   `pnpm --filter frontend exec playwright screenshot file://<pfad>.svg /tmp/check.png`.

## Schritt 5 — Ablage und Selbstcheck

Ablage: `docs/marketing/artikel/<jjjj-mm-tt>-<slug>/` mit `<plattform>.md` (z. B. `medium.md`,
`webdev.md`) und `images/`. Am Anfang jeder Datei ein HTML-Kommentar mit Titel, Untertitel,
Tags, Genre-Hinweis, Bild-Hinweisen und Veröffentlichungsnotiz. **Nicht automatisch
committen** (Kernregel).

Selbstcheck vor der Übergabe:

- **Genre:** Kommt kein Dateiname, Repo-Pfad oder Komponentenname im Text oder in den Bildern
  vor? Ist Balamentum Praxisbeispiel geblieben, nicht Thema?
- **Fakten:** Keine erfundenen Quellen oder Zahlen; Demo-Daten als Illustration markiert.
- **Stil:** `vermenschlichen` angewendet (jede Sprache); keine KI-Verräter, kein Werbeton.
- **Handwerk:** Bilder mit relativen Pfaden eingebettet und gerendert geprüft; Meta-Reste und
  Platzhaltertext entfernt; Produktnamen und URLs korrekt.

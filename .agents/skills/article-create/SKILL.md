---
name: article-create
description: Erstellt veröffentlichungsreife Fachartikel (1200–1800 Wörter, echte Screenshots) rund um Balamentum für Internet-Plattformen (Medium, web.dev, dev.to, eigene Website) — mit vorgelagertem Dialog zum Nutzer, um das passende Fokus-Thema zu ermitteln, und 3× Teufelsadvokaten-Jury mit Optimierungsrunden und Abschluss-Metrik. Verwenden, wann immer der Nutzer einen Artikel, Blog-Post, Internet-Beitrag oder Fachtext über Balamentum schreiben/erstellen will, auch wenn er nur „schreib einen Artikel“ sagt. Immer zusammen mit dem Skill „vermenschlichen“.
---

# Fachartikel über Balamentum schreiben (Fokus-Thema)

Ziel: je Plattform ein veröffentlichungsreifer **Fachartikel** zu **einem** Fokus-Thema —
ausführlich genug, um das Thema eigenständig zu tragen (1200–1800 Wörter), untermauert mit
informativen Screenshots aus der echten App, abgelegt unter
`docs/marketing/artikel/<jjjj-mm-tt>-<slug>/`. Danach drei Validierungsrunden durch eine Jury aus
drei Teufelsadvokaten mit Optimierung nach jeder Runde und einer Abschluss-Metrik.

**Genre-Regel:** Der Artikel gehört dem Fachthema; Balamentum tritt als Praxisbeispiel auf.
Kein Quellcode-Artikel: keine Dateinamen, keine Repo-Pfade, keine Komponenten- oder
Architektur-Exegese im Text. Technische Fachartikel (web.dev) erklären allgemeine
Web-Plattform-Techniken und nennen Balamentum als Fallbeispiel; die Snippets sind allgemeine
Muster, keine Repo-Auszüge. Fakten (Zahlen, Verfahren, Namen) dürfen aus dem Repo kommen — ihre
Herkunft nicht. **Jede Zahl im Artikel muss gegen die Quelle stehen** (Code oder Doku); Zahlen,
die nur im eigenen Bildgenerator existieren, sind Zirkelbelege.

**Eigenständigkeits-Regel (bindend):** Die Plattform-Artikel zu einem Thema verlinken sich **nicht
gegensenseitig** und erwähnen sich nicht („der Schwesterartikel …“ entfällt). Jede Fassung ist ein
vollwertiger, eigenständiger Artikel: eigener Einstieg, eigene Struktur, eigene Beispiele, eigener
Schluss — dieselbe Auskunft für ein anderes Publikum, nicht ein Auszug mit Verweis. Am Ende steht
nur der CTA (App-Link), kein Cross-Sell.

Mehrere Plattformen bedeuten mehrere eigenständige Artikel zu demselben Thema — kein
1:1-Übersetzen, kein wörtliches Recycling von Sätzen zwischen den Fassungen.

## Schritt 1 — Dialog: Thema und Rahmen ermitteln (immer zuerst, vor jeder Recherche)

Mit `AskUserQuestion` klären — eine Frage je Block:

1. **Fokus-Thema** (Einwahl aus der Kandidaten-Tabelle unten; „Other“ deckt eigene Wünsche ab)
2. **Plattform(en)** (Medium, web.dev, dev.to, eigene Website; multiSelect)
3. **Sprache je Plattform** (Standard-Muster: Medium deutsch, web.dev englisch; Alternativen:
   alles deutsch / alles englisch)
4. **CTA** (nur App-Link auf balamentum.modevel.de, Warteliste, bestimmtes Feature, kein CTA)

Bei einem **Neustart für bestehende Artikel** (Überarbeitung eines Sets) entfällt der Dialog:
Thema, Plattformen, Sprache und CTA stehen in den bestehenden Kopf-Kommentaren; ließ sie und
arbeite direkt die Schritt 2–6 durch.

Nachfragen nur, wenn das gewählte Thema mehrdeutig ist (z. B. „Balance“: Lebensmethode für
Leser oder Design-Prinzip für Fachleser?). Danach ohne weitere Rückfragen durcharbeiten.

### Fachthemen-Kandidaten (mit Material-Quellen im Repo)

| Fachthema                                                                       | Perspektive                   | Material (zur Laufzeit frisch lesen)                                                |
| ------------------------------------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------- |
| Lebensbalance sichtbar machen (Säulen, Ist/Soll)                                | Methode fürs Selbstmanagement | `docs/zifferblatt-konzept.md`, `docs/fuersorge-tonalitaet.md`                       |
| Fürsorge-Kommunikation: sorgen statt protokollieren                             | Kommunikation/Psychologie     | `docs/fuersorge-tonalitaet.md`                                                      |
| Priorisierung ohne Überlast (Erlaubnis zum Kürzen)                              | Selbstmanagement              | `docs/fuersorge-tonalitaet.md`, `docs/user-guide.md`                                |
| Rückmeldungen ohne Druck (Streak-Regeln, Zähler die nur addieren)               | Produkt-Design/Verhalten      | `docs/fuersorge-tonalitaet.md`, `docs/user-guide.md`, `server/src/logics/streak.ts` |
| Animierte Daten-Widgets barrierefrei (reduced motion, Uniform statt Shader-Uhr) | Web-Technik (web.dev)         | `docs/zifferblatt-konzept.md`                                                       |
| Farb-Rampen messen statt raten (CIEDE2000, Sehformen)                           | Web-Technik/Farbe             | `.ai-knowledge/ux-design.md`                                                        |
| `light-dark()` und `color-scheme` über Shadow-DOM-Grenzen                       | Web-Technik                   | `.ai-knowledge/ux-design.md`                                                        |
| Mobile-First-Verifikation (375 px, Touch-Targets, e2e)                          | Web-Technik/QA                | `.ai-knowledge/project.md`, `docs/mobile-ui-rules.md`                               |
| Vom Web zur Store-App (Capacitor, Remote-Modus)                                 | Web-Technik                   | `docs/native-apps.md`, `docs/adr/0016-*`                                            |
| KI-gesteuerte Entwicklung im Team von heute                                     | Arbeitsweisen                 | `docs/pipeline-flow.md`, `docs/ci-architecture.md`, `docs/kosten-baseline-912.md`   |

Referenz-Set als Muster (Struktur, Umfang, Genre-Treue, Screenshots, Jury-Metrik):
`docs/marketing/artikel/2026-10-01-zifferblatt/` und `2026-10-02-rueckmeldung-ohne-druck/` mit
`JURY-METRIK.md` daneben.

## Schritt 2 — Recherche

Lies die Material-Quellen des gewählten Themas zur Laufzeit (Agnostik-Prinzip: nichts aus
diesem Skill einfrieren). Nur Fakten übernehmen, die dort stehen. Keine Kennzahlen, Messwerte,
Zitate oder Studien erfinden; ein Beleg nur, wenn er das wirklich sagt, was er stützen soll.
Verhaltens-/Wirkungsbehauptungen über Nutzer ohne Daten bleiben bei der Design-Intention —
ehrliche Grenzen („was ich belegen kann und was nicht“) schlagen erfundene Retention.
Demo-Daten in Bildern ausdrücklich als „Illustration“/„Demo-Stand“ kennzeichnen.

## Schritt 3 — Schreiben (1200–1800 Wörter, eigenständig)

**Immer zuerst den Skill `vermenschlichen` laden und anwenden — für jede Sprache und jeden
Artikel.** Für englische Texte die Muster übertragen (keine KI-Verräter, keine Werbesprache,
echte Substanz statt Bedeutungsaufladung).

**Umfang: 1200–1800 Wörter** (Medium bzw. web.dev; dev.to 1000–1400), 4–7 Zwischenüberschriften,
die **benennen** statt anpreisen. Deutsch in Fließtexten mit „du“-Nähe, englisch nach
Plattform-Ton. Der Umfang trägt Substanz (Verfahren, Beispiele, Grenzen) — keine Dekoration.

**Medium:** Fachartikel für praktisch interessierte Leser. Titel mit Leser-Versprechen +
Untertitel; der Produkt-Pivot kommt nicht vor Absatz 3, und der Hook trägt bis dahin. Vertiefte
Abschnitte (Rechenbeispiele, Fallen, Material-Unterschiede) statt Listen-Katalog; ein
Anwendungs- oder Mitnahme-Teil („Für das eigene Dashboard“) als nummerierte Liste.

**web.dev:** Fachartikel für Web-Profis. Sentence-case-Überschriften, TL;DR am Anfang, dessen
Zählung zur Struktur passt („Four practices“ ↔ vier Sektionen), kurze allgemeine Code-Skizzen
als „sketch“ markiert, „Key takeaways“/Checkliste am Ende. Allgemeine Technik lehren,
Balamentum als Fallbeispiel, keine Werbesprache.

**dev.to:** Feldbericht in der ersten Person. Konkrete Fallen („the trap I nearly stepped in“)
mit Konkretbeispiel, ehrliche Claim-Grenzen, Engagement-Frage am Ende (Kommentare sind der
Reichweiten-Hebel).

**Eigenständigkeit:** Jede Fassung trägt ihr Thema komplett — wer nur eine Plattform liest,
verpasst nichts für das Verständnis. Keine Verweise auf Schwesterartikel, keine geteilten
Sätze.

## Schritt 4 — Bilder: echte Screenshots zuerst

**Primär: informative Screenshots aus der laufenden App** (3–5 je Artikel), zweitrangig SVG-
Diagramme für Konzepte, die kein Screenshot zeigt (0–2 je Artikel).

Screenshots aus der echten App:

1. Vorbild: `frontend/e2e/zifferblatt-shots.spec.ts` (Bildmacher mit echtem Login) — kopieren
   und aufs Thema anpassen, als Temp-Spec unter `frontend/e2e/` (nach dem Lauf löschen oder
   SHOTS-gebannt committen). Ablage nach `frontend/e2e/__shots__/…`, Auswahl danach in den
   `images/`-Ordner des Artikels kopieren.
2. **Falle:** Der Test-Login (`POST /auth/test-login`) legt Konten **ohne Säulen** an — die fünf
   festen Säulen (#1521) sät nur die **Registrierung** (`POST /auth/register` + `/auth/login`).
   Ohne Säulen kein Herz, kein Streak, kein Fürsorge-Hinweis.
3. Die App lebt unter **`/app/`** (ADR 0015): Einstellungen heißen `/app/settings/general`
   (Allgemein-Tab mit der Dial-Wahl). Route-Namen stehen in `App.tsx`
   (`BASE_SETTINGS_PATH_SEGMENTS`).
4. `server/.env` vor e2e-Läufen nach `/tmp` verschieben (lokale Features brechen die Mocks),
   danach zurück. Browser-Cache: Playwright-Download kann blockiert sein — dann erst alte
   `chromium-*`-Symlinks in `~/Library/Caches/ms-playwright` löschen.
5. Ein Telegramm-Shot (z. B. „Tag geschafft“, 80 px hoch) wirkt freistehend wie Nichts — als
   Bild nur verwenden, wenn die Pointe es trägt; sonst im Text beschreiben.
6. **Demo-Stände ehrlich captioniern**: Screenshots aus unterschiedlichen Läufen zeigen
   unterschiedliche Werte; die Caption sagt das, statt „dasselbe Bild“ zu behaupten.
7. Medium akzeptiert **keine SVG-Uploads** — SVG-Grafiken vor dem Publish als PNG rastern
   (`pnpm --filter frontend exec playwright screenshot file://… --viewport-size "…"`).

SVG-Diagramme (0–2 je Artikel): Generator-Muster `images/gen-bilder.mjs` der Referenzartikel
kopieren, Farben aus `frontend/src/app.css` (Dark-Tokens). Kein Text im Diagramm, den die
Markdown-Unterschrift wiederholt — und der Artikeltext sagt nie etwas anderes als das Diagramm.

## Schritt 5 — Jury: 3 Teufelsadvokaten, 3 Runden, Optimierung nach jeder

Nach dem ersten Entwurf laufen **drei Validierungsrunden** mit jeweils **drei
Teufelsadvokaten-Agents** (parallel, z. B. Explore, read-only):

| Rolle                  | Jagt auf                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------- |
| **Fach-Skeptiker**     | Substanz, unbelegte Behauptungen, Zahlen ohne Quelle — prüft Behauptungen gegen den Code    |
| **Marketing-Zyniker**  | Hook, Zielgruppen-Passung, Plattform-Fit, CTA, Teilbarkeit, Abbruchpunkte                   |
| **Gestaltungs-Purist** | Struktur, Bildführung (deckt die Caption das Bild?), Länge, KI-Schreibmuster, Überschriften |

- **Runde 1:** Jeder greift jeden Artikel an (3 Widerlegungen pro Artikel, mit Zitat). Dann
  Optimierung.
- **Runde 2:** Jeder Juror erhält die Runde-1-Kernpunkte der **anderen zwei** und muss sie
  **widerlegen**, wo sie falsch liegen oder dem Ziel schaden (verhindert Überkorrektur); danach
  Revisions-Check der berechtigten Punkte + neue Angriffe. Optimierung.
- **Runde 3:** Restprüfung + **verbindliche Scores** für die Abschluss-Metrik. Letzte
  Ein-Satz-Fixes.

Jeder Juror bewertet je Artikel vier Dimensionen (1–5): **Stoff & Interesse · Marketing-Wirkung ·
Gestaltung & Bilder · Sprachstil**. Juror-Prompts enthalten die Plattform-Zuordnung (Medium de /
web.dev en / dev.to en) und die Genre-Regeln; sie prüfen insbesondere auch die
**Eigenständigkeit** (keine Cross-Verweise, kein Recycling wörtlicher Sätze zwischen den
Fassungen).

## Schritt 6 — Metrik, Ablage, Selbstcheck

**Metrik:** `docs/marketing/artikel/JURY-METRIK.md` (fortlaufend, alle Artikel-Sets und
Überarbeitungen): Verfahren, Runde-3-Scores je Juror und Dimension, Mittel, Rangfolge,
Erkenntnisse über die Runden, Veröffentlichungshinweise (z. B. SVG→PNG für Medium). Muster liegt
vor — Überarbeitungen hängen als neue Sektion an.

**Ablage:** `docs/marketing/artikel/<jjjj-mm-tt>-<slug>/` mit `<plattform>.md` (z. B.
`medium.md`, `webdev.md`, `devto.md`) und `images/`. Am Anfang jeder Datei ein HTML-Kommentar
mit Titel, Untertitel, Tags, Genre-Hinweis, Bild-Hinweisen und Veröffentlichungsnotiz. **Nicht
automatisch committen** (Kernregel) — außer der Nutzer wünscht es ausdrücklich.

**Selbstcheck vor der Übergabe:**

- **Genre:** Kein Dateiname, Repo-Pfad oder Komponentenname im Text oder in den Bildern?
  Balamentum Praxisbeispiel geblieben?
- **Eigenständigkeit:** Kein Cross-Verweis, kein „Schwesterartikel“, keine wörtlich geteilten
  Sätze zwischen den Fassungen?
- **Fakten:** Jede Zahl gegen Code/Doku geprüft; keine erfundenen Quellen; Demo-Daten
  markiert; Wirkungsbehauptungen ohne Daten als Design-Intention formuliert.
- **Stil:** `vermenschlichen` angewendet (jede Sprache); keine KI-Verräter; Überschriften
  benennen statt anpreisen.
- **Bildführung:** Zeigt jedes Bild, was Alt-Text und Caption versprechen? Keine doppelte
  Unterschrift auf Diagramm-Fußzeilen? Englische Artikel glossieren deutschsprachige Screenshots?
- **Handwerk:** Bilder mit relativen Pfaden eingebettet und gerendert geprüft; keine
  ungenutzten Dateien im `images/`-Ordner; Meta-Reste entfernt; Produktnamen und URLs korrekt.

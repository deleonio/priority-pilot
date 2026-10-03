# Jury-Metrik — Balamentum-Fachartikel (Stand 03.10.2026)

Drei Teufelsadvokaten haben alle fünf Artikel in **drei Runden** validiert. Nach jeder Runde
wurden die Artikel auf Basis der Gutachten optimiert; die Scores unten sind die **verbindliche
Runde-3-Wertung** (Ist-Zustand nach der dritten Optimierung).

## Das Verfahren

| Runde | Was passiert                                                                                                                                                         |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Drei Teufelsadvokaten greifen unabhängig voneinander an (je 3 Widerlegungen pro Artikel, mit Zitat). Optimierung.                                                    |
| 2     | Jeder Juror erhält die Runde-1-Kernpunkte der **beiden anderen** und muss sie widerlegen, wo sie falsch liegen; danach Revision prüfen + neue Angriffe. Optimierung. |
| 3     | Restprüfung + verbindliche Rubric-Scores für die Abschluss-Metrik. Letzte Ein-Satz-Fixes.                                                                            |

**Die drei Rollen:** Der Fach-Skeptiker (Substanz, Belege, Wahrheit — prüft Behauptungen gegen
den Code). Der Marketing-Zyniker (Hook, Zielgruppe, Plattform-Fit, CTA, Teilbarkeit). Der
Gestaltungs-Purist (Struktur, Stil, Bildführung, Länge, KI-Schreibmuster).

**Die vier Dimensionen (je 1–5):** Stoff & Interesse · Marketing-Wirkung · Gestaltung & Bilder ·
Sprachstil. Maximal 20 Punkte pro Juror und Artikel.

## Runde-3-Scores

| Artikel               | Skeptiker | Zyniker | Purist | Ø (von 20) |
| --------------------- | --------- | ------- | ------ | ---------- |
| Zifferblatt · Medium  | 17        | 16,0    | 16,5   | **16,5**   |
| Zifferblatt · web.dev | 16        | 17,0    | 17,0   | **16,7**   |
| Rückmeldung · Medium  | 17        | 17,0    | 16,0   | **16,7**   |
| Rückmeldung · web.dev | 14        | 15,5    | 15,5   | **15,0**   |
| Rückmeldung · dev.to  | 18        | 17,5    | 17,0   | **17,5**   |

### Im Detail (Stoff · Marketing · Gestaltung · Stil)

| Artikel               | Fach-Skeptiker | Marketing-Zyniker   | Gestaltungs-Purist  | Mittel je Dimension      |
| --------------------- | -------------- | ------------------- | ------------------- | ------------------------ |
| Zifferblatt · Medium  | 4 · 4 · 4 · 5  | 4 · 4 · 3,5 · 4,5   | 4,5 · 4 · 3,5 · 4,5 | 4,17 · 4,0 · 3,67 · 4,67 |
| Zifferblatt · web.dev | 4 · 4 · 4 · 4  | 4,5 · 4 · 4,5 · 4   | 4,5 · 4 · 4 · 4,5   | 4,33 · 4,0 · 4,17 · 4,17 |
| Rückmeldung · Medium  | 4 · 4 · 4 · 5  | 4 · 4,5 · 4 · 4,5   | 4 · 4 · 3,5 · 4,5   | 4,0 · 4,17 · 3,83 · 4,67 |
| Rückmeldung · web.dev | 3 · 4 · 4 · 3  | 4 · 4 · 4 · 3,5     | 4 · 4 · 4 · 3,5     | 3,67 · 4,0 · 4,0 · 3,33  |
| Rückmeldung · dev.to  | 5 · 4 · 4 · 5  | 4,5 · 4,5 · 4 · 4,5 | 4,5 · 4 · 4 · 4,5   | 4,67 · 4,17 · 4,0 · 4,67 |

## Erkenntnisse über die drei Runden

- **Runde 1 fischte nach Zahlen:** Der Skeptiker fand durch Code-Vergleich echte Sachfehler
  („Neun" zählte acht Varianten, Motion-Dauer 150–250 ms vs. echte 120/200 ms, Streak-Regel 3
  „einen Tag später" statt „beliebige Verspätung", ΔE-Worst-Pairs nur im eigenen
  Bildgenerator fixiert). Nach Zahlen in Artikeln muss der Code stehen.
- **Runde 2 fischte nach Bildführung:** Captions, die das Bild nicht decken, doppelte
  Bildunterschriften auf SVG-Folien, „real screenshots" gegen ein Diagramm versprochen. Die
  gegenseitige Widerlegung verhinderte Überkorrektur (z. B. wurde die TelefonSeelsorge-Zeile
  zu Recht behalten — wer sie entfernt, macht die Artikel unwahr).
- **Runde 3 fand nur noch Redaktionsreste:** ein Doppelsatz, ein Zählfehler im TL;DR, eine
  Caption-Schärfe. Und den stärksten Einzelfund des Sets: die Zeitzonen-Falle (23:30 Berlin ≠
  UTC-Datum) als echtes Feldbericht-Material.
- **Rangfolge im Finale:** dev.to-Feldbericht (17,5) vor Zifferblatt/web.dev und
  Rückmeldung/Medium (je 16,7) vor Zifferblatt/Medium (16,5) vor Rückmeldung/web.dev (15,0).
  Der Rückmeldung/web.dev-Score wurde **vor** dem letzten Doppel-Satz-Fix vergeben; danach
  schätzt der Purist ihn bei ~4,2.

## Veröffentlichungshinweise

- Medium akzeptiert keine SVG-Uploads: die Galerie liegt als PNG bereit
  (`zifferblatt-galerie.png`), die SVG-Fassungen (`farbrampe-en.svg`, `states-en.svg`) müssen
  vor dem Upload gerastert werden.
- Screenshots zeigen deutsche UI mit Demo-Daten; die englischen Artikel lösen das über
  Übersetzungshilfen in den Bildunterschriften.
- Die Streak-Demo zeigt 1 Tag/1 Tag (Bestmarke ohne Lücken-Historie); die Captions erklären das
  ehrlich. Ein reicherer Demo-Stand („12 Tage, Bestmarke 34") wäre das nächste Bild-Upgrade.

---

# Zweiter Lauf (03.10., Branch `docs/marketing-artikel-lang`)

Neuauflage nach Nutzer-Vorgabe: **längere Artikel, drei eigenständige Fassungen je Thema ohne
Cross-Verweise** (Skill entsprechend erweitert: 1200–1800 Wörter, Eigenständigkeits-Regel).
Alle fünf Artikel neu geschrieben und erneut drei Jury-Runden durchlaufen.

## Runde-3-Scores (verbindlich)

| Artikel               | Skeptiker | Zyniker | Purist | Ø (von 20) |
| --------------------- | --------- | ------- | ------ | ---------- |
| Zifferblatt · Medium  | 17,5      | 15      | 17,5   | **16,7**   |
| Zifferblatt · web.dev | 18,5      | 18      | 17     | **17,8**   |
| Rückmeldung · Medium  | 17        | 15      | 16     | **16,0**   |
| Rückmeldung · web.dev | 18        | 16      | 16,5   | **16,8**   |
| Rückmeldung · dev.to  | 17,5      | 16      | 16,5   | **16,7**   |

Rangfolge: Zifferblatt/web.dev (17,8) · Rückmeldung/web.dev (16,8) · Zifferblatt/Medium und
Rückmeldung/dev.to (je 16,7) · Rückmeldung/Medium (16,0).

## Erkenntnisse des zweiten Laufs

- **Der schärfste Fund kam wieder aus dem Code:** Die erste lange Fassung erzählte die
  Zeitzonen-Falle falsch herum (23:30 Berlin = 21:30/22:30 UTC am _selben_ Tag; die echte Falle
  sitzt kurz _nach_ Mitternacht deutscher Zeit). Ein Artikel über ehrliche Zähler mit einem
  Rechenfehler im Flaggschiff-Beispiel wäre unfreiwillig komisch gewesen.
- **Eigenständigkeit braucht mehr als „keine Links“:** Ohne Cross-Verweise blieben geteilte
  Signaturen („honest by separation“, „care or log“, „nothing in the loop subtracts“) und ein
  wörtlicher Puls-Satz in beiden Medium-Artikeln — die Juroren lasen das als „dieselbe
  Pressemitteilung in drei Kostümen“. Fix: jede Fassung formuliert ihre Kernsätze selbst.
- **Gegenseitige Widerlegung verhindert Überkorrektur:** In Runde 2 wurden drei Kollegen-Angriffe
  sauber widerlegt („Balamentus“ war längs gefixt, `Math.max` trägt durch die Herleitungs-
  Begründung, die TelefonSeelsorge-Zeile bleibt wahrheitsgemäß drin). Nur was die Runde-2-Prüfung
  überlebt hat, floss in die Fixe ein.
- **Absolutheiten sind die Lieblingswaffe der Juroren:** „never take anything away“ vs.
  Papierkorb, „every view … all four“, „users define their own pillars“ (falsch — die fünf Säulen
  sind fest, `pillarData.ts`). Jede Absolutheit braucht ihre Grenze im Text.

## Veröffentlichungshinweise

- Branch `docs/marketing-artikel-lang` (Worktree `/tmp/balamentum-lang/`, Worktree nach Bedarf
  neu auschecken). Die konkurrierende Linie auf `docs/marketing-artikel` (PR #2056) trägt
  mittellange Fassungen mit Cross-Link-Regel — vor dem Merge entscheiden, welche Linie gilt.
- Medium akzeptiert keine SVGs: `zifferblatt-galerie.png` liegt bereit, `farbrampe-en.svg` und
  `states-en.svg` vor dem Upload rastern.
- Screenshots zeigen deutsche UI mit Demo-Daten; die englischen Artikel glossieren in den
  Captions.

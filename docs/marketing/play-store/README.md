# Google Play — Store-Eintrag

Alle Angaben für den Play-Console-Eintrag von Balamentum (Sprache: Deutsch). Texte stammen aus der
Website (`website/src/i18n/de.json`) und [store-listing.md](../store-listing.md). Die Bilder erzeugt
`frontend/e2e/play-store-shots.spec.ts` neu, wenn sich die Oberfläche ändert:

```
cd frontend && SHOTS=1 pnpm exec playwright test e2e/play-store-shots.spec.ts
```

## Play Store-Einstellungen

| Feld           | Wert                                                              |
| -------------- | ----------------------------------------------------------------- |
| App oder Spiel | App                                                               |
| Kategorie      | Lifestyle                                                         |
| Tags (max. 5)  | Effizienz, Selbsthilfe, Persönlicher Assistent, Lifestyle, Arbeit |
| Ersatz-Tag     | Kalender statt Arbeit, wenn Termine und Serien wichtiger sind     |
| Website        | https://balamentum.modevel.de                                     |

## Text-Assets

**App-Name** (10/30)

```
Balamentum
```

**Kurze Beschreibung** (73/80)

```
Aufgaben planen mit Lebensbalance: Die App zeigt dir, was jetzt dran ist.
```

**Vollständige Beschreibung** (2101/4000, Zählung der Play Console)

```
Woran solltest du als Nächstes arbeiten? Balamentum beantwortet genau diese Frage. Die App rechnet aus Abhängigkeiten und deinen Lebensbereichen aus, welche Aufgabe jetzt am meisten bringt. Du arbeitest sie ab, statt Listen zu sortieren.

EINE NÄCHSTE AUFGABE STATT ENDLOSER LISTE
• Wert, Priorität und Aufwand jeder Aufgabe fließen ein.
• Was noch auf andere Aufgaben wartet, bleibt außen vor.
• Ein Tipp auf „Erledigen“, und die nächste rückt nach.

LEBENSBALANCE, OBJEKTIV GEMESSEN
Fünf Säulen: Körper, mentale Gesundheit, Beziehungen, Wirksamkeit und Sinn. Deine Balance ergibt sich aus dem, was du tatsächlich erledigt hast, gewichtet nach Aufwand. Kein Schieberegler, kein Quiz.
• Das Dashboard zeigt, wie ausgeglichen deine letzten vier Wochen waren.
• Auf Wunsch rücken Aufgaben vernachlässigter Säulen nach vorn.
• Behutsame Hinweise, wenn ein Bereich länger zu kurz kommt.

EIN ECHTER AUFGABEN-GRAPH
Aufgaben bauen aufeinander auf. Balamentum rechnet Wert und Aufwand über die ganze Kette, zeigt dir, welche Aufgabe worauf wartet, und erkennt Zyklen.

SCHNELL ERFASST
• Aufgaben tippen oder einsprechen.
• Die KI macht aus einem ganzen Satz einzelne Aufgaben und schlägt passende Säulen vor.
• Serien, Checklisten und Fristen für alles, was wiederkehrt.

GEMEINSAM PLANEN
Lade Familie oder Team per Link in eine Gruppe ein und verteilt Aufgaben untereinander.

ERINNERT DICH ZUR RICHTIGEN ZEIT
Push-Erinnerungen und Erinnerungen am Ort.

MIT DEINEM KI-ASSISTENTEN
Über die MCP-Schnittstelle greift dein KI-Assistent, zum Beispiel Claude, auf deine Aufgaben zu. Frag im Chat, was als Nächstes dran ist, leg Aufgaben an oder lass dir deine Balance erklären.

PAKETE
Free kostet nichts und begrenzt die Zahl deiner Aufgaben nicht. Plus und Pro schalten Gruppen, KI-Hilfe, Erinnerungen am Ort und die MCP-Schnittstelle frei.

BARRIEREFREI UND FÜR EINE HAND GEBAUT
Die Oberfläche folgt WCAG 2.2 und BITV 2.0. Anmelden kannst du dich mit Google, ohne eigenes Passwort.

Hinweis: Balamentum unterstützt Lebensbalance und Selbstfürsorge. Es ist kein Medizinprodukt und ersetzt keinen ärztlichen Rat.
```

Bewusst nicht im Text: PayPal (Abos in der App laufen über Google Play Billing, ADR 0017),
„installierbar ohne App-Store“ und Werbewörter wie „kostenlos“ in der Kurzbeschreibung
(Metadaten-Richtlinie).

## Visuelle Assets

| Feld                   | Datei                                      | Maße        |
| ---------------------- | ------------------------------------------ | ----------- |
| App-Symbol             | [icon.png](icon.png)                       | 512 × 512   |
| Vorstellungsgrafik     | [feature-graphic.png](feature-graphic.png) | 1024 × 500  |
| Screenshots Telefon    | [phone/](phone/)                           | 1080 × 1920 |
| Screenshots 7"-Tablet  | [tablet-7/](tablet-7/)                     | 1152 × 2048 |
| Screenshots 10"-Tablet | [landscape/](landscape/)                   | 1920 × 1080 |
| Desktop-Screenshots    | [landscape/](landscape/)                   | 1920 × 1080 |
| Screenshots Android XR | [landscape/](landscape/)                   | 1920 × 1080 |

Reihenfolge beim Hochladen: `dashboard`, `next`, `balance`, `dependencies`, `ai`.

Das Symbol ist die maskable-Variante aus `frontend/public/icons/` mit weißem Hintergrund bis zum
Rand. Play legt die runde Maske selbst darüber.

## Video

`website/public/imagefilm.mp4` auf YouTube hochladen (öffentlich oder nicht gelistet, ohne
Altersbeschränkung, Werbung aus) und die URL im Feld „Video“ eintragen. Die XR-Video-Felder
bleiben leer.

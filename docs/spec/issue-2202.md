# Spec #2202 — Website-Footer: Label „Vorlagen“ übersetzen

**Ziel:** Das Footer-Label des Links auf die Vorlagen-Seite kommt in allen zehn Sprachen aus den Übersetzungen.

**Vorbedingung:** Startseite einer beliebigen Sprache (`renderLanding`).

**Schritte / erwartetes Ergebnis:**

1. `website/src/i18n/<sprache>.json` enthält `footer.templates` (nicht leer) in allen zehn Sprachen.
2. Der Footer enthält `href="/vorlagen/" hreflang="de">{footer.templates}</a>`; Ziel bleibt die deutsche Vorlagen-Seite.
3. Auf `en` steht nicht mehr das deutsche „Vorlagen“.
4. `renderTemplateIndex` nimmt nur `PageContext` (kein `allMessages`); abgesichert durch `tsc` im Website-Build, kein eigener Test.

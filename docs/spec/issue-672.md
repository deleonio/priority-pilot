# Issue 672 – parseNameArg Robustheit bei mehrzeiligen Template-Literalen

**Stand:** 2026-08-14  
**Ziel:** parseNameArg in analyze-test-suite.ts robust gegen mehrzeilige Template-Literale mit Interpolationen machen

---

## Ziel

Die Namens-Extraktion in `parseNameArg` (.github/scripts/analyze-test-suite.ts) soll mehrzeilige Template-Literale mit `${...}`-Interpolationen korrekt verarbeiten und nur den statischen Textanteil als Test-Namen extrahieren, nicht den gesamten Quelltext.

---

## Vorbedingung

- Der Test-Scanner `analyze-test-suite.ts` wird ausgeführt (lokal oder via GitHub Actions)
- Eine Test-Datei enthält einen Test mit einem Template-Literal-Namen, der Interpolationen enthält

---

## Schritte

1. **Scanner findet Test mit Template-Literal-Namen**
   - Der Scanner stößt auf einen `it()`- oder `test()`-Aufruf
   - Das erste Argument ist ein Template-Literal mit Interpolationen, z. B.:
     ```typescript
     it(`${label}: ist eine RGBA-PNG (hat Alpha-Kanal)`, () => { ... })
     ```

2. **parseNameArg verarbeitet das Template-Literal**
   - Die Funktion erhält das Template-Literal als String inkl. Backticks
   - Der aktuelle Regex `/^([`'"])([\s\S]*)\1$/` extrahiert den gesamten Inhalt
   - Der anschließende `replace(/\$\{[^}]*\}/g, '')` entfernt Interpolationen

3. **Statischer Textanteil extrahieren**
   - Nach dem Entfernen der Interpolationen wird nur der statische Textanteil behalten
   - Zeilenumbrüche und übermäßige Whitespace werden getrimmt
   - Das Ergebnis ist der echte, einzeilige Test-Name

---

## Erwartetes Ergebnis

- **AK1:** Der `logo-transparency.test.ts` Test wird (falls überhaupt gelistet) mit seinem echten, einzeiligen Namen angezeigt, z. B. „logo-with-name.horizontal.png: ist eine RGBA-PNG (hat Alpha-Kanal)“ – nicht der gesamte Template-Literal-Content mit `${label}`-Platzhaltern, Tabs und Zeilenumbrüchen.
- **AK2:** Test-Namen anderer Tests mit mehrzeiligen Template-Literalen werden ebenfalls korrekt extrahiert (nur statischer Textanteil, keine Interpolationen, kein zerhackter Content).
- Der Test-Optimierungs-Report zeigt keine „zerhackten" Test-Namen mehr für Tests mit Template-Literal-Namen.
- Die Extraktion funktioniert robust für alle gängigen Muster von Template-Literal-Namen in der Codebase.

---

## Test-Strategie (gemäß ADR #567)

Da es sich um `.github/scripts/` handelt, werden **keine Unit-Tests** geschrieben. Die Verifikation erfolgt über:

1. **Lokalen Scanner-Lauf** über `frontend/src/lib/logo-transparency.test.ts`
   - Erwartung: Test-Name wird korrekt angezeigt (nicht zerhackt)
   - Überprüfung: Console-Output oder generierter Report

2. **Verify-Lauf über andere Tests mit Template-Literal-Namen**
   - Erwartung: Alle solche Tests zeigen korrekte, einzeilige Namen

3. **Mutationstest (manuell):**
   - Template-Literal-Name mit mehreren Zeilen und komplexen Interpolationen erstellen
   - Scanner laufen lassen
   - Verifizieren: Name ist sauber extrahiert, kein Quelltext-Leak

---

## Randfälle & Fehler

| Situation                            | Erwartetes Verhalten                                    |
| ------------------------------------ | ------------------------------------------------------- |
| Einfacher String-Literal-Name        | Funktioniert wie bisher (kein Template-Literal)         |
| Template-Literal ohne Interpolation  | Wird korrekt als statischer Text extrahiert             |
| Template-Literal mit ${}-Platzhalter | Platzhalter werden entfernt, nur statischer Text bleibt |
| Gemischte Zeilenumbrüche             | Werden auf einzeiligen Text getrimmt                    |
| Leeres Template-Literal              | Fällt auf „unnamed" zurück                              |

---

## Hinweise

- **Spezifikations-Vorrang:** Dieser Spec beschreibt das beobachtbare Verhalten von parseNameArg. Jede Implementierung muss diese Spezifikation erfüllen.
- **Implementierungspfad:** Der Spec sagt nicht, wie parseNameArg intern funktioniert – nur dass das Ergebnis korrekt sein muss.
- **Verifikationsweg:** Der Test-Optimierungs-Report vom 2026-08-14 zeigte 1 Info-Finding für `logo-transparency.test.ts` mit einem zerhackten Test-Namen. Nach dem Fix darf dieses Finding nicht mehr auftreten.
- **ADR #567-Compliance:** Keine Unit-Tests für .github/scripts/ – Verifikation über lokalen Scanner-Lauf.

---

## Versionierung

- **v1.0** (2026-08-14): Initialefassung für Issue #672. parseNameArg Robustheit gegen mehrzeilige Template-Literale spezifiziert.

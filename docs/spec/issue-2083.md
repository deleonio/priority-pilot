# Spec #2083 — Nutzungsbedingungen: Haftung ergänzen

Ziel: `/nutzungsbedingungen/` stellt im Abschnitt Haftung klar, was Balamentum nicht leistet, und schließt die Haftung für KI-Vorschläge aus.

## Voraussetzung

Seite `renderTerms` (#1891), Re-Consent-Mechanik (#1901).

## Erwartetes Ergebnis

- AK1: Abschnitt Haftung sagt, Balamentum bildet nur selbst erfasste Tätigkeiten ab und leistet keine Lebensrettung, Krisenintervention oder medizinische Betreuung.
- AK2: Ein Absatz zu KI-generierten Vorschlägen schließt die Haftung aus (Hilfe ohne Gewähr).
- AK3: TelefonSeelsorge „0800 111 0 111“ bleibt.
- AK4: `TERMS_VERSION` (`server/src/logics/legal.ts`) wird auf das Änderungsdatum erhöht; bestehende Konten bestätigen erneut. Kein eigener Test (Spiegel; Mechanik in `terms-consent.test.ts`).
- AK5: Zu-meiden-Liste (`i18n-mdr-wording.test.ts`) bleibt grün.

Test: `website/src/render.test.ts`, describe `renderTerms (#1891)`.

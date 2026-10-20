# Rechtsverweise: Widerrufs-Link in der App, AGB-Verweis auf „Vertrag kündigen“ – Issue 2776

**Stand:** 2026-10-20
**Ziel:** Der „Rechtliches“-Block der App (Hilfe → Impressum, `LegalLinks` in `frontend/src/components/Impress.tsx`) listet neben Nutzungsbedingungen und Datenschutz auch die Widerrufsbelehrung; die Nutzungsbedingungen nennen die Kündigungsseite beim echten Seitentitel („Vertrag kündigen“ bzw. „Cancel contract“, `website/src/cancellation.ts`).

Pfadquelle ist das vorhandene `LEGAL_LINKS` in `frontend/src/lib/operator.ts:21–24` — `withdrawal` existiert dort bereits, es fehlt nur der Render-Schritt. Labels folgen dem Muster „Linktext = echter Seitentitel des Ziels“: de „Widerrufsbelehrung“ (`website/src/withdrawal.ts:21`), en „Right of withdrawal“ (`website/src/withdrawal.ts:67`).

---

## Journey: Rechtsverweise in App und AGB

### Ziel

Nutzer finden die Widerrufsbelehrung vom Impressum aus; der AGB-Text verweist auf die Kündigungsseite, ohne einen veralteten Kurztitel zu nennen.

### Vorbedingung

- App gerendert, Hilfe-Tab „Impressum“ (Komponente `Impress`), Sprache de bzw. en.
- Website-Texte `TERMS` (`website/src/terms.ts`) und `CANCELLATION` (`website/src/cancellation.ts`) importierbar.

### Schritte / Erwartetes Ergebnis

1. **Widerrufs-Link im „Rechtliches“-Block (AK1, TF1)**
   - `ul.help-legal-links` enthält genau drei `li` (terms, privacy, withdrawal).
   - Der Widerrufs-Link hat href-Suffix `/widerruf/` (de) bzw. `/en/withdrawal/` (en), `hreflang` der Sprache und Label aus dem neuen i18n-Key `legal.withdrawal` (de „Widerrufsbelehrung“, en „Right of withdrawal“) — nicht den langen Bestell-Dialog-Key `withdrawal.link`.
2. **Hinweistext zur Drei-Link-Liste (AK2, TF2)**
   - `legal.newTab` (`#legal-links-hint`, de + en) sagt nicht mehr „Beide Links …“/„Both links …“.
3. **AGB-Verweis mit echtem Seitentitel (AK3, TF3)**
   - `TERMS.de` enthält „Seite „Vertrag kündigen““ (Spiegel `CANCELLATION.de.title`) und nicht mehr „Seite „Kündigen““.
   - `TERMS.en` enthält „“Cancel contract” page“ (Spiegel `CANCELLATION.en.title`) und nicht mehr „“Cancel” page“.

### Offene Fragen

- (keine)

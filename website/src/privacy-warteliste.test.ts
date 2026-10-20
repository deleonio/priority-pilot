import { describe, expect, it } from 'vitest';

import { PRIVACY } from './privacy.ts';

/**
 * Warteliste-Abschnitt der Datenschutzerklärung (#2768, Vertrag: docs/spec/issue-2768.md).
 * PO-Festhaltung: Art. 6 Abs. 1 lit. b DSGVO; Löschung sofort nach Freischaltung, nicht
 * freigeschaltete Einträge 6 Wochen nach Ende der Warteliste, jederzeit auf Anforderung,
 * Empfänger keine — in beiden Sprachversionen (de `/datenschutz/`, en `/en/privacy/`).
 */
describe('Datenschutzerklärung — Warteliste-Abschnitt (#2768, AK1)', () => {
	const warteliste = (text: (typeof PRIVACY)['de']) =>
		text.sections.find((s) => /warteliste|waitlist/i.test(s.heading));

	it('de: Abschnitt "Warteliste" mit Zweck, lit. b, Löschfristen und Empfängern (keine)', () => {
		const abschnitt = warteliste(PRIVACY.de);
		expect(abschnitt, 'Abschnitt "Warteliste" fehlt in der deutschen Datenschutzerklärung').toBeDefined();
		const f = abschnitt!.facts;
		expect(f, 'Pflichtangaben (facts) zum Warteliste-Abschnitt fehlen').toBeDefined();
		expect(f!.purpose).toMatch(/Warteliste/);
		expect(`${f!.purpose} ${abschnitt!.paragraphs.join(' ')}`).toMatch(/Zugang/);
		expect(f!.legalBasis).toMatch(/Art\.?\s*6\s*Abs\.?\s*1/i);
		expect(f!.legalBasis).toMatch(/lit\.?\s*b/i);
		expect(f!.retention).toMatch(/sofort nach Freischaltung/i);
		expect(f!.retention).toMatch(/6\s*Wochen/i);
		expect(f!.retention).toMatch(/Anforderung/i);
		expect(f!.recipients).toMatch(/keine/i);
	});

	it('en: Waitlist section with purpose, legal basis lit. b, retention and recipients (none)', () => {
		const section = warteliste(PRIVACY.en);
		expect(section, 'Waitlist section missing from the English privacy notice').toBeDefined();
		const f = section!.facts;
		expect(f, 'facts missing for the waitlist section').toBeDefined();
		const kontext = `${f!.purpose} ${section!.paragraphs.join(' ')}`;
		expect(kontext).toMatch(/waitlist/i);
		expect(kontext).toMatch(/access|launch/i);
		expect(f!.legalBasis).toMatch(/art/i);
		expect(f!.legalBasis).toMatch(/6/);
		expect(f!.legalBasis).toMatch(/\blit\.?\s*b|\(b\)/i);
		expect(f!.retention).toMatch(/immediately/i);
		expect(f!.retention).toMatch(/6\s*weeks/i);
		expect(f!.retention).toMatch(/request/i);
		expect(f!.recipients).toMatch(/none/i);
	});
});

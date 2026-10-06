import { describe, expect, it } from 'vitest';
// ROTER Spec-Test (#1992, docs/spec/issue-1992.md, AK6): `challengeShareCard` existiert noch nicht.
import { erzeugeChallengeKarteSvg } from './challengeShareCard';

const svgText = (svg: string): string => svg.replace(/<[^>]+>/g, ' ');

const DATEN = {
	gruppe: 'Familie Mustermann',
	zeitraum: '5.10. – 12.10.2026',
	rangfolge: [
		{ name: 'Alice', rang: 1, balance: 0.82, aufgaben: ['Geheimprojekt Quarterly abschließen'] },
		{ name: 'Bob', rang: 2, balance: 0.4, aufgaben: ['Zahnarzt: Krone einsetzen lassen'] },
	],
};

describe('challengeShareCard — reine SVG-Erzeugung (#1992 AK6)', () => {
	it('enthält Gruppenname, Zeitraum und Rangfolge', () => {
		const text = svgText(erzeugeChallengeKarteSvg(DATEN));
		expect(text).toContain('Familie Mustermann');
		expect(text).toContain('5.10. – 12.10.2026');
		expect(text).toContain('Alice');
		expect(text).toContain('Bob');
		expect(text).toMatch(/\b1\b/);
		expect(text).toMatch(/\b2\b/);
	});

	it('Köder: enthält NIE Aufgabeninhalte', () => {
		const svg = erzeugeChallengeKarteSvg(DATEN);
		expect(svg).not.toContain('Geheimprojekt');
		expect(svg).not.toContain('Zahnarzt');
	});

	it('#2275 AK5: Domain balamentum.modevel.de als Link-Ziel und Text, nie balamentum.app', () => {
		const svg = erzeugeChallengeKarteSvg(DATEN);
		expect(svg).toContain('href="https://balamentum.modevel.de"');
		expect(svgText(svg)).toContain('balamentum.modevel.de');
		expect(svg).not.toContain('balamentum.app');
	});
});

import { describe, expect, it } from 'vitest';
// ROTER Spec-Test (#1995, docs/spec/issue-1995.md): `monthlyShareCard` existiert noch nicht.
// Der Import schlägt fehl, bis `frontend/src/lib/monthlyShareCard.ts` die Funktionen bereitstellt.
import { erzeugeMonatsKarteSvg, monatsDateiname, vormonat } from './monthlyShareCard';

/**
 * Spec-Tests für die reine SVG-Erzeugung der Monats-Rückblick-Karte (#1995 AK2): Name und Wert
 * je Säule, Streak, Monatslabel und Meilensteine stehen als Text im SVG; Aufgaben-Titel/-inhalte
 * dürfen nie hineingelangen (Köder-Test); Nutzereingaben werden XML-sicher escapt; bei leerer
 * Meilenstein-Liste gibt es keine Meilenstein-Zeile (Fürsorge-Tonalität: sorgt, nicht
 * protokolliert). Ohne DOM testbar — der Funktion werden nur Daten übergeben.
 */

/** Textinhalt des SVG ohne Markup: Attributwerte (viewBox, Pfaddaten) fließen nicht ein. */
const svgText = (svg: string): string => svg.replace(/<[^>]+>/g, ' ');

const SAEULEN = [
	{ name: 'Bewegung', wert: 7, aufgaben: ['Geheimprojekt Quarterly abschließen'] },
	{ name: 'Ernährung', wert: 4, aufgaben: ['Zahnarzt: Krone einsetzen lassen'] },
	{ name: 'Schlaf', wert: 9, aufgaben: [] },
	{ name: 'Achtsamkeit', wert: 5, aufgaben: [] },
	{ name: 'Soziales', wert: 6, aufgaben: ['Oma anrufen'] },
];

const MEILENSTEINE = ['Streak 7 Tage', '1000 Punkte'];

describe('monthlyShareCard — reine SVG-Erzeugung (#1995 AK2)', () => {
	it('enthält je Säule Name und Wert, Streak und Monatslabel als Text', () => {
		const svg = erzeugeMonatsKarteSvg({
			saeulen: SAEULEN,
			streak: 12,
			meilensteine: MEILENSTEINE,
			monat: 'Rückblick September 2026',
		});
		const text = svgText(svg);
		for (const saeule of SAEULEN) {
			expect(text).toContain(saeule.name);
			expect(text).toMatch(new RegExp(`\\b${saeule.wert}\\b`));
		}
		expect(text).toMatch(/\b12\b/);
		expect(text).toContain('Rückblick September 2026');
	});

	it('listet Meilensteine — aber nur, wenn es welche gibt (keine 0-Meilensteine-Zeile)', () => {
		const mit = erzeugeMonatsKarteSvg({
			saeulen: SAEULEN,
			streak: 3,
			meilensteine: MEILENSTEINE,
			monat: 'Rückblick September 2026',
		});
		expect(svgText(mit)).toContain('Streak 7 Tage');
		expect(svgText(mit)).toContain('1000 Punkte');
		expect(mit).toMatch(/Meilenstein/);

		const ohne = erzeugeMonatsKarteSvg({
			saeulen: SAEULEN,
			streak: 3,
			meilensteine: [],
			monat: 'Rückblick September 2026',
		});
		expect(ohne).not.toMatch(/Meilenstein/);
	});

	it('Köder: enthält NIE Aufgaben-Titel oder -inhalte', () => {
		const svg = erzeugeMonatsKarteSvg({
			saeulen: SAEULEN,
			streak: 3,
			meilensteine: [],
			monat: 'Rückblick September 2026',
		});
		expect(svg).not.toContain('Geheimprojekt');
		expect(svg).not.toContain('Zahnarzt');
		expect(svg).not.toContain('Oma anrufen');
	});

	it('escapt Säulen- und Meilenstein-Namen XML-sicher', () => {
		const svg = erzeugeMonatsKarteSvg({
			saeulen: [{ name: 'A&B<c>', wert: 1 }],
			streak: 1,
			meilensteine: ['Ehre & Ruhm <2026>'],
			monat: 'Rückblick September 2026',
		});
		expect(svg).toContain('A&amp;B');
		expect(svg).toContain('&lt;c&gt;');
		expect(svg).toContain('Ehre &amp; Ruhm');
		expect(svg).toContain('&lt;2026&gt;');
		expect(svg).not.toContain('A&B');
		expect(svg).not.toContain('<c>');
	});

	it('vormonat liefert den Vormonat lokal, auch über den Jahreswechsel', () => {
		expect(vormonat(new Date(2026, 9, 15))).toBe('2026-09');
		expect(vormonat(new Date(2026, 10, 1))).toBe('2026-10');
		expect(vormonat(new Date(2027, 0, 15))).toBe('2026-12');
	});

	it('monatsDateiname baut den sprachneutralen Namen mit Monat', () => {
		expect(monatsDateiname('2026-09')).toBe('balamentum-monat-2026-09.png');
	});
});

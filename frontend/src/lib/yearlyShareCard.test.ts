import { describe, expect, it } from 'vitest';
// ROTER Spec-Test (#1997, docs/spec/issue-1997.md): `yearlyShareCard` existiert noch nicht.
// Der Import schlägt fehl, bis `frontend/src/lib/yearlyShareCard.ts` die Funktionen bereitstellt.
import { erzeugeJahresKarteSvg, jahresDateiname } from './yearlyShareCard';

/**
 * Spec-Tests für die reine SVG-Erzeugung der Jahresrückblick-Karte (#1997 AK6): alle Kennzahlen
 * stehen als Text im SVG, Aufgabentitel/-inhalte gelangen nie hinein (Köder), Säulenname wird
 * XML-sicher escapt, ohne stärkste Säule entfällt deren Zeile. Ohne DOM testbar.
 */

/** Textinhalt des SVG ohne Markup: Attributwerte (viewBox, Pfaddaten) fließen nicht ein. */
const svgText = (svg: string): string => svg.replace(/<[^>]+>/g, ' ');

const DATEN = {
	jahr: 2025,
	label: 'Mein Jahr 2025',
	erledigteAufgaben: 412,
	stunden: 187.5,
	laengsterStreak: 33,
	staerksteSaeule: { name: 'Bewegung', punkte: 91 },
	abgeschlosseneProjekte: 7,
	// Köder: darf nirgends im Bild landen (AK6) — die Funktion kennt nur die Kennzahlen.
	aufgaben: ['Geheimprojekt Quarterly abschließen', 'Zahnarzt: Krone einsetzen lassen'],
};

describe('yearlyShareCard — reine SVG-Erzeugung (#1997 AK6)', () => {
	it('enthält alle Kennzahlen, Säulenname und Jahreslabel als Text', () => {
		const text = svgText(erzeugeJahresKarteSvg(DATEN));
		expect(text).toMatch(/\b412\b/);
		expect(text).toMatch(/187[.,]5/);
		expect(text).toMatch(/\b33\b/);
		expect(text).toMatch(/\b7\b/);
		expect(text).toContain('Bewegung');
		expect(text).toContain('Mein Jahr 2025');
	});

	it('Köder: enthält NIE Aufgaben-Titel oder -inhalte', () => {
		const svg = erzeugeJahresKarteSvg(DATEN);
		expect(svg).not.toContain('Geheimprojekt');
		expect(svg).not.toContain('Zahnarzt');
	});

	it('escapt den Säulennamen XML-sicher', () => {
		const svg = erzeugeJahresKarteSvg({ ...DATEN, staerksteSaeule: { name: 'A&B<c>', punkte: 1 } });
		expect(svg).toContain('A&amp;B');
		expect(svg).toContain('&lt;c&gt;');
		expect(svg).not.toContain('A&B');
		expect(svg).not.toContain('<c>');
	});

	it('ohne stärkste Säule (null) entfällt deren Name, die übrigen Kennzahlen bleiben', () => {
		const text = svgText(erzeugeJahresKarteSvg({ ...DATEN, staerksteSaeule: null }));
		expect(text).not.toContain('Bewegung');
		expect(text).toMatch(/\b412\b/);
	});

	it('jahresDateiname baut den sprachneutralen Namen mit Jahr', () => {
		expect(jahresDateiname(2025)).toBe('balamentum-jahr-2025.png');
	});

	it('#2275 AK5: Domain balamentum.modevel.de als Link-Ziel und Text, nie balamentum.app', () => {
		const svg = erzeugeJahresKarteSvg(DATEN);
		expect(svg).toContain('href="https://balamentum.modevel.de"');
		expect(svgText(svg)).toContain('balamentum.modevel.de');
		expect(svg).not.toContain('balamentum.app');
	});
});

import { describe, expect, it } from 'vitest';
// ROTER Spec-Test (#1968, docs/spec/issue-1968.md): `weeklyShareCard` existiert noch nicht.
// Der Import schlägt fehl, bis `frontend/src/lib/weeklyShareCard.ts` die Funktion bereitstellt.
import { erzeugeWochenKarteSvg } from './weeklyShareCard';

/**
 * Spec-Tests für die reine SVG-Erzeugung der Wochen-Balance-Karte (#1968 AK1): Name und Wert
 * je Säule, Streak und Wochenlabel stehen im SVG; Aufgaben-Titel/-inhalte dürfen nie hinein-
 * gelangen (Köder-Test). Ohne DOM testbar — der Funktion werden nur Daten übergeben.
 */

/** Textinhalt des SVG ohne Markup: Attributwerte (viewBox, Pfaddaten) fließen nicht ein. */
const svgText = (svg: string): string => svg.replace(/<[^>]+>/g, ' ');

const SAEULEN = [
	{ name: 'Bewegung', wert: 7, aufgaben: ['Geheimprojekt Quarterly abschließen'] },
	{ name: 'Ernährung', wert: 4, aufgaben: ['Zahnarzt: Krone einsetzen lassen'] },
	{ name: 'Schlaf', wert: 9, aufgaben: [] },
	{ name: 'Achtsamkeit', wert: 5, aufgaben: [] },
	{ name: 'Soziales', wert: 6, aufgaben: ['Oma anrufen — Geheimprojekt nicht erwähnen'] },
];

describe('weeklyShareCard — reine SVG-Erzeugung (#1968 AK1)', () => {
	it('enthält je Säule Name und Wert, Streak und Wochenlabel als Text', () => {
		const svg = erzeugeWochenKarteSvg({ saeulen: SAEULEN, streak: 12, woche: 'KW 41 / 2026' });
		const text = svgText(svg);
		for (const saeule of SAEULEN) {
			expect(text).toContain(saeule.name);
			expect(text).toMatch(new RegExp(`\\b${saeule.wert}\\b`));
		}
		expect(text).toMatch(/\b12\b/);
		expect(text).toContain('KW 41 / 2026');
	});

	it('trägt die Marke und einen dezenten Link', () => {
		const svg = erzeugeWochenKarteSvg({ saeulen: SAEULEN, streak: 1, woche: 'KW 41 / 2026' });
		expect(svg).toContain('Balamentum');
		expect(svg).toContain('href=');
	});

	it('Köder: enthält NIE Aufgaben-Titel oder -inhalte', () => {
		const svg = erzeugeWochenKarteSvg({ saeulen: SAEULEN, streak: 3, woche: 'KW 41 / 2026' });
		expect(svg).not.toContain('Geheimprojekt');
		expect(svg).not.toContain('Zahnarzt');
		expect(svg).not.toContain('Oma anrufen');
	});

	it('#2275 AK5: Domain balamentum.modevel.de als Link-Ziel und Text, nie balamentum.app', () => {
		const svg = erzeugeWochenKarteSvg({ saeulen: SAEULEN, streak: 12, woche: 'KW 41 / 2026' });
		expect(svg).toContain('href="https://balamentum.modevel.de"');
		expect(svgText(svg)).toContain('balamentum.modevel.de');
		expect(svg).not.toContain('balamentum.app');
	});
});

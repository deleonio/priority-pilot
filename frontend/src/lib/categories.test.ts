import type { Category } from 'client';
import { describe, expect, it } from 'vitest';
import { sortCategoriesByName } from './categories';

/**
 * Tests der Anzeigereihenfolge für Kategorien. Geprüft werden genau die Fälle, an denen die
 * Sortierung des Servers scheitert: SQLite vergleicht mit der BINARY-Kollation byteweise, sortiert
 * also Kleinschreibung hinter die Großschreibung und Umlaute ganz ans Ende. Ein einfacher
 * `<`-Vergleich im Client hätte dieselben zwei Fehler — deshalb `Intl.Collator`.
 */
describe('sortCategoriesByName', () => {
	/** Baut Kategorien aus Namen; Farbe und ID spielen für die Sortierung keine Rolle. */
	const categoriesOf = (...names: string[]): Category[] =>
		names.map((name, index) => ({ id: index + 1, name, color: '#b42318' }));

	const namesOf = (categories: Category[]): string[] => categories.map((category) => category.name);

	it('sortiert Umlaute an ihren Platz im Alphabet, nicht ans Ende', () => {
		// SQLite liefert hier „Auto | Bau | Ärzte" — der Umlaut steht als Mehrbyte-Zeichen hinter
		// jedem ASCII-Buchstaben.
		expect(namesOf(sortCategoriesByName(categoriesOf('Bau', 'Ärzte', 'Auto')))).toEqual(['Ärzte', 'Auto', 'Bau']);
	});

	it('mischt Groß- und Kleinschreibung, statt sie in zwei Blöcke zu trennen', () => {
		// SQLite liefert hier „Bau | Zoo | auto": alle Großbuchstaben zuerst, dann alle kleinen.
		expect(namesOf(sortCategoriesByName(categoriesOf('Zoo', 'auto', 'Bau')))).toEqual(['auto', 'Bau', 'Zoo']);
	});

	it('sortiert Zahlen im Namen numerisch', () => {
		// Ohne `numeric: true` gewinnt die Ziffernfolge und „Projekt 10" stünde vor „Projekt 2".
		expect(namesOf(sortCategoriesByName(categoriesOf('Projekt 10', 'Projekt 2', 'Projekt 1')))).toEqual([
			'Projekt 1',
			'Projekt 2',
			'Projekt 10',
		]);
	});

	it('lässt die übergebene Liste unverändert', () => {
		// Die Eingabe ist die Antwort des API-Clients — eine In-Place-Sortierung würde sie unter den
		// Füßen jedes anderen Aufrufers umbauen.
		const original = categoriesOf('Zoo', 'Ärzte', 'auto');

		sortCategoriesByName(original);

		expect(namesOf(original)).toEqual(['Zoo', 'Ärzte', 'auto']);
	});

	it('kommt mit einer leeren Liste zurecht', () => {
		expect(sortCategoriesByName([])).toEqual([]);
	});
});

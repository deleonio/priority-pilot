import type { Category } from 'client';
import i18next from '../i18n/config';

/**
 * Kollator für die Anzeigereihenfolge der Kategorien: einmal je Sortierung in der aktiven Sprache
 * angelegt, nicht im Vergleichs-Callback (dort entstünde er pro Paar neu).
 *
 * `numeric: true` sortiert „Projekt 2" vor „Projekt 10" — ohne die Option gewinnt die Ziffernfolge
 * und die Zehn stünde vor der Zwei.
 */

/**
 * Kategorien nach Namen sortieren, wie ein Leser der aktiven Sprache sie erwartet.
 *
 * Der Server sortiert bereits (`GET /categories`, `order: [['name', 'ASC']]`), aber SQLite
 * vergleicht Text byteweise (BINARY-Kollation): Kleinschreibung landet hinter der Großschreibung
 * und Umlaute ganz am Ende — aus „Äpfel, Auto, Bau, zoo" wird dort „Auto, Bau, zoo, Äpfel".
 * `COLLATE NOCASE` würde nur den ASCII-Teil davon beheben, für die Umlaute hat SQLite ohne
 * ICU-Erweiterung nichts anzubieten. Deshalb liegt die anzeigetaugliche Sortierung hier.
 *
 * Gibt eine neue Liste zurück und sortiert nicht an Ort und Stelle: Die Eingabe ist die Antwort des
 * API-Clients, die niemand sonst verändert sehen will.
 */
export const sortCategoriesByName = (categories: Category[]): Category[] => {
	const collator = new Intl.Collator(i18next.language, { numeric: true });
	return [...categories].sort((a, b) => collator.compare(a.name, b.name));
};

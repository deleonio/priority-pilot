/**
 * Minimaler RFC-4180-CSV-Parser (#1969): BOM entfernen, LF/CRLF als Zeilentrenner, Anführungszeichen
 * um Felder (Komma im Feld, `""`-Escape). Keine Fremd-Dependency — Todoist-Exporte nutzen genau diese
 * Merkmalsmischung. Leerzeilen entfallen; der Parser ist deterministisch und ohne Netz.
 */
export const parseCsv = (text: string): string[][] => {
	const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let inQuotes = false;

	const endRow = (): void => {
		row.push(field);
		// Leerzeile: genau ein leeres Feld — alles andere (auch `,,,`) ist eine Datenzeile.
		if (row.length > 1 || row[0] !== '') rows.push(row);
		row = [];
		field = '';
	};

	for (let i = 0; i < input.length; i++) {
		const char = input[i];
		if (inQuotes) {
			if (char === '"') {
				// `""` innerhalb eines quoted field ist ein escaptes Anführungszeichen.
				if (input[i + 1] === '"') {
					field += '"';
					i++;
				} else {
					inQuotes = false;
				}
			} else {
				field += char;
			}
			continue;
		}
		if (char === '"') {
			inQuotes = true;
			continue;
		}
		if (char === ',') {
			row.push(field);
			field = '';
			continue;
		}
		if (char === '\r') {
			if (input[i + 1] === '\n') i++;
			endRow();
			continue;
		}
		if (char === '\n') {
			endRow();
			continue;
		}
		field += char;
	}
	// Letzte Zeile ohne abschließenden Zeilenumbruch.
	if (field !== '' || row.length > 0) endRow();
	return rows;
};

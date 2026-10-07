import zlib from 'node:zlib';

/** Wahr, wenn eine PDF-Textzeile `text` enthält (Glyph-IDs über die ToUnicode-CMap, gemeinsamer Test-Helper). */
export const pdfContains = (bytes: Uint8Array, text: string): boolean => {
	const pdf = Buffer.from(bytes);
	const streams: string[] = [];
	for (let i = pdf.indexOf('stream\n'); i !== -1; i = pdf.indexOf('>>\nstream\n', i + 1)) {
		const start = pdf.indexOf('stream\n', i) + 7;
		streams.push(zlib.inflateSync(pdf.subarray(start, pdf.indexOf('endstream', start))).toString('latin1'));
	}
	// Regular und Fett sind getrennte Schriften mit eigener CMap — jede Variante prüfen.
	const hexes = streams
		.filter((stream) => stream.includes('beginbfchar'))
		.map((cmap) => {
			const glyphIds = new Map(
				[...cmap.matchAll(/<([0-9A-F]{4})> <([0-9A-F]{4})>/g)].map(([, gid, code]) => [
					String.fromCharCode(parseInt(code, 16)),
					gid,
				]),
			);
			return Array.from(text, (char) => glyphIds.get(char) ?? '?').join('');
		})
		.filter((hex) => !hex.includes('?'));
	return hexes.some((hex) => streams.some((stream) => stream.includes(hex)));
};

#!/usr/bin/env node
// Bild-Entfernung aus Markdown (Issue #1021, Datenschutz): der Documenter bearbeitet
// PRs und Issues, deren Beschreibungen/Kommentare Screenshots enthalten können. Diese
// deterministische Funktion (KEIN LLM — Regel-Logik gehört laut Workflow-Arbeitsteilung
// in Skripte) ersetzt jede Bild-Referenz durch einen Platzhalter und lässt den Rest
// byte-identisch. Aufgerufen aus pr-image-strip.sh (Remote-Sweep) — lokal testbar via
// stdin/stdout oder --in-place.

export const PLACEHOLDER = '[Bild entfernt – Datenschutz]';

// Nackte Bild-Quellen (auch ausserhalb von Markdown-/HTML-Syntax): data:-URIs und
// GitHub-User-Attachments. Reihenfolge innerhalb transformSegment: spezifisch -> generisch,
// damit verlinkte Bilder (![](url)) vor nackten URL-Treffern konsumiert werden.
const BARE_IMAGE_SOURCE =
	/data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+|https:\/\/github\.com\/user-attachments\/assets\/[a-z0-9-]+/gi;

const transformSegment = (segment) =>
	segment
		// HTML-<img> (auch mehrzeilig, mit oder ohne schließenden Slash). Attribute dürfen
		// gequotete Werte mit ">" enthalten (title="a > b"), sonst leakt die src-URL.
		.replace(/<img\b(?:"[^"]*"|'[^']*'|[^>"'])*\/?>/gi, PLACEHOLDER)
		// Markdown-Bilder ![alt](url "title") — data:- und user-attachments-URLs inklusive.
		// Alt-Text mit EINER Klammern-Ebene (CommonMark: balancierte Klammern erlaubt),
		// damit ![alt [x]](url) nicht am ersten ] die Erkennung verliert.
		.replace(/!\[(?:[^\[\]]|\[[^\]]*\])*\]\([^)]*\)/g, PLACEHOLDER)
		// Markdown-LINKS auf Bild-Quellen: [Text](data:...) / [Text](...user-attachments/...),
		// Alt-Text ebenfalls mit einer Klammern-Ebene
		.replace(
			/\[(?:[^\[\]]|\[[^\]]*\])*\]\(\s*(?:data:image\/[^)\s]*|https:\/\/github\.com\/user-attachments\/assets\/[^)\s]*)[^)]*\)/gi,
			PLACEHOLDER,
		)
		// Nackte Quellen (autolinked oder im Fliesstext)
		.replace(BARE_IMAGE_SOURCE, PLACEHOLDER);

// Code-Blöcke (fenced ```/~~~) und Inline-Code bleiben unberührt: Dort stehen Bild-
// Muster als BEISPIEL (z. B. Doku, Test-Fixtures, Prompt-Vorlagen) — Ersetzen wäre
// Datenverlust ohne Datenschutzgewinn, da der Code beim Rendern nicht als Bild dar-
// gestellt wird. Bewusste Entscheidung, siehe strip-images.test.ts.
const CODE_OR_IMAGE = /(```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$)|`[^`\n]*`)/g;

export function stripImages(markdown) {
	if (typeof markdown !== 'string' || markdown === '') return markdown;
	// split mit Capture-Group liefert abwechselnd Nicht-Code (gerade) / Code (ungerade)
	return markdown
		.split(CODE_OR_IMAGE)
		.map((part, i) => (i % 2 === 1 ? part : transformSegment(part)))
		.join('');
}

// ---------------------------------------------------------------------------
// CLI: stdin -> stdout ODER --in-place <file> (gibt changed=0|1 aus, kein Write bei
// unverändertem Inhalt — Grundlage der Sweep-Idempotenz in pr-image-strip.sh).
// ---------------------------------------------------------------------------
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
	const args = process.argv.slice(2);
	if (args[0] === '--in-place') {
		const { readFileSync, writeFileSync } = await import('node:fs');
		const file = args[1];
		const original = readFileSync(file, 'utf8');
		const stripped = stripImages(original);
		if (stripped !== original) {
			writeFileSync(file, stripped);
			console.log('changed=1');
		} else {
			console.log('changed=0');
		}
	} else {
		let input = '';
		process.stdin.setEncoding('utf8');
		for await (const chunk of process.stdin) input += chunk;
		process.stdout.write(stripImages(input));
	}
}

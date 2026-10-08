import type { CareSprache } from './careSuggestionData.js';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import Invoice from '../models/invoice.js';
import { LOGO_PNG_BASE64 } from './invoiceLogo.js';

/**
 * Rechnungs-PDF (#1955) als Brief ({@link buildInvoicePdf}). Die Tests prüfen den Inhalt am echten PDF
 * (Glyph-Helper `pdfContains` in `test/pdf.ts`), pdf-lib selbst kann keinen Text zurücklesen.
 */

/** Betreiberangaben (Spiegel `frontend/src/lib/operator.ts`, serverseitig nötig für den PDF-Kopf). */
export interface InvoiceOperator {
	name: string;
	address: string[];
	email: string;
	ustId: string;
}

/** Empfänger der Rechnung — das User-Modell hat keine Anschrift (B2C-Status quo #1495). */
export interface InvoiceRecipient {
	displayName: string;
	email: string;
}

/** ISO-Datum `JJJJ-MM-TT` (Spec-Vertrag: deterministische Zeitraum-Angabe). */
const isoDate = (date: Date): string => date.toISOString().slice(0, 10);

/** Betrag in Euro mit Komma, z. B. `7,99`. */
const formatEuro = (amountCents: number): string => (amountCents / 100).toFixed(2).replace('.', ',');

/**
 * Vertragsbestätigung auf dem dauerhaften Datenträger (#2329, § 312f Abs. 2 BGB): Paket, Laufzeit,
 * Preis, Zustimmung zum sofortigen Leistungsbeginn mit Kenntnisnahme vom Erlöschen des Widerrufsrechts,
 * Zustimmungsdatum und Link auf /widerruf/. Gemeinsame Quelle für PDF und Mail; die Texte gibt der
 * Autor vor dem Go-live frei.
 */
export const contractConfirmationLines = (
	label: string,
	priceCents: number,
	consentAt: Date,
	sprache: CareSprache = 'de',
): string[] =>
	sprache === 'en'
		? [
				'Contract confirmation',
				`Plan and term: ${label}`,
				`Price: €${(priceCents / 100).toFixed(2)}`,
				`On ${isoDate(consentAt)} you expressly agreed that we start providing the service immediately`,
				'and acknowledged that your right of withdrawal expires as a result.',
				'Withdrawal policy: https://balamentum.modevel.de/en/withdrawal/',
			]
		: [
				'Vertragsbestätigung',
				`Paket und Laufzeit: ${label}`,
				`Preis: ${formatEuro(priceCents)} EUR`,
				`Sie haben am ${isoDate(consentAt)} ausdrücklich zugestimmt, dass wir sofort mit der`,
				'Leistung beginnen, und zur Kenntnis genommen, dass Ihr Widerrufsrecht damit erlischt.',
				'Widerrufsbelehrung: https://balamentum.modevel.de/widerruf/',
			];

/**
 * Unicode-Schrift für Namen in allen App-Sprachen (#2233) — die Standard-Helvetica kann nur WinAnsi.
 * Aufgelöst über das Paket statt über einen Pfad im Quellbaum: `tsc` kopiert keine TTF nach `dist`.
 */
const resolveFont = (file: string): string => createRequire(import.meta.url).resolve(`dejavu-fonts-ttf/ttf/${file}`);
const FONT_PATH = resolveFont('DejaVuSans.ttf');
const FONT_BOLD_PATH = resolveFont('DejaVuSans-Bold.ttf');
let fontBytes: Promise<[Buffer, Buffer]> | undefined;

/** Ersetzt Zeichen ohne Glyphe (z. B. Emoji) durch `?`, statt den PDF-Bau scheitern zu lassen. */
const printable = (text: string, font: fontkit.Font): string =>
	Array.from(text, (char) => (font.hasGlyphForCodePoint(char.codePointAt(0)!) ? char : '?')).join('');

// Seitenmaße (A4) und Layoutraster — Briefaufbau nach der Vorlage: Kopf, Adressfeld, Tabelle, Fußzeile.
const PAGE = { width: 595, height: 842 };
const LEFT = 56;
const RIGHT = PAGE.width - 56;
const GREY = rgb(0.45, 0.45, 0.45);
const BLACK = rgb(0, 0, 0);
const SITE = 'balamentum.modevel.de';
const FOOTER_TOP = 96;
const COLUMNS = { pos: LEFT, label: LEFT + 24, qty: 380, unit: 456, total: RIGHT };

/** Betrag mit Währungszeichen, z. B. `7,99 €`; fremde Währungen behalten ihren Code. */
const money = (amountCents: number, currency: string): string =>
	`${formatEuro(amountCents)} ${currency === 'EUR' ? '€' : currency}`;

/** Positionen der Tabelle: vorhandene `lineItems` (#2142), sonst eine Zeile mit der Leistung. */
const invoiceRows = (invoice: Invoice, service: string): { label: string; amountCents: number }[] =>
	invoice.lineItems?.length
		? invoice.lineItems
		: [{ label: service, amountCents: invoice.get('amountCents') as number }];

/**
 * Zeichnet die Rechnung als Brief (A4, eingebettete Unicode-Schrift): Logo und
 * Absenderblock oben rechts, Empfänger links, Titel mit Datum, Positionstabelle, Gesamtsumme mit
 * §19-Hinweis, Vertragsbestätigung, Fußzeile mit Seitenzahl. Liefert die Bytes, die als Anhang der
 * Rechnungsmail versendet und an der Rechnung gespeichert werden. Die USt-IdNr. erscheint nur bei
 * gesetztem `operator.ustId`; die `confirmation` (#2329) folgt nach dem Steuerhinweis.
 */
export const buildInvoicePdf = async (
	invoice: Invoice,
	operator: InvoiceOperator,
	recipient: InvoiceRecipient,
	service: string,
	confirmation: string[] = [],
): Promise<Uint8Array> => {
	fontBytes ??= Promise.all([readFile(FONT_PATH), readFile(FONT_BOLD_PATH)]);
	const [regularBytes, boldBytes] = await fontBytes;
	const glyphs = fontkit.create(regularBytes);
	const doc = await PDFDocument.create();
	doc.registerFontkit(fontkit);
	const regular = await doc.embedFont(regularBytes, { subset: true });
	const bold = await doc.embedFont(boldBytes, { subset: true });
	const logo = await doc.embedPng(Buffer.from(LOGO_PNG_BASE64, 'base64'));

	const isCredit = invoice.get('creditForInvoiceId') != null;
	const currency = invoice.get('currency') as string;
	const pages: PDFPage[] = [];
	let page = doc.addPage([PAGE.width, PAGE.height]);
	pages.push(page);
	let y = 0;

	const text = (
		value: string,
		x: number,
		at: number,
		opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; right?: boolean } = {},
	): void => {
		const font = opts.font ?? regular;
		const size = opts.size ?? 10;
		const safe = printable(value, glyphs);
		page.drawText(safe, {
			x: opts.right ? x - font.widthOfTextAtSize(safe, size) : x,
			y: at,
			size,
			font,
			color: opts.color ?? BLACK,
		});
	};
	const rule = (at: number, thickness = 0.5): void =>
		page.drawLine({
			start: { x: LEFT, y: at },
			end: { x: RIGHT, y: at },
			thickness,
			color: rgb(0.2, 0.2, 0.2),
		});
	/** Bricht `value` auf `maxWidth`, zeichnet ab `y` und rückt `y` nach unten. */
	const paragraph = (value: string, x: number, maxWidth: number, size = 10, font = regular, lead = 15): void => {
		let line = '';
		for (const word of printable(value, glyphs).split(' ')) {
			const next = line ? `${line} ${word}` : word;
			if (line && font.widthOfTextAtSize(next, size) > maxWidth) {
				ensure(lead);
				text(line, x, y, { size, font });
				y -= lead;
				line = word;
			} else line = next;
		}
		ensure(lead);
		text(line, x, y, { size, font });
		y -= lead;
	};
	/** Wiederholt den Tabellenkopf nach einem Seitenumbruch; nur während der Tabelle gesetzt. */
	let tableHeader: (() => void) | undefined;
	/** Neue Seite, wenn `need` Punkte über der Fußzeile nicht mehr frei sind. */
	const ensure = (need: number): void => {
		if (y - need > FOOTER_TOP) return;
		page = doc.addPage([PAGE.width, PAGE.height]);
		pages.push(page);
		y = PAGE.height - 72;
		tableHeader?.();
	};

	// Kopf: Logo oben rechts, darunter Absenderblock (Name fett, Kontakt grau).
	const logoWidth = 190;
	const logoHeight = (logo.height / logo.width) * logoWidth;
	page.drawImage(logo, {
		x: RIGHT - logoWidth,
		y: PAGE.height - 40 - logoHeight,
		width: logoWidth,
		height: logoHeight,
	});
	let sy = PAGE.height - 40 - logoHeight - 28;
	text(operator.name, 340, sy, { size: 11, font: bold });
	for (const line of operator.address) text(line, 340, (sy -= 16));
	sy -= 10;
	text(operator.email, 340, (sy -= 14), { size: 9, color: GREY });
	text(SITE, 340, (sy -= 14), { size: 9, color: GREY });
	if (operator.ustId) text(`USt-IdNr.: ${operator.ustId}`, 340, sy - 18, { size: 9, color: GREY });

	// Adressfeld links: Absenderzeile klein, darunter der Empfänger.
	text([operator.name, ...operator.address].join(' · '), LEFT, 700, { size: 7, color: GREY });
	text(recipient.displayName, LEFT, 678, { size: 11 });
	text(recipient.email, LEFT, 662, { size: 10, color: GREY });

	// Titel links, Datum rechts.
	text(`${isCredit ? 'Gutschrift' : 'Rechnung'} ${invoice.get('number') as string}`, LEFT, 592, {
		size: 15,
		font: bold,
	});
	text(`${isCredit ? 'Gutschriftdatum' : 'Datum'}: ${isoDate(invoice.createdAt)}`, RIGHT, 592, { right: true });

	// Anrede und Einleitung.
	y = 560;
	paragraph(`Guten Tag${recipient.displayName ? ` ${recipient.displayName}` : ''},`, LEFT, RIGHT - LEFT, 10.5);
	y -= 2;
	paragraph(
		isCredit
			? 'hiermit erhalten Sie die folgende Gutschrift.'
			: 'vielen Dank für Ihre Bestellung. Hiermit stellen wir Ihnen die folgende Leistung in Rechnung.',
		LEFT,
		RIGHT - LEFT,
		10.5,
	);
	y -= 14;

	// Tabelle: fette Kopfzeile, je Position eine Zeile mit Trennlinie.
	const header = (): void => {
		text('Leistungsbeschreibung', COLUMNS.label, y, { font: bold });
		text('Menge', COLUMNS.qty, y, { font: bold, right: true });
		text('Einzelpreis', COLUMNS.unit, y, { font: bold, right: true });
		text('Gesamtpreis', COLUMNS.total, y, { font: bold, right: true });
		rule((y -= 8), 0.8);
		y -= 18;
	};
	header();
	tableHeader = header;
	invoiceRows(invoice, service).forEach((row, index) => {
		ensure(60);
		text(`${index + 1}.`, COLUMNS.pos + 14, y, { right: true });
		const rowTop = y;
		const labelWidth = COLUMNS.qty - 50 - COLUMNS.label;
		paragraph(row.label, COLUMNS.label, labelWidth, 9, bold, 12);
		text('1', COLUMNS.qty, rowTop, { right: true });
		text(money(row.amountCents, currency), COLUMNS.unit, rowTop, { right: true });
		text(money(row.amountCents, currency), COLUMNS.total, rowTop, { right: true });
		rule((y += 3) - 8, 0.3);
		y -= 22;
	});
	tableHeader = undefined;

	// Summe fett; statt MwSt-Zeile der §19-Hinweis.
	ensure(90);
	text('Gesamtsumme:', COLUMNS.unit, y, { font: bold, right: true });
	text(money(invoice.get('amountCents') as number, currency), COLUMNS.total, y, { font: bold, right: true });
	y -= 20;
	paragraph(invoice.get('taxNote') as string, LEFT, RIGHT - LEFT, 8.5, regular, 13);
	y -= 12;
	paragraph(
		`Leistungszeitraum: ${isoDate(invoice.get('periodStart') as Date)} bis ${isoDate(invoice.get('periodEnd') as Date)}.`,
		LEFT,
		RIGHT - LEFT,
		10.5,
	);

	// Vertragsbestätigung (#2329): erste Zeile als Überschrift, Rest als Fließtext.
	if (confirmation.length > 0) {
		y -= 12;
		ensure(40 + confirmation.length * 12);
		paragraph(confirmation[0], LEFT, RIGHT - LEFT, 10, bold);
		for (const line of confirmation.slice(1)) paragraph(line, LEFT, RIGHT - LEFT, 9, regular, 12);
	}

	y -= 18;
	ensure(70);
	paragraph('Mit freundlichen Grüßen', LEFT, RIGHT - LEFT, 10.5);
	y -= 14;
	paragraph(operator.name, LEFT, RIGHT - LEFT, 10.5);

	// Fußzeile je Seite: Logo klein, Kontaktspalten, Seitenzahl.
	pages.forEach((p, index) => {
		page = p;
		rule(FOOTER_TOP - 18);
		const small = 20;
		page.drawImage(logo, {
			x: LEFT,
			y: FOOTER_TOP - 18 + 8,
			width: (small * logo.width) / logo.height,
			height: small,
		});
		text(operator.name, LEFT, FOOTER_TOP - 44, { size: 8 });
		operator.address.forEach((line, i) => text(line, LEFT, FOOTER_TOP - 55 - i * 11, { size: 8 }));
		text(`E-Mail: ${operator.email}`, 280, FOOTER_TOP - 44, { size: 8 });
		text(`Website: ${SITE}`, 280, FOOTER_TOP - 55, { size: 8 });
		text(`Seite ${index + 1} von ${pages.length}`, RIGHT, FOOTER_TOP - 6, { size: 9, right: true });
	});
	return doc.save();
};

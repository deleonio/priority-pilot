import type { CareSprache } from './careSuggestionData.js';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import Invoice from '../models/invoice.js';
import { LOGO_PNG_BASE64, MODEVEL_LOGO_PNG_BASE64 } from './invoiceLogo.js';

/**
 * Rechnungs-PDF (#1955) als Brief im Aufbau der alten modevel.de-Vorlage: modevel-Logo primär im
 * Kopf, die Balamentum-Wortmarke (das Produkt) sekundär darunter. Die Tests prüfen den Inhalt am
 * echten PDF (Glyph-Helper `pdfContains` in `test/pdf.ts`), pdf-lib selbst kann keinen Text zurücklesen.
 */

/** Betreiberangaben (Server-Spiegel `frontend/src/lib/operator.ts`, serverseitig nötig für den PDF-Kopf). */
export interface InvoiceOperator {
	name: string;
	/** Rechtsform — steht auf der Rechnung immer auf eigener Zeile unter dem Firmennamen. */
	legalForm?: string;
	address: string[];
	email: string;
	/** Steuer-Nr. (Pflichtangabe § 14 UStG) — Zeile erscheint nur bei gesetztem Wert. */
	taxNumber?: string;
	ustId: string;
	/** Unterschrift unter der Grußformel — sonst der Firmenname. */
	representative?: string;
}

/** Empfänger der Rechnung: Name der Rechnungsanschrift plus Kundenkonto (E-Mail) als Kennung. */
export interface InvoiceRecipient {
	name: string;
	email: string;
	/** Adresszeilen der Rechnungsanschrift (#2661) — leer, solange keine erfasst ist. */
	addressLines?: string[];
}

/** ISO-Datum `JJJJ-MM-TT` (Spec-Vertrag: deterministische Zeitraum-Angabe). */
const isoDate = (date: Date): string => date.toISOString().slice(0, 10);

const MONATE = [
	'Januar',
	'Februar',
	'März',
	'April',
	'Mai',
	'Juni',
	'Juli',
	'August',
	'September',
	'Oktober',
	'November',
	'Dezember',
];

/** Ortsdatum in deutschem Langformat wie in der Vorlage; UTC-Teile halten Tests deterministisch. */
const germanDate = (date: Date): string =>
	`${date.getUTCDate()}. ${MONATE[date.getUTCMonth()]} ${date.getUTCFullYear()}`;

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

// Seitenmaße (A4) und Layoutraster — Briefaufbau nach der modevel.de-Vorlage: Kopf, Adressfeld, Tabelle, Fußzeile.
const PAGE = { width: 595, height: 842 };
const LEFT = 56;
const RIGHT = PAGE.width - 56;
const GREY = rgb(0.45, 0.45, 0.45);
const LIGHT = rgb(0.78, 0.78, 0.78);
const DARK = rgb(0.2, 0.2, 0.2);
const BLACK = rgb(0, 0, 0);
const SITE = 'balamentum.modevel.de';
const FOOTER_TOP = 96;
const COLUMNS = { pos: LEFT, label: LEFT + 24, qty: 330, me: 378, unit: 448, total: RIGHT };
const SENDER_X = 340;
const TITLE_Y = 538;

/** Betrag mit Währungszeichen, z. B. `7,99 €`; fremde Währungen behalten ihren Code. */
const money = (amountCents: number, currency: string): string =>
	`${formatEuro(amountCents)} ${currency === 'EUR' ? '€' : currency}`;

/** Positionen der Tabelle: vorhandene `lineItems` (#2142), sonst eine Zeile mit der Leistung. */
const invoiceRows = (invoice: Invoice, service: string): { label: string; amountCents: number }[] =>
	invoice.lineItems?.length
		? invoice.lineItems
		: [{ label: service, amountCents: invoice.get('amountCents') as number }];

/**
 * Zeichnet die Rechnung als Brief nach der Vorlage (A4, eingebettete Unicode-Schrift): modevel-Logo
 * oben rechts mit der Balamentum-Wortmarke als Produktlogo darunter, Absenderblock mit
 * Steuerangaben, Empfänger links, Titel mit Ortsdatum, Anschreiben mit Produktbezug, Positionstabelle
 * mit ME-Spalte, Summen mit §19-Hinweis (statt MwSt.-Zeile), PayPal-Zahlungshinweis,
 * Vertragsbestätigung, zweispaltige Fußzeile mit Seitenzahl. Liefert die Bytes, die
 * als Anhang der Rechnungsmail versendet und an der Rechnung gespeichert werden.
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
	const brand = await doc.embedPng(Buffer.from(MODEVEL_LOGO_PNG_BASE64, 'base64'));
	const product = await doc.embedPng(Buffer.from(LOGO_PNG_BASE64, 'base64'));

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
	const rule = (at: number, thickness = 0.5, color = DARK): void =>
		page.drawLine({
			start: { x: LEFT, y: at },
			end: { x: RIGHT, y: at },
			thickness,
			color,
		});
	/** Bricht `value` in Zeilen à `maxWidth` auf (Messung mit `font`). */
	const wrap = (value: string, maxWidth: number, size: number, font: PDFFont): string[] => {
		const lines: string[] = [];
		let line = '';
		for (const word of printable(value, glyphs).split(' ')) {
			const next = line ? `${line} ${word}` : word;
			if (line && font.widthOfTextAtSize(next, size) > maxWidth) {
				lines.push(line);
				line = word;
			} else line = next;
		}
		if (line) lines.push(line);
		return lines;
	};
	/** Bricht `value` auf `maxWidth`, zeichnet ab `y` und rückt `y` nach unten. */
	const paragraph = (value: string, x: number, maxWidth: number, size = 10, font = regular, lead = 15): void => {
		for (const line of wrap(value, maxWidth, size, font)) {
			ensure(lead);
			text(line, x, y, { size, font });
			y -= lead;
		}
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

	// Kopf rechtsbündig: modevel-Logo primär, Balamentum-Wortmarke als Produktlogo sekundär darunter,
	// darunter der Absenderblock rechtsbündig (Firmenname fett, Rechtsform stets auf eigener Zeile).
	const brandWidth = 210;
	const brandHeight = (brand.height / brand.width) * brandWidth;
	page.drawImage(brand, {
		x: RIGHT - brandWidth,
		y: PAGE.height - 36 - brandHeight,
		width: brandWidth,
		height: brandHeight,
	});
	const productWidth = 118;
	const productHeight = (product.height / product.width) * productWidth;
	page.drawImage(product, {
		x: RIGHT - productWidth,
		y: PAGE.height - 36 - brandHeight - 11 - productHeight,
		width: productWidth,
		height: productHeight,
	});
	let sy = PAGE.height - 36 - brandHeight - 11 - productHeight - 20;
	const nameLines = [
		...wrap(operator.name, RIGHT - SENDER_X, 11, bold),
		...(operator.legalForm ? [operator.legalForm] : []),
	];
	for (const line of nameLines) {
		text(line, RIGHT, sy, { size: 11, font: bold, right: true });
		sy -= 16;
	}
	sy -= 6;
	for (const line of operator.address) text(line, RIGHT, (sy -= 15), { right: true });
	sy -= 4;
	text(operator.email, RIGHT, (sy -= 14), { size: 9, color: GREY, right: true });
	text(SITE, RIGHT, (sy -= 14), { size: 9, color: GREY, right: true });
	if (operator.taxNumber) {
		text(`Steuer-Nr.: ${operator.taxNumber}`, RIGHT, (sy -= 14), { size: 9, color: GREY, right: true });
	}
	if (operator.ustId) text(`USt-IdNr.: ${operator.ustId}`, RIGHT, sy - 14, { size: 9, color: GREY, right: true });

	// Adressfeld links: Absenderzeile klein (Name ohne Rechtsform + Anschrift, am Spaltenrand geclippt),
	// darunter die Rechnungsanschrift. Das Kundenkonto (E-Mail) steht im Einleitungssatz.
	let senderLine = printable([operator.name, ...operator.address].join(' · '), glyphs);
	while (senderLine.length > 1 && regular.widthOfTextAtSize(senderLine, 6) > SENDER_X - LEFT - 12) {
		senderLine = senderLine.slice(0, -1).trimEnd();
	}
	text(senderLine, LEFT, 700, { size: 6, color: GREY });
	const addressLines = recipient.addressLines ?? [];
	let ay = 678;
	// Pathologisch lange Zeilen (#2661-Review) werden am rechten Rand geclippt statt überzulaufen.
	for (const raw of addressLines) {
		let line = printable(raw, glyphs);
		while (line.length > 1 && regular.widthOfTextAtSize(line, 10) > RIGHT - LEFT) {
			line = line.slice(0, -1).trimEnd();
		}
		text(line, LEFT, ay, { size: 10 });
		ay -= 14;
	}

	// Titel links, Ortsdatum rechts (Vorlage: „Erfurt, 14. Juli 2014“); Ort = letzte Adresszeile ohne PLZ.
	const place = (operator.address[operator.address.length - 1] ?? '').replace(/^\d+\s*/, '');
	text(`${isCredit ? 'Gutschrift' : 'Rechnung'} ${invoice.get('number') as string}`, LEFT, TITLE_Y, {
		size: 15,
		font: bold,
	});
	text(`${place}, ${germanDate(invoice.createdAt)}`, RIGHT, TITLE_Y, { size: 11, right: true });

	// Anrede und Einleitung mit Produktbezug (Vorlage: „vielen Dank für Ihren Auftrag …“).
	y = TITLE_Y - 32;
	paragraph(`Guten Tag${recipient.name ? ` ${recipient.name}` : ''},`, LEFT, RIGHT - LEFT, 10.5);
	y -= 2;
	paragraph(
		isCredit
			? `hiermit erhalten Sie die folgende Gutschrift für das Kundenkonto ${recipient.email}.`
			: `vielen Dank für Ihren Auftrag. Hiermit stelle ich Ihnen Ihr Balamentum-Abonnement für das Kundenkonto ${recipient.email} in Rechnung.`,
		LEFT,
		RIGHT - LEFT,
		10.5,
	);
	y -= 14;

	// Tabelle: fette Kopfzeile mit ME-Spalte, je Position eine Zeile mit heller Trennlinie.
	const header = (): void => {
		text('Leistungsbeschreibung', COLUMNS.label, y, { font: bold });
		text('Menge', COLUMNS.qty, y, { font: bold, right: true });
		text('ME', COLUMNS.me, y, { font: bold, right: true });
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
		text('Stk.', COLUMNS.me, rowTop, { size: 9, right: true });
		text(money(row.amountCents, currency), COLUMNS.unit, rowTop, { right: true });
		text(money(row.amountCents, currency), COLUMNS.total, rowTop, { right: true });
		rule((y += 3) - 8, 0.3, LIGHT);
		y -= 22;
	});
	tableHeader = undefined;

	// Summen wie in der Vorlage: Zwischensumme, Steuerzeile (§19-Hinweis statt MwSt.), Gesamtsumme fett.
	ensure(110);
	const total = money(invoice.get('amountCents') as number, currency);
	text('Zwischensumme:', COLUMNS.unit, y, { right: true });
	text(total, COLUMNS.total, y, { right: true });
	y -= 16;
	const taxNote = invoice.get('taxNote') as string;
	if (regular.widthOfTextAtSize(printable(taxNote, glyphs), 9) <= RIGHT - COLUMNS.label) {
		text(taxNote, COLUMNS.total, y, { size: 9, right: true });
		y -= 16;
	} else {
		paragraph(taxNote, LEFT, RIGHT - LEFT, 8.5, regular, 13);
		y -= 3;
	}
	text('Gesamtsumme:', COLUMNS.unit, y, { font: bold, right: true });
	text(total, COLUMNS.total, y, { font: bold, right: true });
	y -= 20;
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

	// Zahlungshinweis statt Überweisungs-/Bankblock der Vorlage: PayPal-Zahlung ist bereits erfolgt.
	y -= 14;
	ensure(60);
	paragraph(
		isCredit
			? `Der Betrag von ${money(Math.abs(invoice.get('amountCents') as number), currency)} wurde über PayPal erstattet.`
			: `Der Rechnungsbetrag von ${total} wurde am ${germanDate(invoice.createdAt)} per PayPal beglichen.`,
		LEFT,
		RIGHT - LEFT,
		10.5,
	);

	y -= 14;
	ensure(70);
	paragraph('Mit freundlichen Grüßen', LEFT, RIGHT - LEFT, 10.5);
	y -= 14;
	paragraph(operator.representative ?? operator.name, LEFT, RIGHT - LEFT, 10.5);

	// Fußzeile je Seite, zweispaltig: links Logo mit Firma und Anschrift, rechts Kontakt und Seitenzahl.
	pages.forEach((p, index) => {
		page = p;
		rule(FOOTER_TOP - 18);
		const small = 12;
		page.drawImage(brand, {
			x: LEFT,
			y: FOOTER_TOP - 18 + 6,
			width: (small * brand.width) / brand.height,
			height: small,
		});
		text([operator.name, operator.legalForm].filter(Boolean).join(' '), LEFT, FOOTER_TOP - 44, { size: 8 });
		operator.address.forEach((line, i) => text(line, LEFT, FOOTER_TOP - 55 - i * 11, { size: 8 }));
		text(`E-Mail: ${operator.email}`, SENDER_X, FOOTER_TOP - 44, { size: 8 });
		text(`Website: ${SITE}`, SENDER_X, FOOTER_TOP - 55, { size: 8 });
		text(`Seite ${index + 1} von ${pages.length}`, SENDER_X, FOOTER_TOP - 66, { size: 8 });
	});
	return doc.save();
};

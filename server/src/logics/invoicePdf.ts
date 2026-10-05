import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument } from 'pdf-lib';
import Invoice from '../models/invoice.js';

/**
 * Rechnungs-PDF (#1955). Der Inhalt entsteht als reine Textzeilen ({@link invoicePdfLines}) und
 * wird 1:1 ins PDF gezeichnet ({@link buildInvoicePdf}) — der Test prüft den Inhalt über den
 * Zeilen-Seam, pdf-lib selbst kann keinen Text zurücklesen (Streams sind gezippt).
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
 * Die Textzeilen des Rechnungs-PDFs (AK2): Nummer, Datum, beide Parteien, Leistungsbeschreibung
 * (`service`, z. B. `Paket plus (monthly)`), Leistungszeitraum, Betrag und der `taxNote`
 * (§19 UStG, kein Steuerausweis). Die USt-IdNr.-Zeile erscheint nur bei gesetztem
 * `operator.ustId`.
 */
export const invoicePdfLines = (
	invoice: Invoice,
	operator: InvoiceOperator,
	recipient: InvoiceRecipient,
	service: string,
): string[] => [
	`Rechnung ${invoice.get('number') as string}`,
	`Rechnungsdatum: ${isoDate(invoice.createdAt)}`,
	'',
	'Leistungserbringer:',
	operator.name,
	...operator.address,
	operator.email,
	...(operator.ustId ? [`USt-IdNr.: ${operator.ustId}`] : []),
	'',
	'Rechnungsempfänger:',
	recipient.displayName,
	recipient.email,
	'',
	`Leistung: ${service}`,
	`Leistungszeitraum: ${isoDate(invoice.get('periodStart') as Date)} bis ${isoDate(invoice.get('periodEnd') as Date)}`,
	`Betrag: ${formatEuro(invoice.get('amountCents') as number)} ${invoice.get('currency') as string}`,
	'',
	invoice.get('taxNote') as string,
];

/**
 * Unicode-Schrift für Namen in allen App-Sprachen (#2233) — die Standard-Helvetica kann nur WinAnsi.
 * Aufgelöst über das Paket statt über einen Pfad im Quellbaum: `tsc` kopiert keine TTF nach `dist`.
 */
const FONT_PATH = createRequire(import.meta.url).resolve('dejavu-fonts-ttf/ttf/DejaVuSans.ttf');
let fontBytes: Promise<Buffer> | undefined;

/** Ersetzt Zeichen ohne Glyphe (z. B. Emoji) durch `?`, statt den PDF-Bau scheitern zu lassen. */
const printable = (text: string, font: fontkit.Font): string =>
	Array.from(text, (char) => (font.hasGlyphForCodePoint(char.codePointAt(0)!) ? char : '?')).join('');

/**
 * Zeichnet {@link invoicePdfLines} in ein echtes PDF (A4, eingebettete Unicode-Schrift) und liefert die
 * Bytes — dieselben, die als Anhang der Rechnungsmail versendet und an der Rechnung gespeichert werden.
 */
export const buildInvoicePdf = async (
	invoice: Invoice,
	operator: InvoiceOperator,
	recipient: InvoiceRecipient,
	service: string,
): Promise<Uint8Array> => {
	fontBytes ??= readFile(FONT_PATH);
	const bytes = await fontBytes;
	const glyphs = fontkit.create(bytes);
	const doc = await PDFDocument.create();
	doc.registerFontkit(fontkit);
	const font = await doc.embedFont(bytes, { subset: true });
	const page = doc.addPage([595, 842]);
	const lines = invoicePdfLines(invoice, operator, recipient, service).map((line) => printable(line, glyphs));
	page.drawText(lines.join('\n'), {
		x: 48,
		y: 794,
		size: 11,
		font,
		lineHeight: 16,
	});
	return doc.save();
};

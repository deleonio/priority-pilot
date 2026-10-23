import { LOGO_PNG_BASE64, MODEVEL_LOGO_PNG_BASE64 } from './invoiceLogo.js';
import type { MailAttachment } from './mail.js';
import { OPERATOR } from './operator.js';

/**
 * HTML-Variante für Transaktionsmails — Balamentum-Logo primär im Kopf, modevel-Logo sekundär im
 * Fuß (analog Rechnungskopf). Reiner Renderer ohne I/O; Email-client-sicher: Ein-Spalten-Tabelle
 * (max. 600 px), nur Inline-Styles, Systemfont-Stack, keine externen Ressourcen. Die beiden Logos
 * reisen als CID-Attachments mit; die inhaltlichen Texte liefert der Aufrufer.
 */

export interface MailHtmlRow {
	label: string;
	value: string;
}

export interface MailHtmlButton {
	label: string;
	url: string;
}

export interface MailHtmlInput {
	heading: string;
	intro?: string;
	button?: MailHtmlButton;
	rows?: MailHtmlRow[];
	paragraphs?: string[];
	closing?: string;
	lang: 'de' | 'en';
}

const CID_BALAMENTUM = 'balamentum-logo';
const CID_MODEVEL = 'modevel-logo';

const FONT = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const INK = '#1f2937';
const MUTED = '#6b7280';
const LINE = '#e5e7eb';
const ACCENT = '#1b3a6b';

const escapeHtml = (text: string): string =>
	text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const paragraph = (text: string, style: string): string =>
	`<p style="margin:${style};color:${INK};font-size:14px;line-height:22px;">${escapeHtml(text)}</p>`;

const buttonHtml = ({ label, url }: MailHtmlButton): string =>
	`<div style="margin:0 0 16px;">` +
	`<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr><td style="background-color:${ACCENT};border-radius:6px;">` +
	`<a href="${escapeHtml(url)}" style="display:inline-block;padding:10px 20px;color:#ffffff;font-size:14px;line-height:20px;font-weight:600;text-decoration:none;">${escapeHtml(label)}</a>` +
	`</td></tr></table>\n` +
	`<p style="margin:8px 0 0;color:${MUTED};font-size:12px;line-height:18px;word-break:break-all;"><a href="${escapeHtml(url)}" style="color:${MUTED};">${escapeHtml(url)}</a></p>` +
	`</div>`;

const rowHtml = ({ label, value }: MailHtmlRow): string =>
	`<tr>` +
	`<td style="padding:8px 0;border-top:1px solid ${LINE};color:${MUTED};font-size:14px;vertical-align:top;">${escapeHtml(label)}</td>` +
	`<td style="padding:8px 0;border-top:1px solid ${LINE};color:${INK};font-size:14px;text-align:right;vertical-align:top;">${escapeHtml(value)}</td>` +
	`</tr>`;

export const renderMailHtml = ({
	heading,
	intro,
	button,
	rows,
	paragraphs,
	closing,
	lang,
}: MailHtmlInput): { html: string; attachments: MailAttachment[] } => ({
	html:
		`<!doctype html>\n` +
		`<html lang="${lang}">\n` +
		`<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>\n` +
		`<body style="margin:0;padding:0;background-color:#f4f5f7;">\n` +
		`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f5f7;">\n` +
		`<tr><td align="center" style="padding:24px 12px;">\n` +
		`<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background-color:#ffffff;border-radius:8px;font-family:${FONT};">\n` +
		`<tr><td style="padding:32px 40px 24px;"><img src="cid:${CID_BALAMENTUM}" alt="Balamentum" width="200" style="display:block;width:200px;height:auto;border:0;"></td></tr>\n` +
		`<tr><td style="padding:0 40px 8px;">` +
		`<h1 style="margin:0 0 16px;color:${INK};font-size:20px;line-height:28px;font-weight:600;">${escapeHtml(heading)}</h1>` +
		(intro ? paragraph(intro, '0 0 16px') : '') +
		(button ? buttonHtml(button) : '') +
		(rows?.length
			? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin:0 0 16px;">${rows.map(rowHtml).join('')}</table>`
			: '') +
		(paragraphs ?? []).map((text) => paragraph(text, '0 0 16px')).join('') +
		(closing ? paragraph(closing, '16px 0 0') : '') +
		`</td></tr>\n` +
		`<tr><td style="padding:24px 40px 32px;">\n` +
		`<div style="border-top:1px solid ${LINE};">&nbsp;</div>\n` +
		`<img src="cid:${CID_MODEVEL}" alt="modevel.de — Qualität im Internet" width="110" style="display:block;width:110px;height:auto;border:0;margin-top:16px;">\n` +
		`<p style="margin:12px 0 0;color:${MUTED};font-size:12px;line-height:18px;">${escapeHtml(`${OPERATOR.name} · ${OPERATOR.email} · balamentum.modevel.de`)}</p>\n` +
		`</td></tr>\n` +
		`</table>\n` +
		`</td></tr>\n` +
		`</table>\n` +
		`</body>\n` +
		`</html>\n`,
	attachments: [
		{
			filename: 'balamentum-logo.png',
			contentType: 'image/png',
			content: Buffer.from(LOGO_PNG_BASE64, 'base64'),
		},
		{
			filename: 'modevel-logo.png',
			contentType: 'image/png',
			content: Buffer.from(MODEVEL_LOGO_PNG_BASE64, 'base64'),
		},
	],
});

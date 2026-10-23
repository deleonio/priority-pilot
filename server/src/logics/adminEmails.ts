import { normalize, parseEmails } from './emailParsing.js';

// Admin-Bootstrap (Rollensystem admin/member): Liest die E-Mail-Adressen, die automatisch als
// `admin` gelten, aus der Umgebungsvariable ADMIN_EMAILS.
//
// Format wie die bestehende Allowlist, geparst durch den geteilten Helfer (logics/emailParsing.ts):
// CSV ("a@b.com,c@d.com") oder JSON-Array ('["a@b.com"]'), Vergleich normalisiert (trim + lowercase).
//
// Nur Beförderung, nie automatische Rückstufung (siehe resolveRole in logics/auth.ts) — ein
// nachträglich aus ADMIN_EMAILS entferntes Konto bleibt Admin, bis das explizit über die
// Admin-API geändert wird. Das verhindert versehentliches Aussperren bei ENV-Änderungen.

/** Normalisierte Adressen aus ADMIN_EMAILS (leer, wenn nicht konfiguriert) — auch Empfänger der Betreiber-Mails (#2308). */
export const adminEmails = (): string[] => parseEmails(process.env.ADMIN_EMAILS?.trim() ?? '');

/** Prüft, ob die übergebene E-Mail in ADMIN_EMAILS enthalten ist (false, wenn nicht konfiguriert). */
export const isAdminEmail = (email: string): boolean => {
	const emails = adminEmails();
	if (emails.length === 0) {
		return false;
	}
	return emails.includes(normalize(email));
};

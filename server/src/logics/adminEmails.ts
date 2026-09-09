// Admin-Bootstrap (Rollensystem admin/member): Liest die E-Mail-Adressen, die automatisch als
// `admin` gelten, aus der Umgebungsvariable ADMIN_EMAILS.
//
// Format wie die bestehende Allowlist (siehe logics/allowedEmails.ts): CSV ("a@b.com,c@d.com")
// oder JSON-Array ('["a@b.com"]'), Vergleich normalisiert (trim + lowercase).
//
// Nur Beförderung, nie automatische Rückstufung (siehe resolveRole in logics/auth.ts) — ein
// nachträglich aus ADMIN_EMAILS entferntes Konto bleibt Admin, bis das explizit über die
// Admin-API geändert wird. Das verhindert versehentliches Aussperren bei ENV-Änderungen.

/** Normalisiert eine E-Mail-Adresse für den Vergleich (trim + lowercase). */
const normalize = (email: string): string => email.trim().toLowerCase();

/**
 * Parst den Roh-Wert von ADMIN_EMAILS in eine Liste normalisierter E-Mails.
 * Erkennt automatisch JSON-Array vs. CSV. Leere Einträge werden verworfen.
 */
const parseEmails = (raw: string): string[] => {
	const trimmed = raw.trim();
	if (trimmed === '') {
		return [];
	}

	let parts: string[];
	if (trimmed.startsWith('[')) {
		try {
			const parsed: unknown = JSON.parse(trimmed);
			if (Array.isArray(parsed)) {
				parts = parsed.map((entry) => String(entry));
			} else {
				parts = trimmed.split(',');
			}
		} catch {
			parts = trimmed.split(',');
		}
	} else {
		parts = trimmed.split(',');
	}

	return parts.map(normalize).filter((email) => email !== '');
};

/** Prüft, ob die übergebene E-Mail in ADMIN_EMAILS enthalten ist (false, wenn nicht konfiguriert). */
export const isAdminEmail = (email: string): boolean => {
	const raw = process.env.ADMIN_EMAILS?.trim() ?? '';
	const emails = parseEmails(raw);
	if (emails.length === 0) {
		return false;
	}
	return emails.includes(normalize(email));
};

// Multi-User-Allowlist (Issue #193): Liest die erlaubten E-Mail-Adressen aus der Umgebung.
//
// Konfigurationsquellen (Priorität):
//   1. GOOGLE_ALLOWED_EMAILS (Plural) — CSV ("a@b.com,c@d.com") oder JSON-Array ('["a@b.com"]').
//   2. GOOGLE_ALLOWED_EMAIL  (Singular) — Backward-Compat für eine einzelne Adresse.
//
// Alle Adressen werden normalisiert (trim + lowercase). Der Vergleich in isEmailAllowed()
// erfolgt ebenfalls normalisiert, sodass Groß-/Kleinschreibung und Whitespace ignoriert werden.

/** Normalisiert eine E-Mail-Adresse für den Vergleich (trim + lowercase). */
const normalize = (email: string): string => email.trim().toLowerCase();

/**
 * Parst den Roh-Wert einer Allowlist-Env-Variable in eine Liste normalisierter E-Mails.
 * Erkennt automatisch JSON-Array vs. CSV. Leere Einträge werden verworfen.
 */
const parseEmails = (raw: string): string[] => {
	const trimmed = raw.trim();
	if (trimmed === '') {
		return [];
	}

	let parts: string[];
	if (trimmed.startsWith('[')) {
		// JSON-Array — bei ungültigem JSON fällt der Wert auf CSV zurück.
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

/**
 * Liefert die konfigurierten, normalisierten E-Mail-Adressen.
 * Wirft, wenn keine Allowlist konfiguriert ist (weder Plural noch Singular).
 * Loggt die erlaubten Adressen mit dem Präfix `[auth] Allowed emails:`.
 */
export const getConfiguredEmails = (): string[] => {
	const raw = process.env.GOOGLE_ALLOWED_EMAILS ?? process.env.GOOGLE_ALLOWED_EMAIL ?? '';
	const emails = parseEmails(raw);

	if (emails.length === 0) {
		throw new Error(
			'Keine erlaubten E-Mail-Adressen konfiguriert: GOOGLE_ALLOWED_EMAILS (CSV/JSON) oder GOOGLE_ALLOWED_EMAIL muss gesetzt sein.',
		);
	}

	console.log(`[auth] Allowed emails: ${emails.join(', ')}`);
	return emails;
};

/**
 * Prüft, ob die übergebene E-Mail in der Allowlist enthalten ist.
 * Case-insensitiv und whitespace-tolerant. Liefert false, wenn keine Allowlist
 * konfiguriert ist (statt zu werfen) — so bleibt der Aufruf in der Middleware robust.
 */
export const isEmailAllowed = (email: string): boolean => {
	const raw = process.env.GOOGLE_ALLOWED_EMAILS ?? process.env.GOOGLE_ALLOWED_EMAIL ?? '';
	const emails = parseEmails(raw);
	if (emails.length === 0) {
		return false;
	}
	return emails.includes(normalize(email));
};

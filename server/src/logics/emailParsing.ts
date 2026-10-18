// Geteiltes E-Mail-Parsing (#2693): `normalize` und `parseEmails` sind bewusst nur einmal
// vorhanden und werden von logics/allowedEmails.ts und logics/adminEmails.ts importiert —
// Verhalten und Fehlermeldungen der Verbraucher bleiben unverändert.

/** Normalisiert eine E-Mail-Adresse für den Vergleich (trim + lowercase). */
export const normalize = (email: string): string => email.trim().toLowerCase();

/**
 * Parst den Roh-Wert einer E-Mail-Env-Variable (Allowlist oder ADMIN_EMAILS) in eine Liste
 * normalisierter E-Mails. Erkennt automatisch JSON-Array vs. CSV. Leere Einträge werden verworfen.
 */
export const parseEmails = (raw: string): string[] => {
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

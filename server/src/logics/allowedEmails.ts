// Multi-User-Allowlist (Issue #193): Liest die erlaubten E-Mail-Adressen aus der Umgebung.
//
// Konfigurationsquellen (Priorität):
//   1. GOOGLE_ALLOWED_EMAILS (Plural) — CSV ("a@b.com,c@d.com") oder JSON-Array ('["a@b.com"]').
//   2. GOOGLE_ALLOWED_EMAIL  (Singular) — Backward-Compat für eine einzelne Adresse.
//
// OPEN_SIGNUP=true öffnet die Registrierung: dann darf jede Google-Adresse rein, die Allowlist
// wird nicht mehr geprüft (öffentliche Website, docs/adr/0015-oeffentliche-website-und-app-unter-app.md).
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
 * Maskiert eine E-Mail-Adresse fürs Log: vom Local-Part bleibt nur das erste Zeichen stehen,
 * die Domain bleibt vollständig (`alice@example.com` → `a***@example.com`). Adressen ohne `@`
 * oder mit leerem Local-Part werden komplett zu `***` — lieber unbrauchbar als durchgereicht.
 */
const maskEmail = (email: string): string => {
	const at = email.lastIndexOf('@');
	if (at < 1) {
		return '***';
	}
	return `${email.slice(0, 1)}***${email.slice(at)}`;
};

/** Offene Registrierung (`OPEN_SIGNUP=true|1`), pro Aufruf gelesen, damit Tests umschalten können. */
export const isOpenSignup = (): boolean => {
	const raw = process.env.OPEN_SIGNUP?.trim().toLowerCase();
	return raw === 'true' || raw === '1';
};

/**
 * Liefert die konfigurierten, normalisierten E-Mail-Adressen.
 * Wirft, wenn keine Allowlist konfiguriert ist (weder Plural noch Singular) und die Registrierung
 * nicht per `OPEN_SIGNUP` offen ist.
 * Loggt die erlaubten Adressen maskiert mit dem Präfix `[auth] Allowed emails:` — die
 * Startmeldung zeigt, dass und wie viele Adressen konfiguriert sind, ohne die Zugangs-
 * konfiguration im Klartext in die Logs zu schreiben.
 */
export const getConfiguredEmails = (): string[] => {
	const raw = process.env.GOOGLE_ALLOWED_EMAILS?.trim() || process.env.GOOGLE_ALLOWED_EMAIL?.trim() || '';
	const emails = parseEmails(raw);

	if (emails.length === 0) {
		if (isOpenSignup()) {
			console.log('[auth] Open signup: every Google account may sign in.');
			return [];
		}
		throw new Error(
			'Keine erlaubten E-Mail-Adressen konfiguriert: GOOGLE_ALLOWED_EMAILS (CSV/JSON) oder GOOGLE_ALLOWED_EMAIL muss gesetzt sein.',
		);
	}

	console.log(`[auth] Allowed emails: ${emails.map(maskEmail).join(', ')}`);
	return emails;
};

/**
 * Prüft, ob die übergebene E-Mail in der Allowlist enthalten ist. Bei offener Registrierung
 * (`OPEN_SIGNUP`) ist jede nicht-leere Adresse erlaubt. Case-insensitiv und whitespace-tolerant. Liefert false, wenn keine Allowlist
 * konfiguriert ist (statt zu werfen) — so bleibt der Aufruf in der Middleware robust.
 */
export const isEmailAllowed = (email: string): boolean => {
	if (isOpenSignup()) {
		return normalize(email) !== '';
	}
	const raw = process.env.GOOGLE_ALLOWED_EMAILS?.trim() || process.env.GOOGLE_ALLOWED_EMAIL?.trim() || '';
	const emails = parseEmails(raw);
	if (emails.length === 0) {
		return false;
	}
	return emails.includes(normalize(email));
};

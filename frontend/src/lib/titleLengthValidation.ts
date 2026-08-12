/**
 * Issue #582: Titel-Längenbeschränkung (30 Zeichen)
 * Frontend-Validierung für Titel-Input-Felder.
 */

export const TITLE_MAX_LENGTH = 30;

/**
 * Validiert die Länge eines Titels gegen die 30-Zeichen-Beschränkung.
 * Zählt UTF-16 code units (String.length), wie es Browser nativ tun.
 */
export function validateTitleLength(title: string): { isValid: boolean; remaining: number; error?: string } {
	const length = title.length;
	const remaining = TITLE_MAX_LENGTH - length;

	if (length < 1) {
		return {
			isValid: false,
			remaining: TITLE_MAX_LENGTH,
			error: `Titel muss mindestens 1 Zeichen haben.`,
		};
	}

	if (length > TITLE_MAX_LENGTH) {
		return {
			isValid: false,
			remaining,
			error: `Titel darf maximal ${TITLE_MAX_LENGTH} Zeichen haben.`,
		};
	}

	return {
		isValid: true,
		remaining,
	};
}

/**
 * Gibt den maxLength-Wert für Input-Felder zurück.
 */
export function getTitleMaxLength(): number {
	return TITLE_MAX_LENGTH;
}

/**
 * Gibt den Zeichen-Counter-String zurück (z.B. "15/30").
 */
export function getCharacterCounter(title: string): string {
	return `${title.length}/${TITLE_MAX_LENGTH}`;
}

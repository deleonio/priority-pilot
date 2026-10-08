/**
 * Titel-Längenbeschränkung (65 Zeichen)
 * Frontend-Validierung für Titel-Input-Felder.
 */

import i18next from '../i18n/config';

export const TITLE_MAX_LENGTH = 65;

/**
 * Validiert die Länge eines Titels gegen die 65-Zeichen-Beschränkung.
 * Zählt UTF-16 code units (String.length), wie es Browser nativ tun.
 */
export function validateTitleLength(title: string): { isValid: boolean; remaining: number; error?: string } {
	const length = title.length;
	const remaining = TITLE_MAX_LENGTH - length;

	if (length < 1) {
		return {
			isValid: false,
			remaining: TITLE_MAX_LENGTH,
			error: i18next.t('taskForm:titleLength.tooShort'),
		};
	}

	if (length > TITLE_MAX_LENGTH) {
		return {
			isValid: false,
			remaining,
			error: i18next.t('taskForm:titleLength.tooLong', { max: TITLE_MAX_LENGTH }),
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

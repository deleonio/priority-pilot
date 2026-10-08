/**
 * Beschreibung-Längenbeschränkung (3000 Zeichen)
 * Frontend-Validierung für Beschreibung-Textfelder.
 */

import i18next from '../i18n/config';

export const DESCRIPTION_MAX_LENGTH = 3000;

/**
 * Validiert die Länge einer Beschreibung gegen die 3000-Zeichen-Beschränkung.
 * Die Beschreibung ist optional, ein leerer String ist daher gültig.
 * Zählt UTF-16 code units (String.length), wie es Browser nativ tun.
 */
export function validateDescriptionLength(description: string): {
	isValid: boolean;
	remaining: number;
	error?: string;
} {
	const length = description.length;
	const remaining = DESCRIPTION_MAX_LENGTH - length;

	if (length > DESCRIPTION_MAX_LENGTH) {
		return {
			isValid: false,
			remaining,
			error: i18next.t('taskForm:descriptionLength.tooLong', { max: DESCRIPTION_MAX_LENGTH }),
		};
	}

	return {
		isValid: true,
		remaining,
	};
}

/**
 * Gibt den maxLength-Wert für Textarea-Felder zurück.
 */
export function getDescriptionMaxLength(): number {
	return DESCRIPTION_MAX_LENGTH;
}

/**
 * Gibt den Zeichen-Counter-String zurück (z.B. "15/3000").
 */
export function getCharacterCounter(description: string): string {
	return `${description.length}/${DESCRIPTION_MAX_LENGTH}`;
}

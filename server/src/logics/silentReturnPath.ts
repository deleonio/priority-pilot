/**
 * Return-Path-Durchreichung für den stillen Google-Login (#1231).
 *
 * Der stille Einstieg (`/auth/google/silent?returnTo=…`) nimmt die Route auf, auf der der Nutzer
 * war, als seine Session ablief; der Erfolgs-Callback leitet darauf zurück statt fix auf „/".
 * Der Wert kommt aus der URL und landet in einem Redirect → Open-Redirect-Schutz ist Pflicht:
 * Nur echte, interne Pfade (führender „/", kein „//"-Protokoll-Sprung, kein Backslash — der
 * URL-Parser normalisiert „\" zu „/", „/\evil.example" würde also zu „//evil.example") werden
 * durchgereicht. `null` bedeutet „kein Return-Path" → der Callback bleibt bei „/".
 */
export const sanitizeReturnPath = (raw: unknown): string | null => {
	if (typeof raw !== 'string' || raw === '') {
		return null;
	}
	if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) {
		return null;
	}
	return raw;
};

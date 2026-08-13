import { ResponseError } from 'client';

/** Normalisierte Fehlerinformation aus einem fehlgeschlagenen API-Aufruf. */
interface ApiError {
	/** HTTP-Statuscode, falls der Fehler von einer Server-Antwort stammt; sonst `null`. */
	status: number | null;
	/** Menschenlesbare Fehlermeldung — wenn möglich die `message` aus dem Server-Fehlerobjekt. */
	message: string;
}

/**
 * Wandelt einen vom generierten Client geworfenen Fehler in eine einheitliche Form um.
 *
 * Bei einem `ResponseError` wird versucht, die im API-Vertrag definierte `{ message }` aus dem
 * Antwort-Body zu lesen; ein `409` (Zyklus) oder `400` (Validierung) liefert so die verständliche
 * Server-Meldung. Netzwerk-/sonstige Fehler werden mit ihrer `Error.message` durchgereicht.
 *
 * **KI-spezifische Fehler (#620):** Für LLM-Endpoints (502/503) werden technische
 * Fehlermeldungen in nutzerfreundliche Texte übersetzt, damit Nutzer verstehen, dass der
 * KI-Dienst vorübergehend nicht erreichbar ist.
 */
export const toApiError = async (reason: unknown): Promise<ApiError> => {
	if (reason instanceof ResponseError) {
		const { status } = reason.response;
		let message = `Serverfehler (HTTP ${status}).`;
		try {
			const body: unknown = await reason.response.clone().json();
			if (typeof body === 'object' && body !== null && typeof (body as { message?: unknown }).message === 'string') {
				const serverMessage = (body as { message: string }).message;
				// Für LLM-Dienst-Fehler: nutzerfreundliche Meldung statt technischem Server-Text
				if (status === 502 || status === 503 || status === 504) {
					message = 'Der KI-Dienst ist gerade nicht erreichbar. Bitte versuche es später erneut.';
				} else if (status === 401) {
					message = 'Die KI-Konfiguration ist ungültig. Bitte prüfe die Einstellungen.';
				} else {
					message = serverMessage;
				}
			}
		} catch {
			// Body ist kein JSON oder leer — für wichtige Statuscodes nutzerfreundliche Meldung
			if (status === 502 || status === 503 || status === 504) {
				message = 'Der KI-Dienst ist gerade nicht erreichbar. Bitte versuche es später erneut.';
			} else if (status === 401) {
				message = 'Die KI-Konfiguration ist ungültig. Bitte prüfe die Einstellungen.';
			}
		}
		return { status, message };
	}
	if (reason instanceof Error) {
		// Netzwerkfehler (z.B. abort, fetch failed) → nutzerfreundliche Meldung
		if (reason.name === 'TypeError' && reason.message.includes('fetch')) {
			return { status: null, message: 'Netzwerkfehler. Bitte überprüfe deine Internetverbindung.' };
		}
		if (reason.name === 'AbortError' || reason.message.includes('aborted')) {
			return { status: null, message: 'Die Anfrage wurde abgebrochen. Bitte versuche es erneut.' };
		}
		return { status: null, message: reason.message };
	}
	return { status: null, message: 'Unbekannter Fehler.' };
};

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
 */
export const toApiError = async (reason: unknown): Promise<ApiError> => {
	if (reason instanceof ResponseError) {
		const { status } = reason.response;
		let message = `Serverfehler (HTTP ${status}).`;
		try {
			const body: unknown = await reason.response.clone().json();
			if (typeof body === 'object' && body !== null && typeof (body as { message?: unknown }).message === 'string') {
				message = (body as { message: string }).message;
			}
		} catch {
			// Body ist kein JSON oder leer — die Standardmeldung bleibt bestehen.
		}
		return { status, message };
	}
	if (reason instanceof Error) {
		return { status: null, message: reason.message };
	}
	return { status: null, message: 'Unbekannter Fehler.' };
};

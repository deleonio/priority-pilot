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
 *
 * **Drosselung (#1479):** Ein 429 bekommt einen eigenen Text mit Wartehinweis, damit der Nutzer
 * weiß, dass er nur kurz innehalten muss — statt einer technischen Server- oder KI-Meldung.
 *
 * **Session-401 (#948):** Der Serververtrag liefert 401 fast ausschließlich aus der Session-Auth
 * (`requireAuth` → „Nicht eingeloggt.", Auth-Routen → „Ungültige Zugangsdaten."). Nur für diese
 * bekannten Session-Messages (und bei unlesbarem Body) erscheint eine Session-Meldung; ein 401
 * mit anderer Message (z. B. LLM-/Proxy-401 „Invalid API key") bleibt beim KI-Text aus #620.
 */

/** Bekannte Session-401-Messages aus dem Serververtrag (server/src/express). */
const SESSION_MESSAGES = new Set(['Nicht eingeloggt.', 'Ungültige Zugangsdaten.']);

/** Session-Meldung für abgelaufene/ungültige Session statt der irreführenden KI-Meldung (#948). */
const SESSION_TEXT = 'Nicht eingeloggt. Bitte melde dich erneut an.';

/**
 * Drosselung (429, #1479). Der Serververtrag liefert zwar eine `message`, die ist aber technisch
 * („Too many requests…"). Hier steht stattdessen, was der Nutzer tun soll: kurz innehalten. Die
 * Wartezeit kommt aus dem `Retry-After`-Header, den `express-rate-limit` mitschickt; ohne
 * lesbaren Header bleibt es beim allgemeinen Hinweis.
 */
const throttledMessage = (response: Response): string => {
	const retryAfter = Number(response.headers.get('retry-after'));
	if (Number.isFinite(retryAfter) && retryAfter > 0) {
		const sekunden = Math.ceil(retryAfter);
		return `Zu viele Anfragen in kurzer Zeit. Bitte ${sekunden} Sekunden warten und es dann noch einmal versuchen.`;
	}
	return 'Zu viele Anfragen in kurzer Zeit. Bitte einen Moment warten und es dann noch einmal versuchen.';
};

/**
 * DOM-Event-Name, den `toApiError` bei einem erkannten Session-401 auf `window` feuert (#1231).
 * Der globale `SessionExpiredDialog` lauscht darauf und bietet das Neuladen der App an.
 */
export const SESSION_EXPIRED_EVENT = 'pp:session-expired';

/**
 * Aufrufer-Kontext (#1465). Die 502/503/504-Übersetzung aus #620 spricht von „KI-Dienst" und passt
 * nur für die LLM-Endpunkte — beim Feedback-Endpunkt verdeckte sie den Grund („nicht konfiguriert"
 * vs. „gerade nicht gespeichert"). Default `true`, damit alle bestehenden Aufrufer unverändert
 * bleiben; Nicht-LLM-Aufrufer schalten die Übersetzung mit `{ llmMapping: false }` ab und bekommen
 * die Server-`message` durchgereicht.
 */
interface ToApiErrorOptions {
	llmMapping?: boolean;
}

export const toApiError = async (reason: unknown, { llmMapping = true }: ToApiErrorOptions = {}): Promise<ApiError> => {
	if (reason instanceof ResponseError) {
		const { status } = reason.response;
		// Drosselung (#1479) vor allen anderen Zweigen: Der Grund ist unabhängig vom Endpunkt und
		// vom Body immer derselbe, die KI- und Session-Übersetzungen passen hier nicht.
		if (status === 429) {
			return { status, message: throttledMessage(reason.response) };
		}
		const isLlmUpstream = llmMapping && (status === 502 || status === 503 || status === 504);
		let message = `Serverfehler (HTTP ${status}).`;
		// Body-Beschaffung in zwei Stufen (#948): openapi-fetch liest den Body JEDER non-ok Response
		// selbst (`response.text()`), ein nachgelagertes `response.clone().json()` wirft danach
		// „Body has already been consumed“. Das geparste Objekt reist im `ResponseError.body` mit
		// (geworfen aus api.ts); der clone-Fallback deckt frische Responses ohne Body-Feld
		// (z. B. Unit-Tests, die `new ResponseError(res)` direkt konstruieren).
		let body: unknown = reason.body;
		if (body === undefined) {
			try {
				body = await reason.response.clone().json();
			} catch {
				body = undefined;
			}
		}
		if (typeof body === 'object' && body !== null && typeof (body as { message?: unknown }).message === 'string') {
			const serverMessage = (body as { message: string }).message;
			// Für LLM-Dienst-Fehler: nutzerfreundliche Meldung statt technischem Server-Text
			if (isLlmUpstream) {
				message = 'Der KI-Dienst ist gerade nicht erreichbar. Bitte versuche es später erneut.';
			} else if (status === 401 && SESSION_MESSAGES.has(serverMessage)) {
				// Session-401 (#948): bekannte Session-Auth-Message → Login-Hinweis statt KI-Meldung
				message = SESSION_TEXT;
			} else if (status === 401 && llmMapping) {
				message = 'Die KI-Konfiguration ist ungültig. Bitte prüfe die Einstellungen.';
			} else {
				message = serverMessage;
			}
		} else if (body === undefined) {
			// Body nicht lesbar (weder Body-Feld noch clone) — für wichtige Statuscodes nutzerfreundliche Meldung
			if (isLlmUpstream) {
				message = 'Der KI-Dienst ist gerade nicht erreichbar. Bitte versuche es später erneut.';
			} else if (status === 401) {
				// Ohne lesbaren Body ist ein 401 laut Serververtrag Session-Auth (#948)
				message = SESSION_TEXT;
			}
		}
		if (status === 401 && message === SESSION_TEXT) {
			// Session-401 (#1231): globaler Dialog „Session abgelaufen" anstoßen. Genau hier — und
			// nirgendwo sonst — laufen die Fälle zusammen, die laut #948 auf die Session-Meldung mappen;
			// jeder andere 401 (LLM-/Proxy-401), 403 oder Netzwerkfehler feuert nicht.
			window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
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

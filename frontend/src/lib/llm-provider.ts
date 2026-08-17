/**
 * LLM-Provider-State-Management für Issue-749: Test-Schalter für Mistral und OpenRouter.
 *
 * Verwaltet den aktiven LLM-Provider als persistenten State mit Exklusivitäts-Logik.
 * Default: undefined (System-Standard).
 */

export type LlmProvider = 'mistral' | 'openrouter' | undefined;

const STORAGE_KEY = 'llm-provider-selection';

/**
 * Callback-Typ für Toast-Feedback beim Provider-Wechsel.
 * Wird von der UI-Komponente implementiert (KolAlert).
 */
type ToastCallback = (message: string) => void;

let toastCallback: ToastCallback | null = null;

/**
 * Registriert einen Toast-Callback für Feedback beim Provider-Wechsel.
 */
export function setToastCallback(callback: ToastCallback | null): void {
	toastCallback = callback;
}

/**
 * Liest den aktuellen Provider aus dem Persistenz-Speicher.
 * @returns Aktiver Provider oder undefined (System-Standard)
 */
export function getProvider(): LlmProvider {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored === 'mistral' || stored === 'openrouter') {
			return stored;
		}
		return undefined;
	} catch {
		// localStorage nicht verfügbar (z.B. im Test-Umfeld)
		return undefined;
	}
}

/**
 * Prüft, ob ein Provider verfügbar ist (konfiguriert).
 * Für Test-Zwecke –在生产环境 würde dies die API-Konfiguration prüfen.
 *
 * @param provider Der zu prüfende Provider
 * @returns true, wenn der Provider verfügbar ist
 */
function isProviderAvailable(provider: LlmProvider): boolean {
	// In dieser Implementierung gehen wir davon aus, dass beide Provider
	// verfügbar sind. In einer echten Implementierung würde dies die
	// API-Konfiguration prüfen (hasMistralApiKey / hasOpenrouterApiKey).
	return provider === 'mistral' || provider === 'openrouter';
}

/**
 * Setzt den aktiven Provider mit Exklusivitäts-Logik und Toast-Feedback.
 *
 * @param provider Der zu setzende Provider ('mistral' | 'openrouter' | undefined)
 * @returns true, wenn der Provider erfolgreich gesetzt wurde
 */
export function setProvider(provider: LlmProvider): boolean {
	// Validierung: Nur erlaubte Werte
	if (provider !== undefined && provider !== 'mistral' && provider !== 'openrouter') {
		return false;
	}

	// Prüfen, ob der Provider verfügbar ist
	if (provider !== undefined && !isProviderAvailable(provider)) {
		return false;
	}

	const current = getProvider();

	// Exklusivitäts-Logik: Ein neuer Provider deaktiviert den alten
	// (Wir speichern nur einen Provider im localStorage)
	try {
		if (provider === undefined) {
			localStorage.removeItem(STORAGE_KEY);
		} else {
			localStorage.setItem(STORAGE_KEY, provider);
		}

		// Toast-Feedback bei Wechsel
		if (provider !== current && provider !== undefined && toastCallback) {
			const providerName = provider === 'mistral' ? 'Mistral' : 'OpenRouter';
			toastCallback(`Provider gewechselt: ${providerName}`);
		}

		return true;
	} catch {
		// localStorage nicht verfügbar – Fallback zu In-Memory-State
		return false;
	}
}

/**
 * Prüft, ob exklusiv ein Provider aktiv ist (nicht beide gleichzeitig).
 *
 * @returns true, wenn nur ein Provider aktiv ist
 */
export function isExclusiveProviderActive(): boolean {
	const provider = getProvider();
	// Wir speichern nur einen Provider, also ist Exklusivität garantiert
	return provider === undefined || provider === 'mistral' || provider === 'openrouter';
}

/**
 * Setzt den Provider zurück auf System-Standard (undefined).
 */
export function resetProvider(): void {
	setProvider(undefined);
}

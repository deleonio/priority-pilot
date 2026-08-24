/**
 * LLM-Provider-State-Management: Test-Schalter (#749) und dynamische Provider (#951).
 *
 * Verwaltet den gepinnten LLM-Provider als persistenten State. Seit #951 ist der
 * Provider ein **Objekt** (id, name, endpoint, model) aus `GET /llm-providers` —
 * die festen Strings 'mistral' | 'openrouter' sind Legacy (bereinigt beim Lesen).
 * Default: undefined (System-Standard = der serverseitig aktive Provider).
 */

/** Ein dynamischer LLM-Provider aus `GET /llm-providers` (#951) — ohne API-Key (Write-Only). */
export interface ActiveLlmProvider {
	id: number;
	name: string;
	endpoint: string;
	model: string;
}

/** Legacy-Werte aus Zeiten des festen Test-Schalters (#749) — werden beim Lesen verworfen. */
const LEGACY_PROVIDER_VALUES = new Set(['mistral', 'openrouter']);

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

/** Validiert die Objektform eines dynamischen Providers (id/name Pflicht, sinnvolle Typen). */
const isDynamicProvider = (value: unknown): value is ActiveLlmProvider =>
	typeof value === 'object' &&
	value !== null &&
	typeof (value as ActiveLlmProvider).id === 'number' &&
	typeof (value as ActiveLlmProvider).name === 'string' &&
	(value as ActiveLlmProvider).name.length > 0;

/**
 * Liest den aktuellen Provider aus dem Persistenz-Speicher.
 * @returns Aktiver Provider oder undefined (System-Standard)
 */
export function getProvider(): ActiveLlmProvider | undefined {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored === null) {
			return undefined;
		}
		try {
			const parsed: unknown = JSON.parse(stored);
			if (isDynamicProvider(parsed)) {
				return parsed;
			}
		} catch {
			// Kein JSON (Legacy-String aus #749) — verfällt unten der Bereinigung.
		}
		// Legacy-Bestand (feste Strings) ist mit dem dynamischen System (#951) bedeutungslos:
		// einmalig entfernen, damit der Speicher nie einen halbgültigen Zustand hält.
		if (LEGACY_PROVIDER_VALUES.has(stored)) {
			localStorage.removeItem(STORAGE_KEY);
		}
		return undefined;
	} catch {
		// localStorage nicht verfügbar (z.B. im Test-Umfeld)
		return undefined;
	}
}

/**
 * Setzt den gepinnten Provider (Single-Auswahl, Toast-Feedback beim Wechsel).
 *
 * @param provider Der zu setzende Provider (undefined = System-Standard)
 * @returns true, wenn der Provider erfolgreich gesetzt wurde
 */
export function setProvider(provider: ActiveLlmProvider | undefined): boolean {
	if (provider !== undefined && !isDynamicProvider(provider)) {
		return false;
	}

	const current = getProvider();

	try {
		if (provider === undefined) {
			localStorage.removeItem(STORAGE_KEY);
		} else {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(provider));
		}

		// Toast-Feedback bei Wechsel
		if (provider !== undefined && provider.name !== current?.name && toastCallback) {
			toastCallback(`Provider gewechselt: ${provider.name}`);
		}

		return true;
	} catch {
		// localStorage nicht verfügbar – Fallback zu In-Memory-State
		return false;
	}
}

/**
 * Prüft, ob höchstens ein Provider gepinnt ist (immer true — Single-Auswahl per Konstruktion).
 */
export function isExclusiveProviderActive(): boolean {
	return true;
}

/**
 * Setzt den Provider zurück auf System-Standard (undefined).
 */
export function resetProvider(): void {
	setProvider(undefined);
}

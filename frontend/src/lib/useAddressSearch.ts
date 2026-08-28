import { useEffect, useRef, useState } from 'react';
import { api } from '../api';

/** Debounce, bevor eine Adresssuche ausgelöst wird — schont das Nominatim-Rate-Limit (1 req/s). */
const DEBOUNCE_MS = 400;

/** Suchtext muss mindestens so lang sein, bevor eine Anfrage rausgeht (vermeidet Rauschen bei 1–2 Zeichen). */
const MIN_QUERY_LENGTH = 3;

/** Adress-Vorschlag mit den Koordinaten des Treffers (#1066 AK1): die Auswahl übernimmt lat/lon. */
export interface AddressSuggestion {
	address: string;
	lat: number;
	lon: number;
}

interface UseAddressSearchResult {
	/** Adress-Vorschläge zum aktuellen Suchtext (leer, solange nichts passendes gefunden/gesucht wurde). */
	suggestions: AddressSuggestion[];
	/** Ob gerade eine Suche läuft. */
	loading: boolean;
}

/**
 * Debounced Adresssuche (Forward Geocoding) für die Ortsauswahl im Task-Formular. Sucht erst ab
 * `MIN_QUERY_LENGTH` Zeichen und bricht eine noch laufende Anfrage ab, sobald sich der Suchtext
 * ändert (kein Flackern durch spät eintreffende Antworten auf einen bereits überholten Text).
 */
export const useAddressSearch = (query: string): UseAddressSearchResult => {
	const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
	const [loading, setLoading] = useState(false);
	const abortRef = useRef<AbortController | null>(null);

	useEffect(() => {
		const trimmed = query.trim();
		abortRef.current?.abort();

		if (trimmed.length < MIN_QUERY_LENGTH) {
			setSuggestions([]);
			setLoading(false);
			return;
		}

		let controller: AbortController | undefined;
		const timer = window.setTimeout(() => {
			const current = new AbortController();
			controller = current;
			abortRef.current = current;
			setLoading(true);
			api
				.geocodeSearch({ q: trimmed, signal: current.signal })
				.then((results) => {
					if (!current.signal.aborted) {
						// #1066 AK1: Koordinaten mitführen — vormals warf `map(entry => entry.address)`
						// die Koordinaten weg und die Auswahl konnte lat/lon nicht übernehmen.
						setSuggestions(results.map((entry) => ({ address: entry.address, lat: entry.lat, lon: entry.lon })));
					}
				})
				.catch(() => {
					if (!current.signal.aborted) {
						setSuggestions([]);
					}
				})
				.finally(() => {
					if (!current.signal.aborted) {
						setLoading(false);
					}
				});
		}, DEBOUNCE_MS);

		// Timer entsorgen UND eine bereits gestartete Anfrage abbrechen — sonst läuft sie beim
		// Unmount (Formular geschlossen) bis zum 5-s-Server-Timeout weiter und setzt State ins Nichts.
		return () => {
			window.clearTimeout(timer);
			controller?.abort();
		};
	}, [query]);

	return { suggestions, loading };
};

import { useEffect, useRef, useState } from 'react';
import { api } from '../api';

/** Debounce, bevor eine Adresssuche ausgelöst wird — schont das Nominatim-Rate-Limit (1 req/s). */
const DEBOUNCE_MS = 400;

/** Suchtext muss mindestens so lang sein, bevor eine Anfrage rausgeht (vermeidet Rauschen bei 1–2 Zeichen). */
const MIN_QUERY_LENGTH = 3;

interface UseAddressSearchResult {
	/** Adress-Vorschläge zum aktuellen Suchtext (leer, solange nichts passendes gefunden/gesucht wurde). */
	suggestions: string[];
	/** Ob gerade eine Suche läuft. */
	loading: boolean;
}

/**
 * Debounced Adresssuche (Forward Geocoding) für die Ortsauswahl im Task-Formular. Sucht erst ab
 * `MIN_QUERY_LENGTH` Zeichen und bricht eine noch laufende Anfrage ab, sobald sich der Suchtext
 * ändert (kein Flackern durch spät eintreffende Antworten auf einen bereits überholten Text).
 */
export const useAddressSearch = (query: string): UseAddressSearchResult => {
	const [suggestions, setSuggestions] = useState<string[]>([]);
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

		const timer = window.setTimeout(() => {
			const controller = new AbortController();
			abortRef.current = controller;
			setLoading(true);
			api
				.geocodeSearch({ q: trimmed, signal: controller.signal })
				.then((results) => setSuggestions(results.map((entry) => entry.address)))
				.catch(() => {
					if (!controller.signal.aborted) {
						setSuggestions([]);
					}
				})
				.finally(() => {
					if (!controller.signal.aborted) {
						setLoading(false);
					}
				});
		}, DEBOUNCE_MS);

		return () => {
			window.clearTimeout(timer);
		};
	}, [query]);

	return { suggestions, loading };
};

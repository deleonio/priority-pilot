import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import { useAddressSearch } from './useAddressSearch';

/**
 * Tests für useAddressSearch (Adresssuche/Forward Geocoding, PR #1061) — der Hook trägt die
 * zugesagten Kerneigenschaften „min. 3 Zeichen, 400 ms Debounce, Abbruch überholter Anfragen",
 * die das Nominatim-Rate-Limit (1 req/s) schützen. Ohne diese Tests bliebe ein Wegfall von
 * Debounce/Mindestlänge in der gesamten Suite grün (Review-Finding F1).
 *
 * Testebene: Vitest-Hook-Test mit gemockter API (kein Netzwerk) und Fake-Timern für den Debounce.
 */

vi.mock('../api', () => ({
	api: {
		geocodeSearch: vi.fn(),
	},
}));

const geocodeSearchMock = vi.mocked(api.geocodeSearch);

/** Manuell auflösbare Promise — für Anfragen, die „im Netz" hängen bleiben sollen. */
function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((res) => {
		resolve = res;
	});
	return { promise, resolve };
}

/** Ergebnisform von `api.geocodeSearch` (nur die für den Hook relevanten Felder). */
type Suggestion = { address: string; lat: number; lon: number };

const results = (addresses: string[]): Suggestion[] =>
	addresses.map((address) => ({ address, lat: 52.52, lon: 13.405 }));

describe('useAddressSearch – Debounce, Mindestlänge, Überholschutz', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('Mindestlänge: unter 3 Zeichen geht keine Anfrage raus', () => {
		const { result, rerender } = renderHook((q: string) => useAddressSearch(q), { initialProps: '' });

		rerender('ab');
		act(() => {
			vi.advanceTimersByTime(400);
		});

		expect(geocodeSearchMock).not.toHaveBeenCalled();
		expect(result.current.suggestions).toEqual([]);
	});

	it('Debounce: schnelle Eingaben führen zu genau einer Anfrage mit dem letzten Text', () => {
		geocodeSearchMock.mockResolvedValue([]);
		const { rerender } = renderHook((q: string) => useAddressSearch(q), { initialProps: '' });

		rerender('Mus');
		act(() => {
			vi.advanceTimersByTime(200); // weniger als der Debounce — Timer wird verworfen
		});
		rerender('Muster');
		act(() => {
			vi.advanceTimersByTime(400);
		});

		expect(geocodeSearchMock).toHaveBeenCalledTimes(1);
		expect(geocodeSearchMock).toHaveBeenCalledWith({ q: 'Muster', signal: expect.any(AbortSignal) });
	});

	it('Überholschutz: Anfrage wird bei Textwechsel abgebrochen, späte Antwort verworfen', async () => {
		const first = deferred<Suggestion[]>();
		const second = deferred<Suggestion[]>();
		geocodeSearchMock.mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise);

		const { result, rerender } = renderHook((q: string) => useAddressSearch(q), { initialProps: '' });

		rerender('Must');
		act(() => {
			vi.advanceTimersByTime(400); // erste Anfrage startet
		});
		const firstSignal = geocodeSearchMock.mock.calls[0]?.[0]?.signal;

		rerender('Muster');
		act(() => {
			vi.advanceTimersByTime(400); // zweite Anfrage startet, erste wird abgebrochen
		});
		expect(firstSignal?.aborted).toBe(true);

		// Spät eintreffende Antwort der überholten Anfrage darf suggestions NICHT überschreiben …
		await act(async () => {
			first.resolve(results(['Alt']));
			await Promise.resolve();
		});
		expect(result.current.suggestions).toEqual([]);

		// … die Antwort der aktuellen Anfrage schon. (#1066 AK1: Vorschläge sind Objekte mit lat/lon —
		// alte String-Erwartung Test-pflegebedürftig geändert, siehe PR-Body „Test-Pflege-Bedarf".)
		await act(async () => {
			second.resolve(results(['Neu']));
			await Promise.resolve();
		});
		expect(result.current.suggestions).toEqual(results(['Neu']));
	});

	it('Unmount: laufende Anfrage wird abgebrochen statt bis zum Timeout weiterzulaufen', () => {
		geocodeSearchMock.mockImplementation(() => new Promise(() => {})); // löst nie auf
		const { rerender, unmount } = renderHook((q: string) => useAddressSearch(q), { initialProps: '' });

		rerender('Muster');
		act(() => {
			vi.advanceTimersByTime(400);
		});
		const signal = geocodeSearchMock.mock.calls[0]?.[0]?.signal;
		expect(signal?.aborted).toBe(false);

		unmount();
		expect(signal?.aborted).toBe(true);
	});
});

// Rote Spec-Tests für #1066 (AK1, Spec docs/spec/issue-1066.md): Vorschläge tragen die
// Koordinaten des Treffers, damit die Auswahl im TaskForm lat/lon übernehmen kann. Heute wirft
// der Hook die Koordinaten weg (`results.map((entry) => entry.address)`) — genau der Defekt des
// Tickets. KEIN Produktivcode.
describe('useAddressSearch – Vorschläge tragen lat/lon (#1066, AK1)', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('jeder Vorschlag ist { address, lat, lon } — die Koordinate geht bei der Auswahl nicht verloren', async () => {
		geocodeSearchMock.mockResolvedValue([
			{ address: 'Alexanderplatz, Berlin', lat: 52.5219, lon: 13.4132 },
			{ address: 'Hauptbahnhof, Berlin', lat: 52.5251, lon: 13.3694 },
		]);
		const { result, rerender } = renderHook((q: string) => useAddressSearch(q), { initialProps: '' });

		rerender('Alexanderplatz');
		await act(async () => {
			vi.advanceTimersByTime(400);
			await Promise.resolve();
		});

		expect(result.current.suggestions).toEqual([
			{ address: 'Alexanderplatz, Berlin', lat: 52.5219, lon: 13.4132 },
			{ address: 'Hauptbahnhof, Berlin', lat: 52.5251, lon: 13.3694 },
		]);
	});
});

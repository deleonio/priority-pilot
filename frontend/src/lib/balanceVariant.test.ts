import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BALANCE_VARIANTS, readBalanceVariant, storeBalanceVariant, useBalanceVariant } from './balanceVariant';

/**
 * Persistenz der Bildwahl. Geprüft wird vor allem der Weg, der schiefgehen kann: Was passiert bei
 * einem Wert, den diese Version nicht kennt? Der Schlüssel überlebt Updates und Hand-Edits im
 * Browser — ein unbekannter Wert darf nicht in ein leeres Dashboard münden, sondern muss auf den
 * Default zurückfallen. Muster wie `animations.test.ts`.
 */
describe('balanceVariant', () => {
	beforeEach(() => {
		localStorage.clear();
		vi.restoreAllMocks();
	});

	it('zeigt ohne gespeicherte Wahl die Blüte', () => {
		expect(readBalanceVariant()).toBe('bluete');
	});

	it('liest jede Variante zurück, die sie geschrieben hat', () => {
		for (const { value } of BALANCE_VARIANTS) {
			storeBalanceVariant(value);
			expect(readBalanceVariant()).toBe(value);
		}
	});

	it('fällt bei einem unbekannten oder entfernten gespeicherten Wert auf die Blüte zurück', () => {
		localStorage.setItem('pp-balance-variant', 'herz');

		expect(readBalanceVariant()).toBe('bluete');
	});

	it('übersteht einen gesperrten localStorage in beide Richtungen', () => {
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new Error('SecurityError');
		});
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('QuotaExceededError');
		});

		expect(readBalanceVariant()).toBe('bluete');
		expect(() => storeBalanceVariant('zeiger')).not.toThrow();
	});

	it('AK4 — zieht die serverseitige Wahl beim Laden nach und überschreibt den Spiegel', async () => {
		// GET /balance-variant liefert die Konto-Wahl — sie gilt auch, wenn das Gerät etwas anderes (oder nichts) gespeichert hat.
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response(JSON.stringify({ variant: 'kristall' }), { status: 200 })),
		);

		const { result } = renderHook(() => useBalanceVariant());
		await waitFor(() => expect(result.current.variant).toBe('kristall'), {
			timeout: 2000,
		});
		// Der Spiegel folgt dem Konto, damit der nächste Erst-Paint schon richtig startet.
		expect(readBalanceVariant()).toBe('kristall');
	});

	it('AK4 — setVariant sendet die Wahl per PUT und übersteht einen unerreichbaren Server (Best-Effort)', async () => {
		const fetchMock = vi.fn(() => Promise.reject(new TypeError('fetch failed')));
		vi.stubGlobal('fetch', fetchMock);

		const { result } = renderHook(() => useBalanceVariant());
		expect(() => act(() => result.current.setVariant('zeiger'))).not.toThrow();

		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1), {
			timeout: 2000,
		});
		// Der Mount-GET kann zuerst feuern — den PUT gezielt über die Methode wählen, nicht über den Index.
		const putCall = fetchMock.mock.calls.find(
			(call) => (call as unknown as [string, RequestInit])[1]?.method === 'PUT',
		);
		expect(putCall, 'PUT-Call unter den Fetch-Aufrufen').toBeDefined();
		const [url, init] = putCall as unknown as [string, RequestInit];
		expect(String(url)).toContain('/balance-variant');
		expect(init.method).toBe('PUT');
		expect(JSON.parse(String(init.body))).toEqual({ variant: 'zeiger' });

		// Best-Effort: trotz gescheitertem PUT bleibt die Wahl aktiv (State + Spiegel).
		expect(result.current.variant).toBe('zeiger');
		expect(readBalanceVariant()).toBe('zeiger');
	});

	it('führt die Varianten in fester Reihenfolge', () => {
		expect(BALANCE_VARIANTS.map((variant) => variant.value)).toEqual(['strahlen', 'bluete', 'kristall', 'zeiger']);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});
});

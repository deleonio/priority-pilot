import { act, renderHook } from '@testing-library/react';
import type { OwnReassignPillarsStatus } from 'client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useReassignRun } from './useReassignRun';

/**
 * Rote Spec-Tests für #1642 — „Säulen-Neuberechnung als Server-Hintergrundlauf statt
 * Client-getriebener Schleife" (docs/spec/issue-1642.md, AK6).
 *
 * Bisher (#1614/#1628) trieb `useReassignRun.start()` eine Client-Schleife: `runPortion` wurde
 * wiederholt aufgerufen, bis `remaining === 0`. Ab #1642 läuft die Neuberechnung serverseitig im
 * Hintergrund weiter — der Hook darf `runPortion` nur noch EINMAL aufrufen (den Start) und danach
 * ausschließlich über `loadStatus` pollen, bis der Lauf laut `running: false` beendet ist. Außerdem
 * muss ein bereits laufender Hintergrundlauf beim Mount ohne Klick erkannt und weiterverfolgt
 * werden (Wiedereinstieg ins Modal/die Admin-Seite, AK7).
 */

/** Erweitert den heutigen Status-DTO um die #1642-Felder — bis sie existieren, wirft ein Zugriff nicht, `running` bleibt einfach `undefined`. */
type BackgroundStatus = OwnReassignPillarsStatus & {
	running?: boolean;
	processed?: number;
	result?: { updated: number; failed: number; skipped: number; quotaExhausted?: boolean };
};

const idleStatus = (): BackgroundStatus => ({ startedAt: null, total: 0, pending: 0 });

describe('useReassignRun – Hintergrundlauf statt Client-Portionsschleife (#1642)', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('AK6: start() ruft runPortion nur einmal auf — keine Client-Portionsschleife mehr', async () => {
		const runPortion = vi
			.fn()
			// Unter dem BISHERIGEN Vertrag hieße `remaining > 0` mit `updated > 0` (etwas wurde
			// verarbeitet) „nächste Portion holen" — der Hook darf das ab #1642 nicht mehr tun, weil
			// der Server selbst bis zum Ende weiterläuft. Der zweite Rückgabewert (`remaining: 0`)
			// begrenzt die BISHERIGE Schleife bewusst auf zwei Aufrufe, damit ein noch nicht
			// umgestellter Hook hier sauber mit einem falschen Zählerstand rot wird, statt endlos
			// weiterzuportionieren.
			.mockResolvedValueOnce({ updated: 1, failed: 0, skipped: 0, remaining: 5, quotaExhausted: false })
			.mockResolvedValueOnce({ updated: 1, failed: 0, skipped: 0, remaining: 0, quotaExhausted: false });
		const loadStatus = vi.fn<() => Promise<BackgroundStatus>>().mockResolvedValue(idleStatus());

		const { result } = renderHook(() => useReassignRun({ runPortion, loadStatus }));

		await act(async () => {
			await result.current.start(false);
		});
		// Etwaiges Polling nach dem Start Zeit geben, ohne dass es weitere `runPortion`-Aufrufe auslöst.
		await act(async () => {
			await vi.advanceTimersByTimeAsync(5000);
		});

		expect(runPortion).toHaveBeenCalledTimes(1);
	});

	it('AK7: erkennt beim Mount einen bereits laufenden Hintergrundlauf und pollt automatisch bis zum Ende', async () => {
		const runPortion = vi.fn();
		const loadStatus = vi
			.fn<() => Promise<BackgroundStatus>>()
			.mockResolvedValueOnce({ startedAt: '2026-09-23T10:00:00Z', total: 4, pending: 4, running: true, processed: 1 })
			.mockResolvedValueOnce({ startedAt: '2026-09-23T10:00:00Z', total: 4, pending: 2, running: true, processed: 2 })
			.mockResolvedValue({
				startedAt: '2026-09-23T10:00:00Z',
				total: 4,
				pending: 0,
				running: false,
				result: { updated: 4, failed: 0, skipped: 0, quotaExhausted: false },
			});

		renderHook(() => useReassignRun({ runPortion, loadStatus }));

		// Genug Zeit für mehrere Poll-Intervalle, damit der Hook selbstständig bis zum Ende pollt.
		await act(async () => {
			await vi.advanceTimersByTimeAsync(30_000);
		});

		expect(
			loadStatus.mock.calls.length,
			'muss den Status mehrfach abfragen, bis running:false gemeldet wird',
		).toBeGreaterThan(2);
		expect(
			runPortion,
			'ein bereits laufender Hintergrundlauf braucht keinen erneuten Start-Aufruf',
		).not.toHaveBeenCalled();
	});
});

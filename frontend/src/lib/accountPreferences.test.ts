import { waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pullAccountPreferences } from './accountPreferences';
import { readAiPreferences, storeAiPreferences } from './aiPreferences';
import { dismissBalanceHint, readBalancePreferences, storeBalancePreferences } from './balancePreferences';
import { readExpertMode, storeExpertMode } from './expertMode';
import { readGeolocationPreference, storeGeolocationPreference } from './useGeolocation';
import { storeTheme } from './theme';
import { storeHeaderPosition } from './headerPosition';
import { storeAnimationsEnabled } from './animations';
import { storeVoiceAutostartPreference } from './voiceAutostart';

/**
 * Rote Spec-Tests für #2398 AK3/AK4 (Spec: docs/spec/issue-2398.md): KI-, Balance-Priorität-,
 * Expertenmodus- und Geo-Schalter liegen am Konto; localStorage bleibt Erst-Paint-Spiegel.
 * Gerätelokale Einstellungen senden nie etwas. Rot, bis `lib/accountPreferences.ts` existiert.
 */

const SERVER_STATE = { aiEnabled: false, balancePriority: false, expertMode: true, geolocationEnabled: true };

const putCalls = (fetchMock: ReturnType<typeof vi.fn>): Array<{ url: string; body: unknown }> =>
	fetchMock.mock.calls
		.filter(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')
		.map(([url, init]) => ({ url: String(url), body: JSON.parse(String((init as RequestInit).body)) }));

describe('Konto-Präferenzen im Frontend (#2398)', () => {
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		localStorage.clear();
		fetchMock = vi.fn(async () => new Response(JSON.stringify(SERVER_STATE), { status: 200 }));
		vi.stubGlobal('fetch', fetchMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('AK3 — leerer localStorage: der Kontostand gewinnt und wird in den Spiegel geschrieben', async () => {
		// Defaults ohne Konto: KI an, Balance an, Experte aus, Geo aus.
		expect(readAiPreferences().aiEnabled).toBe(true);

		await pullAccountPreferences();

		expect(readAiPreferences().aiEnabled).toBe(false);
		expect(readBalancePreferences().balancePriority).toBe(false);
		expect(readExpertMode().expertMode).toBe(true);
		expect(readGeolocationPreference()).toBe(true);
		expect(localStorage.getItem('pp-expert-mode')).toBe('true');
	});

	it('AK3 — das Konto gewinnt auch gegen einen abweichenden Gerätewert', async () => {
		localStorage.setItem('pp-expert-mode', 'false');
		await pullAccountPreferences();
		expect(readExpertMode().expertMode).toBe(true);
	});

	it('AK3 — nicht erreichbares Konto: Spiegel bleibt, nichts wirft', async () => {
		localStorage.setItem('pp-expert-mode', 'true');
		fetchMock.mockRejectedValue(new Error('offline'));
		await expect(pullAccountPreferences()).resolves.toBeUndefined();
		expect(readExpertMode().expertMode).toBe(true);
	});

	it.each([
		['KI', () => storeAiPreferences({ aiEnabled: false }), { aiEnabled: false }, 'pp-ai-enabled', 'false'],
		[
			'Balance-Priorität',
			() => storeBalancePreferences({ balancePriority: false }),
			{ balancePriority: false },
			'pp-balance-priority',
			'false',
		],
		['Expertenmodus', () => storeExpertMode({ expertMode: true }), { expertMode: true }, 'pp-expert-mode', 'true'],
		[
			'Geo-Schalter',
			() => storeGeolocationPreference(true),
			{ geolocationEnabled: true },
			'pp-geolocation-enabled',
			'true',
		],
	])('AK3 — %s: Änderung wird gespiegelt und per PUT ans Konto gesendet', async (_label, change, body, key, value) => {
		change();

		expect(localStorage.getItem(key)).toBe(value);
		await waitFor(() => expect(putCalls(fetchMock)).toHaveLength(1));
		const [call] = putCalls(fetchMock);
		expect(call.url).toContain('/account-preferences');
		expect(call.body).toEqual(body);
	});

	it('AK3 — ein Netzwerkfehler beim PUT lässt die lokale Wahl bestehen', async () => {
		fetchMock.mockRejectedValue(new Error('offline'));
		expect(() => storeExpertMode({ expertMode: true })).not.toThrow();
		expect(localStorage.getItem('pp-expert-mode')).toBe('true');
	});

	it('AK4 — Theme, Kopfzeile, Animationen, Sprach-Autostart und Banner senden nichts ans Konto', async () => {
		storeTheme('dark');
		storeHeaderPosition('bottom');
		storeAnimationsEnabled(false);
		storeVoiceAutostartPreference(true);
		dismissBalanceHint();

		// Gegenprobe: ein Konto-Schalter im selben Tick wird gesendet, die lokalen nicht.
		storeExpertMode({ expertMode: true });
		await waitFor(() => expect(fetchMock).toHaveBeenCalled());
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(putCalls(fetchMock)[0].body).toEqual({ expertMode: true });
	});
});

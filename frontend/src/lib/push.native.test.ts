import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Push in der Android-App (#1679): Im Kanal `play` läuft der Push-Schalter über das
 * Capacitor-Plugin und das FCM-Token statt über Web Push. Plugin und API sind gemockt.
 */

const plugin = vi.hoisted(() => {
	const listeners = new Map<string, (data: unknown) => void>();
	return {
		listeners,
		checkPermissions: vi.fn(),
		requestPermissions: vi.fn(),
		register: vi.fn(async () => listeners.get('registration')?.({ value: 'fcm-token-1' })),
		unregister: vi.fn(() => Promise.resolve()),
		addListener: vi.fn(async (event: string, callback: (data: unknown) => void) => {
			listeners.set(event, callback);
			return { remove: async () => listeners.delete(event) };
		}),
	};
});
vi.mock('@capacitor/push-notifications', () => ({ PushNotifications: plugin }));
vi.mock('../api', () => ({
	api: { registerFcmToken: vi.fn(() => Promise.resolve()), unregisterFcmToken: vi.fn(() => Promise.resolve()) },
}));

import { api } from '../api';
import { disablePush, enablePush, usePushSubscription } from './push';

beforeEach(() => {
	vi.stubGlobal('__PP_CHANNEL__', 'play');
});
afterEach(() => {
	vi.clearAllMocks();
	vi.unstubAllGlobals();
	localStorage.clear();
});

describe('Push in der Android-App (#1679)', () => {
	it('play: holt das FCM-Token über das Plugin und meldet es beim Server an, ohne Web Push', async () => {
		plugin.checkPermissions.mockResolvedValue({ receive: 'prompt' });
		plugin.requestPermissions.mockResolvedValue({ receive: 'granted' });
		const serviceWorker = vi.fn();
		vi.stubGlobal('navigator', {
			get serviceWorker() {
				return serviceWorker();
			},
		});

		expect(await enablePush()).toBe(true);

		expect(plugin.requestPermissions).toHaveBeenCalled();
		expect(api.registerFcmToken).toHaveBeenCalledWith('fcm-token-1');
		expect(serviceWorker).not.toHaveBeenCalled();
		expect(plugin.listeners.size).toBe(0);
	});

	it('play: Ausschalten meldet das FCM-Token beim Server ab', async () => {
		plugin.checkPermissions.mockResolvedValue({ receive: 'granted' });
		await enablePush();

		await disablePush();

		expect(api.unregisterFcmToken).toHaveBeenCalledWith('fcm-token-1');
		expect(plugin.unregister).toHaveBeenCalled();
	});

	it('play: abgelehnte Berechtigung lässt den Schalter aus und zeigt den Hinweis', async () => {
		plugin.checkPermissions.mockResolvedValue({ receive: 'prompt' });
		plugin.requestPermissions.mockResolvedValue({ receive: 'denied' });
		const { result } = renderHook(() => usePushSubscription());

		await act(() => result.current.toggle(true));

		expect(result.current.enabled).toBe(false);
		expect(result.current.failed).toBe(true);
		expect(api.registerFcmToken).not.toHaveBeenCalled();
	});

	it('play: der localStorage-Spiegel gibt den Anfangszustand vor, ohne Flackern', async () => {
		localStorage.setItem('pp-push-enabled', 'true');
		localStorage.setItem('pp-fcm-token', 'fcm-token-1');
		plugin.checkPermissions.mockResolvedValue({ receive: 'granted' });

		const { result } = renderHook(() => usePushSubscription());

		expect(result.current.supported).toBe(true);
		expect(result.current.enabled).toBe(true);
		await waitFor(() => expect(api.registerFcmToken).toHaveBeenCalled());
		expect(result.current.enabled).toBe(true);
	});
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { disablePush, hasActiveSubscription } from './push';

const makeSubscription = (endpoint = 'https://push.example.com/abc') => ({
	endpoint,
	expirationTime: null as number | null,
	toJSON: () => ({ endpoint, expirationTime: null, keys: { p256dh: 'p256dh-key', auth: 'auth-secret' } }),
	unsubscribe: vi.fn().mockResolvedValue(true),
});

interface PushManagerMock {
	getSubscription: ReturnType<typeof vi.fn>;
	subscribe: ReturnType<typeof vi.fn>;
}

const installServiceWorker = (pushManager: PushManagerMock): void => {
	Object.defineProperty(globalThis.navigator, 'serviceWorker', {
		configurable: true,
		value: { ready: Promise.resolve({ pushManager }) },
	});
};

const installNotification = (permission: NotificationPermission): void => {
	class NotificationMock {
		static permission: NotificationPermission = permission;
		static requestPermission = vi.fn().mockResolvedValue(permission);
	}
	vi.stubGlobal('Notification', NotificationMock);
	vi.stubGlobal('PushManager', class PushManagerCtor {});
};

describe('lib/push — Issue #628 (Observable Outcomes für tautologische Tests)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		Reflect.deleteProperty(globalThis.navigator, 'serviceWorker');
	});

	it('Backend-Abmeldung: Observable Outcome — State-Änderung von aktiv nach inaktiv', async () => {
		installNotification('granted');
		const subscription = makeSubscription('https://push.example.com/off');
		const pushManager: PushManagerMock = {
			getSubscription: vi
				.fn()
				.mockImplementation(async () => (subscription.unsubscribe.mock.calls.length > 0 ? null : subscription)),
			subscribe: vi.fn(),
		};
		installServiceWorker(pushManager);

		// PROPER OBSERVABLE OUTCOME: Vorher State prüfen
		expect(await hasActiveSubscription()).toBe(true);

		await disablePush();

		// PROPER OBSERVABLE OUTCOME: Nachher State hat sich geändert (nicht nur Mock gerufen)
		expect(await hasActiveSubscription()).toBe(false);
	});

	it('No-op ohne Subscription: Observable Outcome — State bleibt unverändert', async () => {
		installNotification('granted');
		const pushManager: PushManagerMock = {
			getSubscription: vi.fn().mockResolvedValue(null),
			subscribe: vi.fn(),
		};
		installServiceWorker(pushManager);

		// PROPER OBSERVABLE OUTCOME: Vorher State prüfen
		expect(await hasActiveSubscription()).toBe(false);

		// PROPER OBSERVABLE OUTCOME: Aufruf wirft nicht (State-Check via Promise resolution)
		await expect(disablePush()).resolves.toBeUndefined();

		// PROPER OBSERVABLE OUTCOME: Nachher State ist immer noch unverändert
		expect(await hasActiveSubscription()).toBe(false);
	});
});

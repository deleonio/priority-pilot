import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { disablePush, enablePush, hasActiveSubscription, isPushSupported, urlBase64ToUint8Array } from './push';
import { api } from '../api';

/**
 * Tests für den Web-Push-Opt-in-Flow (#355). Die Browser-Push-APIs (Service Worker, PushManager,
 * Notification) sind in jsdom nicht vorhanden und werden hier deterministisch gemockt; die
 * `api`-Fassade wird über `vi.mock` ersetzt, damit kein echter HTTP-Aufruf passiert.
 */

vi.mock('../api', () => ({
	api: {
		getVapidPublicKey: vi.fn(),
		subscribePush: vi.fn(),
		unsubscribePush: vi.fn(),
	},
}));

const mockedApi = vi.mocked(api);

/** Baut eine Fake-PushSubscription mit den vom Flow genutzten Feldern/Methoden. */
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

/** Verdrahtet `navigator.serviceWorker.ready` mit einem Fake-Registration/PushManager. */
const installServiceWorker = (pushManager: PushManagerMock): void => {
	Object.defineProperty(globalThis.navigator, 'serviceWorker', {
		configurable: true,
		value: { ready: Promise.resolve({ pushManager }) },
	});
};

/** Setzt Notification-API mit gegebenem Berechtigungsergebnis. */
const installNotification = (permission: NotificationPermission): void => {
	class NotificationMock {
		static permission: NotificationPermission = permission;
		static requestPermission = vi.fn().mockResolvedValue(permission);
	}
	vi.stubGlobal('Notification', NotificationMock);
	// PushManager muss als Konstruktor am window existieren, damit isPushSupported() greift.
	vi.stubGlobal('PushManager', class PushManagerCtor {});
};

describe('lib/push', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		// serviceWorker wieder entfernen, damit Tests sich nicht gegenseitig beeinflussen.
		Reflect.deleteProperty(globalThis.navigator, 'serviceWorker');
	});

	describe('urlBase64ToUint8Array', () => {
		it('dekodiert URL-safe Base64 in die erwarteten Bytes', () => {
			// "AQID" (Base64) → Bytes [1, 2, 3]. URL-safe-Zeichen werden mitberücksichtigt.
			const result = urlBase64ToUint8Array('AQID');
			expect(Array.from(result)).toEqual([1, 2, 3]);
		});
	});

	describe('isPushSupported', () => {
		it('false, wenn PushManager/Notification fehlen', () => {
			expect(isPushSupported()).toBe(false);
		});

		it('true, wenn Service Worker, PushManager und Notification vorhanden sind', () => {
			installNotification('default');
			installServiceWorker({ getSubscription: vi.fn(), subscribe: vi.fn() });
			expect(isPushSupported()).toBe(true);
		});
	});

	describe('enablePush', () => {
		it('subscribed und meldet die Subscription ans Backend, wenn die Berechtigung erteilt wird', async () => {
			installNotification('granted');
			const subscription = makeSubscription();
			const pushManager: PushManagerMock = {
				getSubscription: vi.fn().mockResolvedValue(null),
				subscribe: vi.fn().mockResolvedValue(subscription),
			};
			installServiceWorker(pushManager);
			mockedApi.getVapidPublicKey.mockResolvedValue('AQID');

			const result = await enablePush();

			expect(result).toBe(true);
			expect(pushManager.subscribe).toHaveBeenCalledWith({
				userVisibleOnly: true,
				applicationServerKey: expect.any(Uint8Array),
			});
			expect(mockedApi.subscribePush).toHaveBeenCalledWith({
				subscription: {
					endpoint: 'https://push.example.com/abc',
					expirationTime: null,
					keys: { p256dh: 'p256dh-key', auth: 'auth-secret' },
				},
			});
		});

		it('gibt false zurück und subscribed nicht, wenn die Berechtigung verweigert wird', async () => {
			installNotification('denied');
			const pushManager: PushManagerMock = {
				getSubscription: vi.fn().mockResolvedValue(null),
				subscribe: vi.fn(),
			};
			installServiceWorker(pushManager);

			const result = await enablePush();

			expect(result).toBe(false);
			expect(pushManager.subscribe).not.toHaveBeenCalled();
			expect(mockedApi.subscribePush).not.toHaveBeenCalled();
		});

		it('nutzt eine bestehende Subscription wieder, statt neu zu subscriben', async () => {
			installNotification('granted');
			const subscription = makeSubscription('https://push.example.com/existing');
			const pushManager: PushManagerMock = {
				getSubscription: vi.fn().mockResolvedValue(subscription),
				subscribe: vi.fn(),
			};
			installServiceWorker(pushManager);
			mockedApi.getVapidPublicKey.mockResolvedValue('AQID');

			const result = await enablePush();

			expect(result).toBe(true);
			expect(pushManager.subscribe).not.toHaveBeenCalled();
			expect(mockedApi.subscribePush).toHaveBeenCalledOnce();
		});
	});

	describe('disablePush', () => {
		it('meldet am Backend ab und kündigt die Subscription im Browser', async () => {
			installNotification('granted');
			const subscription = makeSubscription('https://push.example.com/off');
			const pushManager: PushManagerMock = {
				getSubscription: vi.fn().mockResolvedValue(subscription),
				subscribe: vi.fn(),
			};
			installServiceWorker(pushManager);

			await disablePush();

			expect(mockedApi.unsubscribePush).toHaveBeenCalledWith({ endpoint: 'https://push.example.com/off' });
			expect(subscription.unsubscribe).toHaveBeenCalledOnce();
		});

		it('ist ein No-op ohne aktive Subscription', async () => {
			installNotification('granted');
			const pushManager: PushManagerMock = {
				getSubscription: vi.fn().mockResolvedValue(null),
				subscribe: vi.fn(),
			};
			installServiceWorker(pushManager);

			await disablePush();

			expect(mockedApi.unsubscribePush).not.toHaveBeenCalled();
		});

		// AK1 / TF4 (#507): Beobachtbares Outcome statt reiner Mock-Assertion. Nach dem Abmelden
		// muss eine vormals aktive Subscription beobachtbar inaktiv sein — nicht nur „die Mocks
		// wurden gerufen". Der PushManager spiegelt hier die Realität des Browsers: nachdem
		// `disablePush()` die Subscription gekündigt hat (`subscription.unsubscribe` gerufen),
		// liefert `getSubscription()` anschließend null — die Post-Condition wird damit verifiziert.
		it('macht eine aktive Subscription beobachtbar inaktiv (hasActive danach false)', async () => {
			installNotification('granted');
			const subscription = makeSubscription('https://push.example.com/off');
			const pushManager: PushManagerMock = {
				getSubscription: vi.fn().mockImplementation(async () =>
					// Browser-Realität: nach erfolgtem unsubscribe() ist die Subscription weg.
					subscription.unsubscribe.mock.calls.length > 0 ? null : subscription,
				),
				subscribe: vi.fn(),
			};
			installServiceWorker(pushManager);

			await disablePush();

			// Post-Condition: eine abgemeldete Subscription ist nicht mehr aktiv.
			expect(await hasActiveSubscription()).toBe(false);
		});

		// AK1 / TF4 (#507): Beobachtbares Outcome des No-op — ohne Subscription ändert sich kein
		// Zustand, und der Aufruf wirft nicht (bisher nur „Backend nicht gerufen" geprüft).
		it('ändert ohne aktive Subscription keinen beobachtbaren Zustand und wirft nicht', async () => {
			installNotification('granted');
			const pushManager: PushManagerMock = {
				getSubscription: vi.fn().mockResolvedValue(null),
				subscribe: vi.fn(),
			};
			installServiceWorker(pushManager);

			await expect(disablePush()).resolves.toBeUndefined();
			expect(await hasActiveSubscription()).toBe(false);
		});
	});

	describe('hasActiveSubscription', () => {
		it('spiegelt, ob eine Subscription vorhanden ist', async () => {
			installNotification('granted');
			installServiceWorker({
				getSubscription: vi.fn().mockResolvedValue(makeSubscription()),
				subscribe: vi.fn(),
			});
			expect(await hasActiveSubscription()).toBe(true);
		});

		it('false, wenn Push nicht unterstützt wird', async () => {
			expect(await hasActiveSubscription()).toBe(false);
		});
	});
});

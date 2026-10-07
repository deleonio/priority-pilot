import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * App-Token in der Android-App (#2379): Der API-Client schickt es als Bearer-Header, löst es beim
 * Login ein (Exchange, Magic Link) und widerruft es beim Abmelden. Server-Vertrag: #2377.
 */

const { mockPOST, mockUse } = vi.hoisted(() => ({ mockPOST: vi.fn(), mockUse: vi.fn() }));

vi.mock('openapi-fetch', () => ({ default: vi.fn(() => ({ GET: vi.fn(), POST: mockPOST, use: mockUse })) }));

import { api } from './api';
import { clearAppToken, getAppToken, setAppToken } from './lib/appToken';

// Einmal beim Import registriert — vor dem ersten `clearAllMocks` festhalten.
const middleware = mockUse.mock.calls[0][0] as {
	onRequest: (c: { request: { method: string; headers: Headers } }) => Promise<void>;
};

const onRequest = async (method: string): Promise<Headers> => {
	const request = { method, headers: new Headers() };
	await middleware.onRequest({ request });
	return request.headers;
};

beforeEach(() => {
	vi.stubGlobal(
		'fetch',
		vi.fn(async (url: string) => ({ ok: true, status: 200, json: async () => ({ csrfToken: String(url) }) })),
	);
});
afterEach(() => {
	vi.unstubAllGlobals();
	vi.clearAllMocks();
	clearAppToken();
});

describe('API-Client mit App-Token (#2379)', () => {
	it('AK5: mit Token trägt jede Anfrage Authorization: Bearer (lesend wie schreibend, z. B. FCM)', async () => {
		setAppToken('t-1');

		expect((await onRequest('GET')).get('authorization')).toBe('Bearer t-1');
		expect((await onRequest('POST')).get('authorization')).toBe('Bearer t-1');
	});

	it('AK5: ohne Token fehlt der Header (Website unverändert)', async () => {
		expect((await onRequest('GET')).get('authorization')).toBeNull();
		expect((await onRequest('POST')).get('authorization')).toBeNull();
	});

	it('AK2: exchangeNativeLoginCode speichert das zurückgegebene token', async () => {
		mockPOST.mockResolvedValue({ response: { ok: true }, data: { token: 'exchanged' } });

		expect(await api.exchangeNativeLoginCode('c', 's')).toBe(true);

		expect(getAppToken()).toBe('exchanged');
	});

	it('AK2: ein gescheiterter Austausch lässt die Ablage unberührt', async () => {
		mockPOST.mockResolvedValue({ response: { ok: false }, error: {} });

		expect(await api.exchangeNativeLoginCode('c', 's')).toBe(false);

		expect(getAppToken()).toBeNull();
	});

	it('AK4: verifyMagicLink speichert das token aus dem AppTokenDto', async () => {
		mockPOST.mockResolvedValue({ response: { ok: true }, data: { token: 'magic' } });

		expect(await api.verifyMagicLink('m')).toBe(true);

		expect(getAppToken()).toBe('magic');
	});

	it('AK7: logout sendet das Token mit, löscht es danach lokal und spätere Anfragen tragen keinen Header', async () => {
		setAppToken('t-2');

		await api.logout();

		const logoutCall = vi.mocked(fetch).mock.calls.find(([url]) => String(url).endsWith('/auth/logout'));
		expect(new Headers(logoutCall?.[1]?.headers).get('authorization')).toBe('Bearer t-2');
		expect(getAppToken()).toBeNull();
		expect((await onRequest('GET')).get('authorization')).toBeNull();
	});
});

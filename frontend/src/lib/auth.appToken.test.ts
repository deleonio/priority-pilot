import { afterEach, describe, expect, it, vi } from 'vitest';
import { setAppToken } from './appToken';
import { checkAuth } from './auth';

/** #2379 AK5: Auch der Sitzungs-Check trägt das App-Token; ohne Token bleibt die Website unverändert. */

afterEach(() => {
	vi.unstubAllGlobals();
	localStorage.clear();
});

const authorization = (fetchMock: ReturnType<typeof vi.fn>): string | null =>
	new Headers((fetchMock.mock.calls[0][1] as RequestInit | undefined)?.headers).get('authorization');

describe('checkAuth mit App-Token (#2379)', () => {
	it('sendet Authorization: Bearer <token>, wenn ein App-Token vorliegt', async () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ email: 'a@b.de' }) });
		vi.stubGlobal('fetch', fetchMock);
		setAppToken('t-3');

		await checkAuth();

		expect(authorization(fetchMock)).toBe('Bearer t-3');
	});

	it('sendet ohne App-Token keinen Authorization-Header', async () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ email: 'a@b.de' }) });
		vi.stubGlobal('fetch', fetchMock);

		await checkAuth();

		expect(authorization(fetchMock)).toBeNull();
	});
});

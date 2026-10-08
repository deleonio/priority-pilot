import { afterEach, describe, expect, it, vi } from 'vitest';

/** App-Token der Android-App (#2379 AK6): persistente Ablage, übersteht einen Neustart. */

afterEach(() => {
	localStorage.clear();
	vi.resetModules();
});

describe('appToken (#2379)', () => {
	it('AK6: liefert ohne Token null, nach dem Schreiben den Wert, nach dem Löschen wieder null', async () => {
		const { getAppToken, setAppToken, clearAppToken } = await import('./appToken');
		expect(getAppToken()).toBeNull();
		setAppToken('t-1');
		expect(getAppToken()).toBe('t-1');
		clearAppToken();
		expect(getAppToken()).toBeNull();
	});

	it('AK6: übersteht einen App-Neustart (Modul neu geladen)', async () => {
		(await import('./appToken')).setAppToken('t-2');
		vi.resetModules();

		expect((await import('./appToken')).getAppToken()).toBe('t-2');
	});
});

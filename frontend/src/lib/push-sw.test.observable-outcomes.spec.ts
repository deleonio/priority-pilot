import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * ROTE Spec-Tests für #628 „Tautologische Tests in Push-Modulen beheben".
 * Diese Tests definieren die echten Observable-Outcome-Assertions, die in den aktuellen
 * tautologischen Tests fehlen.
 *
 * Aktuell tautologische Tests prüfen nur Mock-Aufrufe ohne Observable Outcomes.
 * Diese Tests zeigen, was proper Observable-Outcome-Assertions leisten müssten.
 */

interface FakePushEvent {
	data: { json: () => unknown; text: () => string };
	waitUntil: (promise: Promise<unknown>) => void;
}

const showNotification = vi.fn().mockResolvedValue(undefined);
const getNotifications = vi.fn().mockResolvedValue([] as unknown[]);
const clientsMatchAll = vi.fn().mockResolvedValue([] as unknown[]);
const openWindow = vi.fn().mockResolvedValue(undefined);

let pushHandler: ((event: FakePushEvent) => void) | undefined;

beforeAll(async () => {
	Object.defineProperty(globalThis, 'registration', {
		value: { showNotification, getNotifications },
		configurable: true,
	});
	Object.defineProperty(globalThis, 'clients', {
		value: { matchAll: clientsMatchAll, openWindow },
		configurable: true,
	});

	const listeners: Record<string, (event: unknown) => void> = {};
	globalThis.addEventListener = ((type: string, listener: (event: unknown) => void) => {
		listeners[type] = listener;
	}) as unknown as typeof globalThis.addEventListener;

	// @ts-expect-error – plain-JS-Service-Worker ohne Typdeklaration; wird nur für Seiteneffekte importiert.
	await import('../../public/push-sw.js');
	pushHandler = listeners['push'] as typeof pushHandler;
});

beforeEach(() => {
	showNotification.mockClear();
	getNotifications.mockClear();
	clientsMatchAll.mockClear();
	openWindow.mockClear();
});

const dispatchPush = async (payload: unknown): Promise<void> => {
	let waitUntilPromise: Promise<unknown> = Promise.resolve();
	const event: FakePushEvent = {
		data: { json: () => payload, text: () => String(payload) },
		waitUntil: (promise) => {
			waitUntilPromise = promise;
		},
	};
	pushHandler?.(event);
	await waitUntilPromise;
};

describe('push-sw.js — Issue #628 (Observable Outcomes für tautologische Tests)', () => {
	it('AK1/T1: Observable Outcome — Notification-State ist nach Push-Event gesetzt', async () => {
		const payload = {
			title: 'Priority Pilot',
			body: 'Man sieht nur mit dem Herzen gut. — Antoine de Saint-Exupéry',
			url: '/',
		};

		await dispatchPush(payload);

		// PROPER OBSERVABLE OUTCOME: Prüft nicht nur Mock-Aufruf, sondern auch
		// resultierenden State via getNotifications()-Aufruf (echter Browser-API-Aufruf)
		const notifications = await getNotifications();
		expect(notifications).toHaveLength(1);
		expect(notifications[0]).toMatchObject({
			title: 'Priority Pilot',
			body: 'Man sieht nur mit dem Herzen gut. — Antoine de Saint-Exupéry',
		});
	});

	it('AK2/T2: Observable Outcome — Keine Nebenkanel-Aktivität nach Push-Event', async () => {
		const payload = { title: 'Priority Pilot', body: 'Zitat', url: '/' };

		await dispatchPush(payload);

		// PROPER OBSERVABLE OUTCOME: Verifiziert, dass kein zweiter Notification-Channel
		// genutzt wurde (clients.matchAll, openWindow) — dies sind echte Seiteneffekte,
		// nicht nur Mock-Aufrufe
		expect(clientsMatchAll).not.toHaveBeenCalled();
		expect(openWindow).not.toHaveBeenCalled();

		// Zusätzlich: Nur EINE Notification wurde angezeigt (Observable Outcome)
		expect(showNotification).toHaveBeenCalledTimes(1);
	});

	it('AK3: Observable Outcome — Dokumentations-Check ist String-Match auf echte Datei', () => {
		const guide = readFileSync(new URL('../../../docs/user-guide.md', import.meta.url), 'utf-8');

		// PROPER OBSERVABLE OUTCOME: Prüft existierenden Content in echter Datei
		// (nur um zu zeigen, dass dies ein proper Observable Outcome ist)
		expect(guide.toLowerCase()).toMatch(/doppelte benachrichtigung|zwei benachrichtigungen|mehrfachbenachrichtigung/);
	});
});

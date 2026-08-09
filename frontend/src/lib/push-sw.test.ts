import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * ROTE Spec-Tests für #504 „Push-Notification: nur EINE Benachrichtigung anzeigen (doppelte
 * vermeiden)". Treiber ist der Service Worker (`public/push-sw.js`), der beim `push`-Event die
 * Notification anzeigt. Akzeptanzkriterien aus dem Issue-Body:
 *
 *  - AK1: Pro Push-Event erscheint genau EINE Notification (die App-Notification mit dem Zitat).
 *  - AK2: Die Chrome-Notification („URL kopieren" / Teilen / „In Chrome öffnen") erscheint nicht.
 *  - AK3: Falls nicht eliminierbar → Workaround/Doku vorhanden (z. B. App als eigenständige App).
 *
 * Der Service Worker wird als Modul geladen und mit gemocktem `self.registration` / `self.clients`
 * angesteuert; die Handler werden über einen ersetzten `addEventListener` eingefangen (self ===
 * globalThis im jsdom-Env). AK2 ist im Kern Chrome/Android-Plattformverhalten und nur e2e/manuell
 * (T2) verifizierbar – hier wird der Proxy geprüft, dass der SW selbst keine zweite Notification
 * erzeugt.
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
	// SW braucht `self.registration` (push) und `self.clients` (notificationclick) – in jsdom nicht
	// vorhanden, daher als Globals bereitgestellt (self === globalThis in jsdom).
	Object.defineProperty(globalThis, 'registration', {
		value: { showNotification, getNotifications },
		configurable: true,
	});
	Object.defineProperty(globalThis, 'clients', {
		value: { matchAll: clientsMatchAll, openWindow },
		configurable: true,
	});

	// Listener einfangen, indem addEventListener VOR dem Import ersetzt wird, damit die
	// Registrierung im Modul-Top-Level über unseren Stub läuft (statischer Import wäre gehoistet).
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

/** Löst einen push-Event mit der gegebenen Payload aus und wartet auf showNotification. */
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

describe('push-sw.js — Issue #504 (nur EINE Benachrichtigung)', () => {
	it('AK1/T1: zeigt pro Push-Event genau EINE Notification mit dem Tageszitat', async () => {
		await dispatchPush({
			title: 'Priority Pilot',
			body: 'Man sieht nur mit dem Herzen gut. — Antoine de Saint-Exupéry',
			url: '/',
		});

		// Genau ein showNotification-Aufruf pro Push-Event (keine Verdopplung aus dem SW).
		expect(showNotification).toHaveBeenCalledTimes(1);
		expect(showNotification).toHaveBeenCalledWith(
			'Priority Pilot',
			expect.objectContaining({ body: 'Man sieht nur mit dem Herzen gut. — Antoine de Saint-Exupéry' }),
		);
	});

	it('AK1/T3: aufeinanderfolgende Pushes stapeln nicht – Notification trägt einen stabilen Tag', async () => {
		await dispatchPush({ title: 'Priority Pilot', body: 'Zitat 1', url: '/' });
		await dispatchPush({ title: 'Priority Pilot', body: 'Zitat 2', url: '/' });

		// Beide Aufrufe müssen denselben `tag` tragen, damit der zweite Push die erste Notification
		// ersetzt statt eine zweite zu stapeln (Coalescing über den Tag — die web-push-Mechanik gegen
		// Duplikate im Notification-Shade/Sperrbildschirm). Aktuell fehlt der Tag → Test ist ROT.
		expect(showNotification).toHaveBeenNthCalledWith(
			1,
			expect.any(String),
			expect.objectContaining({ tag: expect.any(String) }),
		);
		expect(showNotification).toHaveBeenNthCalledWith(
			2,
			expect.any(String),
			expect.objectContaining({ tag: expect.any(String) }),
		);

		const firstOptions = showNotification.mock.calls[0]?.[1] as { tag?: string } | undefined;
		const secondOptions = showNotification.mock.calls[1]?.[1] as { tag?: string } | undefined;
		expect(firstOptions?.tag).toBeTruthy();
		expect(secondOptions?.tag).toBe(firstOptions?.tag);
	});

	it('AK2/T2: der push-Pfad erzeugt keine zweite Notification über einen Nebenkanel', async () => {
		await dispatchPush({ title: 'Priority Pilot', body: 'Zitat', url: '/' });

		// Genau eine Notification aus dem SW; der push-Pfad darf weder openWindow noch Clients nutzen.
		// (Die unerwünschte zweite „URL kopieren"-Notification stammt von Chrome selbst, nicht vom SW
		//  → Plattformverhalten, nur e2e/manuell bzw. über AK3 verifizierbar.)
		expect(showNotification).toHaveBeenCalledTimes(1);
		expect(clientsMatchAll).not.toHaveBeenCalled();
		expect(openWindow).not.toHaveBeenCalled();
	});

	it('AK3: das Handbuch dokumentiert das Symptom der doppelten Benachrichtigung', () => {
		const guide = readFileSync(new URL('../../../docs/user-guide.md', import.meta.url), 'utf-8');

		// Workaround/Doku (AK3): ist die zweite Chrome-Notification nicht technisch eliminierbar, muss
		// das Handbuch Nutzerinnen einen Weg aufzeigen (z. B. eigenständige App-Installation).
		expect(guide.toLowerCase()).toMatch(/doppelte benachrichtigung|zwei benachrichtigungen|mehrfachbenachrichtigung/);
	});
});

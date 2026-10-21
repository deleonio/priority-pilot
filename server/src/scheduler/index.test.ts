import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import webpush from 'web-push';

import { createTicker, startDeadlineAutoDeleteScheduler, startIntervalScheduler, startScheduler } from './index.js';

// Vertrag aus docs/spec/issue-2550.md: der generalisierte Intervall-Starter loggt Fehler
// unter dem Job-eigenen Label statt unter dem festen Kalender-Text.

const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

describe('startIntervalScheduler (#2550)', () => {
	let errorMock: ReturnType<typeof mock.method>;

	beforeEach(() => {
		errorMock = mock.method(console, 'error', () => {});
		// 'clearInterval' ist in node:test mock.timers keine gültige API (ERR_INVALID_ARG_VALUE,
		// Node 26) — gemockte Intervalle lassen sich via clearInterval() direkt beenden.
		mock.timers.enable({ apis: ['setInterval'] });
	});

	afterEach(() => {
		mock.timers.reset();
		errorMock.mock.restore();
	});

	it('AK1: loggt einen Fehler mit dem Job-eigenen Label — Kulanzfrist-Sweep, ohne Kalender-Abruf', async () => {
		const trigger = () => Promise.reject(new Error('Kulanz-Sweep kaputt'));
		const handle = startIntervalScheduler('Kulanzfrist-Sweep', trigger, 1000);

		mock.timers.tick(1000);
		await flush();

		assert.equal(errorMock.mock.callCount(), 1);
		const label = String(errorMock.mock.calls[0]?.arguments[0]);
		assert.match(label, /Kulanzfrist-Sweep fehlgeschlagen/);
		assert.doesNotMatch(label, /Kalender-Abruf/);
		assert.equal(String(errorMock.mock.calls[0]?.arguments[1]), 'Error: Kulanz-Sweep kaputt');
		handle.stop();
	});

	it('AK2: Kalender-Fehler tragen weiterhin das Label Kalender-Abruf', async () => {
		const trigger = () => Promise.reject(new Error('ics kaputt'));
		const handle = startIntervalScheduler('Kalender-Abruf', trigger, 1000);

		mock.timers.tick(1000);
		await flush();

		assert.equal(errorMock.mock.callCount(), 1);
		assert.match(String(errorMock.mock.calls[0]?.arguments[0]), /Kalender-Abruf fehlgeschlagen/);
		handle.stop();
	});

	it('AK4: nach fehlerhaftem Lauf feuert der nächste Tick; stop() beendet den Timer', async () => {
		let calls = 0;
		const trigger = () => {
			calls += 1;
			return Promise.reject(new Error('boom'));
		};
		const handle = startIntervalScheduler('Kulanzfrist-Sweep', trigger, 1000);

		mock.timers.tick(1000);
		await flush();
		mock.timers.tick(1000);
		await flush();
		assert.equal(calls, 2);

		handle.stop();
		mock.timers.tick(5000);
		await flush();
		assert.equal(calls, 2);
	});
});

describe('scheduler/createTicker — Tick-Logik (Issue #355)', () => {
	it('feuert erst, sobald die konfigurierte Stunde erreicht ist', async () => {
		const calls: Date[] = [];
		let current = new Date('2026-07-07T07:59:00Z');
		const { tick } = createTicker(
			[
				async (now) => {
					calls.push(now);
				},
			],
			{ now: () => current, hour: 8 },
		);

		await tick();
		assert.equal(calls.length, 0, 'vor der konfigurierten Stunde darf kein Trigger laufen');

		current = new Date('2026-07-07T08:00:00Z');
		await tick();
		assert.equal(calls.length, 1, 'ab der konfigurierten Stunde läuft der Trigger');
	});

	it('feuert pro Kalendertag höchstens einmal, auch bei mehreren Ticks im Fenster', async () => {
		const calls: Date[] = [];
		let current = new Date('2026-07-07T08:05:00Z');
		const { tick } = createTicker(
			[
				async (now) => {
					calls.push(now);
				},
			],
			{ now: () => current, hour: 8 },
		);

		await tick();
		await tick();
		current = new Date('2026-07-07T09:00:00Z');
		await tick();
		assert.equal(calls.length, 1, 'weitere Ticks am selben Tag lösen keinen erneuten Lauf aus');

		current = new Date('2026-07-08T08:00:00Z');
		await tick();
		assert.equal(calls.length, 2, 'am Folgetag feuert der Trigger erneut');
	});

	it('ruft alle registrierten Trigger auf und fängt Fehler einzelner Trigger ab', async () => {
		const calls: string[] = [];
		const { tick } = createTicker(
			[
				async () => {
					throw new Error('kaputt');
				},
				async () => {
					calls.push('zweiter');
				},
			],
			{ now: () => new Date('2026-07-07T08:00:00Z'), hour: 8 },
		);

		await assert.doesNotReject(tick());
		assert.deepEqual(calls, ['zweiter'], 'ein fehlschlagender Trigger blockiert die übrigen nicht');
	});
});

describe('scheduler/startScheduler — Gate (Issue #355)', () => {
	const originalEnv = { ...process.env };

	afterEach(() => {
		process.env = { ...originalEnv };
	});

	it('startet keinen Timer ohne VAPID- und FCM-Konfiguration', () => {
		delete process.env.VAPID_PUBLIC_KEY;
		delete process.env.VAPID_PRIVATE_KEY;
		delete process.env.FCM_SERVICE_ACCOUNT_FILE;
		process.env.PUSH_REMINDERS_ENABLED = 'true';
		let calledSetInterval = false;

		const handle = startScheduler([], {
			setIntervalFn: ((fn: () => void) => {
				calledSetInterval = true;
				fn();
				return 1 as unknown as NodeJS.Timeout;
			}) as typeof setInterval,
		});

		assert.equal(calledSetInterval, false);
		assert.doesNotThrow(() => handle.stop());
	});

	it('startet keinen Timer ohne PUSH_REMINDERS_ENABLED', () => {
		const keys = webpush.generateVAPIDKeys();
		process.env.VAPID_PUBLIC_KEY = keys.publicKey;
		process.env.VAPID_PRIVATE_KEY = keys.privateKey;
		delete process.env.PUSH_REMINDERS_ENABLED;
		let calledSetInterval = false;

		const handle = startScheduler([], {
			setIntervalFn: ((fn: () => void) => {
				calledSetInterval = true;
				fn();
				return 1 as unknown as NodeJS.Timeout;
			}) as typeof setInterval,
		});

		assert.equal(calledSetInterval, false);
		assert.doesNotThrow(() => handle.stop());
	});

	it('registriert einen Interval-Callback auch mit FCM allein, ohne VAPID', () => {
		delete process.env.VAPID_PUBLIC_KEY;
		delete process.env.VAPID_PRIVATE_KEY;
		process.env.FCM_SERVICE_ACCOUNT_FILE = '/tmp/fcm.json';
		process.env.PUSH_REMINDERS_ENABLED = 'true';
		let registered = false;

		const handle = startScheduler([], {
			setIntervalFn: ((fn: () => void) => {
				registered = typeof fn === 'function';
				return 1 as unknown as NodeJS.Timeout;
			}) as typeof setInterval,
			clearIntervalFn: (() => {}) as typeof clearInterval,
		});

		assert.equal(registered, true);
		handle.stop();
	});

	it('registriert einen Interval-Callback, wenn konfiguriert und aktiviert', () => {
		const keys = webpush.generateVAPIDKeys();
		process.env.VAPID_PUBLIC_KEY = keys.publicKey;
		process.env.VAPID_PRIVATE_KEY = keys.privateKey;
		process.env.PUSH_REMINDERS_ENABLED = 'true';
		let registered: (() => void) | undefined;
		let cleared = false;

		const handle = startScheduler([], {
			setIntervalFn: ((fn: () => void) => {
				registered = fn;
				return 1 as unknown as NodeJS.Timeout;
			}) as typeof setInterval,
			clearIntervalFn: (() => {
				cleared = true;
			}) as typeof clearInterval,
		});

		assert.equal(typeof registered, 'function', 'registriert einen Interval-Callback');
		handle.stop();
		assert.equal(cleared, true, 'stop() räumt den Timer auf');
	});
});

// Roter Spec-Test für #2849 (Spec docs/spec/issue-2849.md): der Scheduler tickt stündlich,
// die Tagesstunden-Bedingung (`shouldFire`/`PUSH_REMINDERS_HOUR`) entfällt. KEIN Produktivcode.
describe('scheduler/startScheduler — stündlicher Tick (#2849 AK1)', () => {
	const originalEnv = { ...process.env };

	afterEach(() => {
		process.env = { ...originalEnv };
	});

	it('TF1: feuert bei JEDEM Tick — auch zweimal vor der konfigurierten Tagesstunde; PUSH_REMINDERS_HOUR wird ignoriert', async () => {
		const keys = webpush.generateVAPIDKeys();
		process.env.VAPID_PUBLIC_KEY = keys.publicKey;
		process.env.VAPID_PRIVATE_KEY = keys.privateKey;
		process.env.PUSH_REMINDERS_ENABLED = 'true';
		process.env.PUSH_REMINDERS_HOUR = '8'; // wird künftig nicht mehr ausgewertet
		const calls: Date[] = [];
		let current = new Date('2026-07-07T07:00:00Z');
		let tickFn: (() => void) | undefined;

		const handle = startScheduler(
			[
				async (now) => {
					calls.push(now);
				},
			],
			{
				now: () => current,
				setIntervalFn: ((fn: () => void) => {
					tickFn = fn;
					return 1 as unknown as NodeJS.Timeout;
				}) as typeof setInterval,
				clearIntervalFn: (() => {}) as typeof clearInterval,
			},
		);

		tickFn?.();
		current = new Date('2026-07-07T07:30:00Z');
		tickFn?.();
		await flush();

		assert.equal(calls.length, 2, 'beide Ticks feuern — die Tagesstunden-Bedingung ist entfallen');
		handle.stop();
	});
});

describe('scheduler/startDeadlineAutoDeleteScheduler — push-unabhängiges Gate (#523)', () => {
	const originalEnv = { ...process.env };

	afterEach(() => {
		process.env = { ...originalEnv };
	});

	it('startet den Timer default-on, auch OHNE VAPID-Keys und ohne PUSH_REMINDERS_ENABLED', () => {
		// Beweist die Entkopplung vom Web-Push-Gate: Auto-Löschung ist eine reine
		// Datenbereinigung und darf nicht still liegen, wenn Web-Push nicht opt-in ist.
		delete process.env.VAPID_PUBLIC_KEY;
		delete process.env.VAPID_PRIVATE_KEY;
		delete process.env.PUSH_REMINDERS_ENABLED;
		let calledSetInterval = false;

		const handle = startDeadlineAutoDeleteScheduler([], {
			setIntervalFn: ((fn: () => void) => {
				calledSetInterval = true;
				fn();
				return 1 as unknown as NodeJS.Timeout;
			}) as typeof setInterval,
		});

		assert.equal(calledSetInterval, true, 'ohne Web-Push-Opt-in läuft der Timer dennoch (default-on)');
		assert.doesNotThrow(() => handle.stop());
	});

	it('startet keinen Timer bei AUTO_DELETE_AFTER_DEADLINE_ENABLED=false', () => {
		process.env.AUTO_DELETE_AFTER_DEADLINE_ENABLED = 'false';
		let calledSetInterval = false;

		const handle = startDeadlineAutoDeleteScheduler([], {
			setIntervalFn: ((fn: () => void) => {
				calledSetInterval = true;
				fn();
				return 1 as unknown as NodeJS.Timeout;
			}) as typeof setInterval,
		});

		assert.equal(calledSetInterval, false);
		assert.doesNotThrow(() => handle.stop());
	});
});

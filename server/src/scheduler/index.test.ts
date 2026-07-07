import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import webpush from 'web-push';
import { createTicker, startScheduler } from './index.js';

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

	it('startet keinen Timer ohne VAPID-Konfiguration', () => {
		delete process.env.VAPID_PUBLIC_KEY;
		delete process.env.VAPID_PRIVATE_KEY;
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

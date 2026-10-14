import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

import { startIntervalScheduler } from './index.js';

// Vertrag aus docs/spec/issue-2550.md: der generalisierte Intervall-Starter loggt Fehler
// unter dem Job-eigenen Label statt unter dem festen Kalender-Text.

const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

describe('startIntervalScheduler (#2550)', () => {
	let errorMock: ReturnType<typeof mock.method>;

	beforeEach(() => {
		errorMock = mock.method(console, 'error', () => {});
		mock.timers.enable({ apis: ['setInterval', 'clearInterval'] });
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

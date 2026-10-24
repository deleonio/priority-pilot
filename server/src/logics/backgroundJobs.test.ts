import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import { isBackgroundJobsEnabled } from './backgroundJobs.js';

// Rote Spec-Tests für #2831 (Spec docs/spec/issue-2831.md): Semantik des Master-Schalters.
// KEIN Produktivcode.
describe('logics/backgroundJobs — Master-Schalter BACKGROUND_JOBS_ENABLED (#2831 AK3)', () => {
	const originalEnv = { ...process.env };

	afterEach(() => {
		process.env = { ...originalEnv };
	});

	it('TF3: ist default-on — ohne Schalter und mit =true laufen Hintergrund-Jobs', () => {
		delete process.env.BACKGROUND_JOBS_ENABLED;
		assert.equal(isBackgroundJobsEnabled(), true, 'unset → an');
		process.env.BACKGROUND_JOBS_ENABLED = 'true';
		assert.equal(isBackgroundJobsEnabled(), true, '=true → an');
	});

	it('TF3: deaktiviert nur bei exakt =false', () => {
		process.env.BACKGROUND_JOBS_ENABLED = 'false';
		assert.equal(isBackgroundJobsEnabled(), false, '=false → aus');
	});
});

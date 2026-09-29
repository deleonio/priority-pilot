import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isPublicEndpoint } from './endpointGuard.js';

/** F-2 (#1561): SSRF-Sperre — interne Ziele werden erkannt, auch in Umschreibungen. */
describe('isPublicEndpoint', () => {
	for (const url of [
		'http://127.0.0.1:3000/v1',
		'http://localhost/v1',
		'http://169.254.169.254/latest/meta-data',
		'http://10.1.2.3/v1',
		'http://172.16.0.1/v1',
		'http://192.168.1.1/v1',
		'http://0.0.0.0/v1',
		'http://[::1]/v1',
		'http://[fd00::1]/v1',
		'http://[fe80::1]/v1',
		'http://[::ffff:127.0.0.1]/v1',
		'http://[64:ff9b::a9fe:a9fe]/v1',
		'http://[2002:a9fe:a9fe::1]/v1',
		'http://0x7f000001/v1',
		'http://2130706433/v1',
	]) {
		it(`sperrt ${url}`, async () => {
			assert.equal(await isPublicEndpoint(url), false);
		});
	}

	it('lässt öffentliche Adressen durch', async () => {
		assert.equal(await isPublicEndpoint('https://8.8.8.8/v1'), true);
		assert.equal(await isPublicEndpoint('https://[2606:4700::1111]/v1'), true);
	});
});

import { describe, it, mock } from 'node:test';
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

/** #2685: DNS-Fehler fail-closed — Lookup injizierbar (2. Parameter, wie fetchIcs). */
describe('isPublicEndpoint: DNS-Fehler fail-closed', () => {
	const dnsFail = async (): Promise<never> => {
		const error = new Error('getaddrinfo ENOTFOUND provider.invalid') as NodeJS.ErrnoException;
		error.code = 'ENOTFOUND';
		throw error;
	};

	it('AK1: lehnt nicht auflösbaren Host ab (fail-closed statt fail-open)', async () => {
		assert.equal(await isPublicEndpoint('https://provider.invalid/v1', dnsFail), false);
	});

	it('AK2: loggt genau einmal Host und DNS-Ursache', async () => {
		const errSpy = mock.method(console, 'error', () => {});
		try {
			await isPublicEndpoint('https://provider.invalid/v1', dnsFail);
			assert.equal(errSpy.mock.callCount(), 1);
			const logged = errSpy.mock.calls[0].arguments.map(String).join(' ');
			assert.match(logged, /provider\.invalid/);
			assert.match(logged, /ENOTFOUND/);
		} finally {
			errSpy.mock.restore();
		}
	});

	it('AK3: injizierter Lookup entscheidet — interne Auflösung gesperrt, öffentliche durchgelassen', async () => {
		const internal = async () => [{ address: '10.0.0.5', family: 4 }];
		const publicHost = async () => [{ address: '93.184.216.34', family: 4 }];
		assert.equal(await isPublicEndpoint('https://spec-intern.invalid/v1', internal), false);
		assert.equal(await isPublicEndpoint('https://spec-oeffentlich.invalid/v1', publicHost), true);
	});
});

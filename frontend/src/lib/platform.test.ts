import { afterEach, describe, expect, it, vi } from 'vitest';
import { getChannel, isNativeChannel } from './platform';

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('getChannel', () => {
	it('ist web ohne Capacitor-Bridge', () => {
		expect(getChannel()).toBe('web');
		expect(isNativeChannel()).toBe(false);
	});

	it('ordnet Android dem Kanal play und iOS dem Kanal appstore zu', () => {
		vi.stubGlobal('Capacitor', { getPlatform: () => 'android' });
		expect(getChannel()).toBe('play');
		expect(isNativeChannel()).toBe(true);
		vi.stubGlobal('Capacitor', { getPlatform: () => 'ios' });
		expect(getChannel()).toBe('appstore');
	});

	it('lässt sich für Tests überschreiben', () => {
		vi.stubGlobal('__PP_CHANNEL__', 'play');
		expect(getChannel()).toBe('play');
	});
});

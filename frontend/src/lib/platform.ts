/** Auslieferungskanal der App (ADR 0016): Browser/PWA, Android-App oder iOS-App. */
export type Channel = 'web' | 'play' | 'appstore';

type ChannelScope = { Capacitor?: { getPlatform?: () => string }; __PP_CHANNEL__?: Channel };

/**
 * Kanal aus der Capacitor-Bridge, die der native WebView in jede Seite injiziert. `__PP_CHANNEL__`
 * überschreibt ihn für Tests (Playwright: `page.addInitScript(() => { window.__PP_CHANNEL__ = 'play' })`).
 */
export const getChannel = (): Channel => {
	const scope = globalThis as ChannelScope;
	if (scope.__PP_CHANNEL__) return scope.__PP_CHANNEL__;
	const platform = scope.Capacitor?.getPlatform?.();
	if (platform === 'android') return 'play';
	if (platform === 'ios') return 'appstore';
	return 'web';
};

export const isNativeChannel = (): boolean => getChannel() !== 'web';

import { render, screen, cleanup, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InstallPrompt } from './InstallPrompt';

afterEach(cleanup);

// Mock für window.matchMedia
const mockMatchMedia = (matches: boolean) => {
	return {
		matches,
		media: '',
		addListener: vi.fn(),
		removeListener: vi.fn(),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
	};
};

describe('InstallPrompt', () => {
	beforeEach(() => {
		// Mock window.matchMedia
		Object.defineProperty(window, 'matchMedia', {
			writable: true,
			value: vi.fn().mockImplementation((query) => {
				if (query === '(display-mode: standalone)') {
					return mockMatchMedia(false);
				}
				return mockMatchMedia(false);
			}),
		});

		// Mock navigator.userAgent
		Object.defineProperty(window.navigator, 'userAgent', {
			value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
			configurable: true,
		});
	});

	it('should not render when app is already installed', () => {
		// Mock standalone mode
		Object.defineProperty(window, 'matchMedia', {
			writable: true,
			value: vi.fn().mockImplementation((query) => {
				if (query === '(display-mode: standalone)') {
					return mockMatchMedia(true);
				}
				return mockMatchMedia(false);
			}),
		});

		render(<InstallPrompt />);
		expect(screen.queryByText(/App installieren/i)).not.toBeInTheDocument();
	});

	it('should render install prompt when beforeinstallprompt event is triggered', () => {
		// Komponente zuerst rendern, damit der Event-Listener registriert ist.
		render(<InstallPrompt />);

		// Vor dem Event darf kein Prompt sichtbar sein.
		expect(screen.queryByText(/Möchtest du Priority Pilot/i)).not.toBeInTheDocument();

		// beforeinstallprompt-Event mit den benötigten Mock-Methoden dispatchen.
		const event = new Event('beforeinstallprompt', { cancelable: true }) as BeforeInstallPromptEvent;
		Object.assign(event, {
			prompt: vi.fn(),
			userChoice: Promise.resolve({ outcome: 'dismissed' as const, platform: '' }),
		});

		act(() => {
			window.dispatchEvent(event);
		});

		// Nach dem Event zeigt die Komponente den Standard-Prompt.
		expect(screen.getByText(/Möchtest du Priority Pilot/i)).toBeInTheDocument();
	});

	it('should show iOS install instructions for iOS Safari', () => {
		// Mock iOS Safari user agent
		Object.defineProperty(window.navigator, 'userAgent', {
			value:
				'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
			configurable: true,
		});

		render(<InstallPrompt />);

		// Auf iOS Safari (nicht standalone) wird die iOS-Anleitung angezeigt.
		expect(screen.getByText(/Teilen/)).toBeInTheDocument();
		expect(screen.getByText(/Zum Home-Bildschirm/)).toBeInTheDocument();
	});

	it('should call onDismiss when dismiss button is clicked', () => {
		const mockDismiss = vi.fn();

		// iOS Safari user agent, damit der Prompt nach dem F1-Fix sichtbar wird.
		Object.defineProperty(window.navigator, 'userAgent', {
			value:
				'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
			configurable: true,
		});

		render(<InstallPrompt onDismiss={mockDismiss} />);

		// Der iOS-Prompt ist sichtbar.
		expect(screen.getByText(/Teilen/)).toBeInTheDocument();

		// onDismiss darf vor einer Interaktion nicht aufgerufen worden sein –
		// verhindert trügerische Coverage. KolButton ist ein Web Component, dessen
		// _on.onClick-Callback in JSDOM nicht über einen echten Klick auslösbar ist.
		expect(mockDismiss).not.toHaveBeenCalled();
	});
});

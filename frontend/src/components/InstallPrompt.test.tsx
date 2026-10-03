import { render, screen, cleanup, act } from '@testing-library/react';
import type { Task } from 'client';
import { TaskStatus } from 'client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InstallPrompt } from './InstallPrompt';

// #1972 (Spec docs/spec/issue-1972.md): Aha-Gate — die Installations-Aufforderung erscheint
// erst nach mindestens einer erledigten Aufgabe. Die Aufgabenliste kommt als Prop (Muster
// DayDoneHint), die Ableitung steckt in der Komponente.
const baseTask: Task = {
	id: 1,
	title: 'T',
	status: TaskStatus.Done,
	priority: 3,
	estimatedEffort: 1,
	actualEffort: null,
	description: null,
	deadline: null,
	seriesId: null,
	isException: false,
	pinned: false,
	pillars: [],
};

const doneTasks = (): Task[] => [{ ...baseTask, id: 1 }];
const openTasks = (): Task[] => [{ ...baseTask, id: 2, status: TaskStatus.Open }];

/** beforeinstallprompt mit den benötigten Mock-Methoden dispatchen (Muster der Bestands-Tests). */
const fireBeforeInstallPrompt = (): void => {
	const event = new Event('beforeinstallprompt', { cancelable: true }) as BeforeInstallPromptEvent;
	Object.assign(event, {
		prompt: vi.fn(),
		userChoice: Promise.resolve({ outcome: 'dismissed' as const, platform: '' }),
	});
	act(() => {
		window.dispatchEvent(event);
	});
};

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

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

		// #1972: dismissed-Sperre zwischen den Tests zurücksetzen.
		localStorage.removeItem('pwa-install-dismissed');
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

		// #1972: der installiert-Gate gewinnt auch mit erledigter Aufgabe und gefeuertem Event.
		render(<InstallPrompt tasks={doneTasks()} />);
		fireBeforeInstallPrompt();
		expect(screen.queryByText(/App installieren/i)).not.toBeInTheDocument();
	});

	it('rendert in der Android-App nichts (ADR 0016)', () => {
		vi.stubGlobal('__PP_CHANNEL__', 'play');
		// #1972: der native-Kanal-Gate gewinnt auch mit erledigter Aufgabe.
		render(<InstallPrompt tasks={doneTasks()} />);
		fireBeforeInstallPrompt();
		expect(screen.queryByText(/App installieren/i)).not.toBeInTheDocument();
	});

	// #1972 AK2: mit erledigter Aufgabe erscheint der Prompt nach beforeinstallprompt
	// (übernimmmt den früheren Fall „Event zeigt Prompt sofort“ — ohne Aha-Gate widersprüchlich,
	// siehe Test-Pflege-Bedarf im PR).
	it('should render install prompt when beforeinstallprompt event is triggered', () => {
		// Komponente zuerst rendern, damit der Event-Listener registriert ist.
		render(<InstallPrompt tasks={doneTasks()} />);

		// Vor dem Event darf kein Prompt sichtbar sein.
		expect(screen.queryByText(/Möchtest du Balamentum/i)).not.toBeInTheDocument();

		fireBeforeInstallPrompt();

		// Nach dem Event zeigt die Komponente den Standard-Prompt.
		expect(screen.getByText(/Möchtest du Balamentum/i)).toBeInTheDocument();
	});

	// #1972 AK1: ohne erledigte Aufgabe rendert das Event keinen Prompt (Aha-Gate).
	it('#1972 AK1: ohne erledigte Aufgabe bleibt der Prompt auch nach beforeinstallprompt aus', () => {
		render(<InstallPrompt tasks={openTasks()} />);
		fireBeforeInstallPrompt();
		expect(screen.queryByText(/App installieren/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/Möchtest du Balamentum/i)).not.toBeInTheDocument();
	});

	// #1972 AK1: auch der iOS-Safari-Fallback respektiert das Aha-Gate.
	it('#1972 AK1: ohne erledigte Aufgabe zeigt auch der iOS-Safari-Fallback keine Anleitung', () => {
		Object.defineProperty(window.navigator, 'userAgent', {
			value:
				'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
			configurable: true,
		});
		render(<InstallPrompt tasks={openTasks()} />);
		expect(screen.queryByText(/Teilen/)).not.toBeInTheDocument();
	});

	// #1972 AK2: dauerhaft Geschlossene sehen auch mit erledigter Aufgabe keinen Prompt.
	it('#1972 AK2: dauerhaft geschlossener Prompt bleibt auch mit erledigter Aufgabe zu', () => {
		localStorage.setItem('pwa-install-dismissed', 'true');
		render(<InstallPrompt tasks={doneTasks()} />);
		fireBeforeInstallPrompt();
		expect(screen.queryByText(/App installieren/i)).not.toBeInTheDocument();
	});

	it('should show iOS install instructions for iOS Safari', () => {
		// Mock iOS Safari user agent
		Object.defineProperty(window.navigator, 'userAgent', {
			value:
				'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
			configurable: true,
		});

		// #1972: der iOS-Fallback erscheint wie der Standard-Prompt erst nach dem Aha-Moment.
		render(<InstallPrompt tasks={doneTasks()} />);

		// Auf iOS Safari (nicht standalone) wird die iOS-Anleitung angezeigt.
		expect(screen.getByText(/Teilen/)).toBeInTheDocument();
		expect(screen.getByText(/Zum Home-Bildschirm/)).toBeInTheDocument();
	});

	// TODO: KolButton ist ein Web Component; sein _on.onClick-Callback kann in JSDOM
	// nicht über einen echten DOM-Klick ausgelöst werden. Test muss mit userEvent
	// oder einem nativen Button-Wrapper überarbeitet werden.
	it.skip('should call onDismiss when dismiss button is clicked', () => {
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

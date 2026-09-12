import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PushToast } from './PushToast';

/**
 * Rote Spec-Tests (#1391, docs/spec/issue-1391.md TF2/AK2) für den In-App-Hinweis auf eine
 * `message`-Event-Payload des Service Workers.
 *
 * jsdom liefert kein `navigator.serviceWorker` — wir setzen für diese Suite einen echten
 * `EventTarget`-Stub ein (Vorbild `UpdatePrompt.test.tsx` #1095) und dispatchen ein
 * `MessageEvent('message', { data: { type: 'push', payload } })`, wie es `push-sw.js` an alle
 * offenen Fenster-Clients sendet (`client.postMessage`).
 */

vi.mock('@public-ui/react-v19', () => ({
	KolAlert: ({
		_label,
		children,
		_hasCloser,
		_on,
	}: {
		_label?: string;
		children?: ReactNode;
		_hasCloser?: boolean;
		_on?: { onCloserClick?: () => void };
	}) => (
		<div role="alert" data-comp="kol-alert" data-testid="push-toast" data-label={_label}>
			{children}
			{_hasCloser && (
				<button data-testid="push-toast-close" aria-label="Schließen" onClick={() => _on?.onCloserClick?.()}>
					×
				</button>
			)}
		</div>
	),
}));

describe('PushToast — In-App-Hinweis bei Service-Worker-message (#1391)', () => {
	let serviceWorkerStub: EventTarget;

	const dispatchPush = (payload: { title: string; body?: string }): void => {
		serviceWorkerStub.dispatchEvent(new MessageEvent('message', { data: { type: 'push', payload } }));
	};

	beforeEach(() => {
		serviceWorkerStub = new EventTarget();
		Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: serviceWorkerStub });
	});

	afterEach(() => {
		Reflect.deleteProperty(navigator, 'serviceWorker');
		cleanup();
	});

	// AK2 — kein Hinweis vor dem ersten push-Event.
	it('AK2: ohne push-Event ist kein Hinweis im DOM', () => {
		render(<PushToast />);

		expect(screen.queryByTestId('push-toast')).not.toBeInTheDocument();
	});

	// AK2 — push-Event zeigt Titel und Text des Hinweises.
	it('AK2: message-Event mit type "push" zeigt Titel und Body des Hinweises', () => {
		render(<PushToast />);

		dispatchPush({ title: 'Aufgabe erledigt', body: 'Bob Empfänger hat „Rasen mähen" erledigt.' });

		const toast = screen.getByTestId('push-toast');
		expect(toast).toBeVisible();
		expect(toast).toHaveTextContent('Aufgabe erledigt');
		expect(toast).toHaveTextContent('Bob Empfänger hat „Rasen mähen" erledigt.');
	});

	// AK2 — Schließen entfernt den Hinweis vollständig aus dem DOM.
	it('AK2: Klick auf Schließen entfernt den Hinweis danach vollständig aus dem DOM', () => {
		render(<PushToast />);
		dispatchPush({ title: 'Aufgabe erledigt', body: 'Text' });
		expect(screen.getByTestId('push-toast')).toBeInTheDocument();

		fireEvent.click(screen.getByTestId('push-toast-close'));

		expect(screen.queryByTestId('push-toast')).not.toBeInTheDocument();
	});

	// AK2 — Nachrichten ohne passenden type lösen keinen Hinweis aus (kein Fehl-Trigger durch andere SW-Events).
	it('AK2: message-Event ohne type "push" zeigt keinen Hinweis', () => {
		render(<PushToast />);

		serviceWorkerStub.dispatchEvent(new MessageEvent('message', { data: { type: 'other', payload: {} } }));

		expect(screen.queryByTestId('push-toast')).not.toBeInTheDocument();
	});
});

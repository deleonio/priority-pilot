import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Rote Spec-Tests für #1231 (Spec docs/spec/issue-1231.md, AK1/AK2) — globaler
 * Session-Expired-Dialog.
 *
 * Der Dialog lauscht auf das `pp:session-expired`-Event aus `toApiError` (Ereignis-Vertrag
 * s. Spec) und bietet „Neu laden"/„Abbrechen" an. `Modal.tsx` ist gemockt (KolDialog/
 * customElements in JSDOM nicht hydrierbar); die KoliBri-Buttons folgen dem UpdatePrompt-
 * Muster: native Klick-Naht `data-testid="session-reload"`/`"session-cancel"`.
 */

vi.mock('./Modal', () => ({
	Modal: ({ title, children }: { title: string; children?: ReactNode }) =>
		createElement('div', { role: 'dialog', 'aria-label': title }, children),
}));

vi.mock('@public-ui/react-v19', () => ({
	KolButton: ({
		_label,
		_variant,
		_on,
	}: {
		_label?: string;
		_variant?: string;
		_on?: { onClick?: (_e: MouseEvent) => void };
	}) =>
		createElement(
			'button',
			{
				'data-variant': _variant,
				onClick: (e: React.MouseEvent<HTMLButtonElement>) => _on?.onClick?.(e.nativeEvent),
			},
			_label,
		),
}));

// Import NACH vi.mock — Komponente existiert noch nicht (legitimer erster roter Zustand).
import { SessionExpiredDialog } from './SessionExpiredDialog';

/** Event-Name laut Spec-Vertrag (apiError.ts feuert, hier simuliert). */
const SESSION_EXPIRED_EVENT = 'pp:session-expired';

let reloadMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
	reloadMock = vi.fn();
	// window.location.reload ist in jsdom nicht spypbar (#1095-Präzedenz) — Stub per stubGlobal.
	vi.stubGlobal('location', { reload: reloadMock });
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe('SessionExpiredDialog (#1231)', () => {
	it('AK1: ohne Event rendert der Dialog nichts', () => {
		const { container } = render(<SessionExpiredDialog />);
		expect(container).toBeEmptyDOMElement();
		expect(reloadMock).not.toHaveBeenCalled();
	});

	it('AK1: Session-Expired-Event öffnet genau einen Dialog mit Datenverlust-Hinweis', () => {
		render(<SessionExpiredDialog />);
		window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));

		const dialogs = screen.getAllByRole('dialog');
		expect(dialogs).toHaveLength(1);
		expect(dialogs[0]).toHaveAttribute('aria-label', 'Session abgelaufen');
		// KI-UX-Entscheidung 1: Reload benennt den Verlust ungespeicherter Änderungen.
		expect(dialogs[0]).toHaveTextContent(/ungespeicherte/i);
		expect(screen.getByTestId('session-reload')).toBeVisible();
		expect(screen.getByTestId('session-cancel')).toBeVisible();
	});

	it('AK1 (Dedup): wiederholte Events bei offenem Dialog stapeln nicht', () => {
		render(<SessionExpiredDialog />);
		window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
		window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
		window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));

		expect(screen.getAllByRole('dialog')).toHaveLength(1);
	});

	it('AK2: Klick auf „Neu laden" löst genau ein window.location.reload() aus', () => {
		render(<SessionExpiredDialog />);
		window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));

		expect(reloadMock).not.toHaveBeenCalled();
		fireEvent.click(screen.getByTestId('session-reload'));
		expect(reloadMock).toHaveBeenCalledTimes(1);
	});

	it('AK2: „Abbrechen" schließt den Dialog ohne Reload; ein Folge-Event öffnet erneut', async () => {
		render(<SessionExpiredDialog />);
		window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));

		fireEvent.click(screen.getByTestId('session-cancel'));

		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
		expect(reloadMock).not.toHaveBeenCalled();

		// Zustand zurückgesetzt: das nächste Session-401 öffnet wieder (kein Dauer-Stillstand).
		window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
		expect(screen.getAllByRole('dialog')).toHaveLength(1);
	});
});

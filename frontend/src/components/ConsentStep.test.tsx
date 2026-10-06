import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement, useState, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Zustimmungsschritt nach dem Login (#1901, docs/spec/issue-1901.md): „Weiter“ erst bei beiden
 * Haken (AK4), Link-Ziele (AK5).
 */

vi.mock('../api', () => ({ api: { acceptTerms: vi.fn() } }));

// KolDetails-Stub (Memory 2026-10-05): Kinder nur bei geöffnetem Zustand; Label ist der Schalter
// und meldet wie KoliBri `onToggle(event, open)`. Das Label liegt bewusst außerhalb eines <label>.
vi.mock('@public-ui/react-v19', () => ({
	KolDetails: ({
		_label,
		_open,
		_on,
		children,
	}: {
		_label?: string;
		_open?: boolean;
		_on?: { onToggle?: (event: Event, open: boolean) => void };
		children?: ReactNode;
	}) => {
		const [open, setOpen] = useState(_open === true);
		return createElement(
			'div',
			null,
			createElement(
				'span',
				{
					onClick: (event: MouseEvent) => {
						_on?.onToggle?.(event as unknown as Event, !open);
						setOpen(!open);
					},
				},
				_label,
			),
			open ? children : null,
		);
	},
}));

import { api } from '../api';
import { ConsentStep } from './ConsentStep';

const acceptTerms = vi.mocked(api.acceptTerms);

const weiter = (): HTMLButtonElement => screen.getByRole('button', { name: 'Weiter' }) as HTMLButtonElement;

describe('ConsentStep (#1901)', () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it('AK4: „Weiter“ ist erst nach beiden Haken aktiv', () => {
		render(<ConsentStep onAccepted={vi.fn()} />);
		const [terms, privacy] = screen.getAllByRole('checkbox');
		expect(weiter().disabled).toBe(true);
		fireEvent.click(terms);
		expect(weiter().disabled).toBe(true);
		fireEvent.click(privacy);
		expect(weiter().disabled).toBe(false);
		fireEvent.click(privacy);
		expect(weiter().disabled).toBe(true);
	});

	it('AK4: „Weiter“ speichert die Zustimmung und meldet Erfolg', async () => {
		acceptTerms.mockResolvedValue(undefined);
		const onAccepted = vi.fn();
		render(<ConsentStep onAccepted={onAccepted} />);
		screen.getAllByRole('checkbox').forEach((box) => fireEvent.click(box));
		fireEvent.click(weiter());
		await waitFor(() => expect(onAccepted).toHaveBeenCalledTimes(1));
		expect(acceptTerms).toHaveBeenCalledTimes(1);
	});

	it('Fehler beim Speichern: Meldung, Haken bleiben, kein Erfolg', async () => {
		acceptTerms.mockRejectedValue(new Error('boom'));
		const onAccepted = vi.fn();
		render(<ConsentStep onAccepted={onAccepted} />);
		const boxes = screen.getAllByRole('checkbox');
		boxes.forEach((box) => fireEvent.click(box));
		fireEvent.click(weiter());
		await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
		expect(onAccepted).not.toHaveBeenCalled();
		boxes.forEach((box) => expect((box as HTMLInputElement).checked).toBe(true));
	});
});

/**
 * Rechtstexte im Schritt lesen (#2227, docs/spec/issue-1901.md „Rechtstexte im Schritt lesen"):
 * statt Links in neuem Tab je ein Aufklapp-Bereich, der die Website-Seite same-origin lädt.
 */
describe('ConsentStep — Rechtstexte lesen (#2227)', () => {
	const PAGE = (body: string): string =>
		`<html><body><header>Website-Kopf</header><main id="main"><h1>Titel</h1>${body}</main><footer>Website-Fuss</footer></body></html>`;

	const fetchMock = vi.fn();

	const respond = (html: string): void => {
		fetchMock.mockImplementation(() => Promise.resolve(new Response(html, { status: 200 })));
	};

	beforeEach(() => {
		vi.stubGlobal('fetch', fetchMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		fetchMock.mockReset();
		vi.clearAllMocks();
	});

	const open = (label: RegExp): void => {
		fireEvent.click(screen.getByText(label));
	};
	const fetchedUrls = (): string[] => fetchMock.mock.calls.map((call) => String(call[0]));

	it('AK1/AK2: Aufklappen lädt die Website-Seite und zeigt nur den Inhalt von main#main', async () => {
		respond(PAGE('<p>Konto-Text</p>'));
		const { container } = render(<ConsentStep onAccepted={vi.fn()} />);
		expect(fetchMock).not.toHaveBeenCalled();
		open(/Nutzungsbedingungen lesen/);
		expect(await screen.findByText('Konto-Text')).toBeTruthy();
		expect(fetchedUrls()).toEqual(['/nutzungsbedingungen/']);
		expect(screen.queryByText('Website-Kopf')).toBeNull();
		expect(screen.queryByText('Website-Fuss')).toBeNull();
		expect(container.querySelector('a[target="_blank"]')).toBeNull();
		expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
	});

	it('AK2: Datenschutzerklärung lädt /datenschutz/; erneutes Aufklappen lädt nicht neu', async () => {
		respond(PAGE('<p>Daten-Text</p>'));
		render(<ConsentStep onAccepted={vi.fn()} />);
		open(/Datenschutzerklärung lesen/);
		expect(await screen.findByText('Daten-Text')).toBeTruthy();
		open(/Datenschutzerklärung lesen/);
		open(/Datenschutzerklärung lesen/);
		expect(await screen.findByText('Daten-Text')).toBeTruthy();
		expect(fetchedUrls()).toEqual(['/datenschutz/']);
	});

	it.each([
		['Netzfehler', () => Promise.reject(new Error('offline'))],
		['Status 404', () => Promise.resolve(new Response('nope', { status: 404 }))],
	])('AK3: %s zeigt Hinweis mit Ausweichlink, Haken bleiben bedienbar', async (_name, impl) => {
		fetchMock.mockImplementation(impl);
		render(<ConsentStep onAccepted={vi.fn()} />);
		open(/Nutzungsbedingungen lesen/);
		const alert = await screen.findByRole('alert');
		const fallback = within(alert).getByRole('link');
		expect(fallback.getAttribute('href')).toBe('/nutzungsbedingungen/');
		expect(fallback.getAttribute('target')).toBe('_blank');
		const [terms] = screen.getAllByRole('checkbox') as HTMLInputElement[];
		fireEvent.click(terms);
		expect(terms.checked).toBe(true);
	});

	it('AK4: Öffnen und Schließen ändert weder Haken noch „Weiter“', async () => {
		respond(PAGE('<p>Konto-Text</p>'));
		render(<ConsentStep onAccepted={vi.fn()} />);
		const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
		open(/Nutzungsbedingungen lesen/);
		await screen.findByText('Konto-Text');
		expect(boxes.map((box) => box.checked)).toEqual([false, false]);
		boxes.forEach((box) => fireEvent.click(box));
		expect(weiter().disabled).toBe(false);
		open(/Nutzungsbedingungen lesen/);
		open(/Datenschutzerklärung lesen/);
		expect(boxes.map((box) => box.checked)).toEqual([true, true]);
		expect(weiter().disabled).toBe(false);
	});
});

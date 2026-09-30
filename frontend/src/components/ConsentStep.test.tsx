import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Zustimmungsschritt nach dem Login (#1901, docs/spec/issue-1901.md): „Weiter“ erst bei beiden
 * Haken (AK4), Link-Ziele (AK5).
 */

vi.mock('../api', () => ({ api: { acceptTerms: vi.fn() } }));

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

	it('AK5: Links zeigen auf Nutzungsbedingungen und Datenschutzerklärung (neuer Tab)', () => {
		render(<ConsentStep onAccepted={vi.fn()} />);
		const terms = screen.getByRole('link', { name: /Nutzungsbedingungen/ });
		const privacy = screen.getByRole('link', { name: /Datenschutzerklärung/ });
		expect(terms.getAttribute('href')).toBe('/nutzungsbedingungen/');
		expect(privacy.getAttribute('href')).toBe('/datenschutz/');
		expect(terms.getAttribute('target')).toBe('_blank');
		expect(privacy.getAttribute('target')).toBe('_blank');
	});
});

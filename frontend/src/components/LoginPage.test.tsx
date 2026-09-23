import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Login-Seite mit Magic Link per E-Mail: Das Formular erscheint nur, wenn die Instanz den
 * Anmeldeweg anbietet (`GET /auth/providers`), und meldet Erfolg bzw. Fehler beim Anfordern.
 */

vi.mock('../api', () => ({
	api: {
		getAuthProviders: vi.fn(),
		requestMagicLink: vi.fn(),
	},
}));

import { api } from '../api';
import { LoginPage } from './LoginPage';

const providers = vi.mocked(api.getAuthProviders);
const requestMagicLink = vi.mocked(api.requestMagicLink);

describe('LoginPage — Magic Link per E-Mail', () => {
	beforeEach(() => {
		window.history.replaceState(null, '', '/app/');
	});
	afterEach(() => {
		vi.clearAllMocks();
	});

	it('zeigt ohne konfigurierten Magic Link nur den Google-Button', async () => {
		providers.mockResolvedValue({ google: true, magicLink: false });
		render(<LoginPage />);
		await waitFor(() => expect(providers).toHaveBeenCalled());
		expect(screen.getByRole('button', { name: /Login with Google/i })).toBeTruthy();
		expect(screen.queryByLabelText('Anmeldelink per E-Mail')).toBeNull();
	});

	it('fordert den Link an und bestätigt den Versand', async () => {
		providers.mockResolvedValue({ google: true, magicLink: true });
		requestMagicLink.mockResolvedValue(undefined);
		render(<LoginPage />);

		fireEvent.change(await screen.findByLabelText('Anmeldelink per E-Mail'), {
			target: { value: 'ich@example.com' },
		});
		fireEvent.click(screen.getByRole('button', { name: 'Anmeldelink senden' }));

		expect((await screen.findByRole('status')).textContent).toMatch(/Anmeldelink unterwegs/);
		expect(requestMagicLink).toHaveBeenCalledWith('ich@example.com');
	});

	it('meldet einen gescheiterten Versand', async () => {
		providers.mockResolvedValue({ google: true, magicLink: true });
		requestMagicLink.mockRejectedValue(new Error('429'));
		render(<LoginPage />);

		fireEvent.change(await screen.findByLabelText('Anmeldelink per E-Mail'), {
			target: { value: 'ich@example.com' },
		});
		fireEvent.click(screen.getByRole('button', { name: 'Anmeldelink senden' }));

		expect((await screen.findByRole('alert')).textContent).toMatch(/nicht angefordert werden/);
	});

	it('zeigt die Meldung für einen abgelaufenen Link aus ?error=magic_link_invalid', async () => {
		providers.mockResolvedValue({ google: true, magicLink: true });
		window.history.replaceState(null, '', '/app/?error=magic_link_invalid');
		render(<LoginPage />);
		expect(screen.getByRole('alert').textContent).toMatch(/abgelaufen oder wurde schon benutzt/);
		await waitFor(() => expect(providers).toHaveBeenCalled());
	});
});

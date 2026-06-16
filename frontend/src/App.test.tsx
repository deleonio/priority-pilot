import { cleanup, render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

// vi.mock wird von Vitest über die Imports gehoben; die Referenz muss daher via vi.hoisted kommen.
const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));

// KoliBri-Web-Components durch schlanke Passthroughs ersetzen — geprüft wird die App-Logik,
// nicht das Rendering der Web-Components in jsdom.
vi.mock('@public-ui/react-v19', () => ({
	KolHeading: ({ _label }: { _label?: string }) => <h1>{_label}</h1>,
	KolAlert: ({ children }: { children?: ReactNode }) => <div role="alert">{children}</div>,
}));

// API mocken, damit der Smoke-Test ohne Server/Netzwerk läuft.
vi.mock('./api', () => ({ api: { GET: mockGet } }));

afterEach(() => {
	cleanup();
	mockGet.mockReset();
});

describe('App', () => {
	it('lädt Tasks über GET /tasks und zeigt sie an', async () => {
		mockGet.mockResolvedValue({
			data: [{ id: 1, title: 'Demo-Task', status: 'Open', priority: 3, estimatedEffort: 0.5 }],
			error: undefined,
			response: { ok: true, status: 200 },
		});

		const { container } = render(<App />);
		expect(container.textContent).toContain('Priority Pilot');

		await waitFor(() => {
			expect(container.textContent).toContain('Demo-Task');
		});
		expect(mockGet).toHaveBeenCalledWith('/tasks', expect.objectContaining({ signal: expect.any(AbortSignal) }));
	});

	it('zeigt eine Fehlermeldung bei nicht-ok Response', async () => {
		mockGet.mockResolvedValue({ data: undefined, error: undefined, response: { ok: false, status: 500 } });

		const { container } = render(<App />);

		await waitFor(() => {
			expect(container.textContent).toContain('HTTP 500');
		});
	});
});

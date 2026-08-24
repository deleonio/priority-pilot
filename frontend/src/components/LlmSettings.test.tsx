import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { LlmProvider } from 'client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LlmSettings } from './LlmSettings';

/**
 * Vertrag der LLM-Einstellungen (Settings-Tab „KI-Provider“): Radio-Auswahl genau eines
 * Providers, Modellwahl aus der Modellliste des aktiven Providers und die Fixheit der
 * Built-ins (Mistral/OpenRouter: kein Bearbeiten/Löschen, Key aus Server-ENV).
 */

const { listMock, modelsMock, updateMock, activateMock } = vi.hoisted(() => ({
	listMock: vi.fn(),
	modelsMock: vi.fn(),
	updateMock: vi.fn(),
	activateMock: vi.fn(),
}));

vi.mock('../api', () => ({
	api: new Proxy(
		{},
		{
			get: (_target, prop) =>
				prop === 'listLlmProviders'
					? listMock
					: prop === 'listLlmProviderModels'
						? modelsMock
						: prop === 'updateLlmProvider'
							? updateMock
							: prop === 'activateLlmProvider'
								? activateMock
								: vi.fn().mockResolvedValue(undefined),
		},
	),
}));

// KoliBri-Komponenten sind nicht jsdom-kompatibel (Custom Elements, Shadow DOM) — native
// Ersatzelemente nach dem Muster von PillarList.test.tsx, damit Rollen-Queries funktionieren.
vi.mock('@public-ui/react-v19', () => ({
	KolAlert: ({ _label, children }: { _label?: string; children?: ReactNode }) => (
		<div role="alert">
			{_label} {children}
		</div>
	),
	KolButton: ({
		_label,
		_disabled,
		_on,
	}: {
		_label?: string;
		_disabled?: boolean;
		_on?: { onClick?: (_e: MouseEvent) => void };
	}) => (
		<button disabled={_disabled} onClick={(e) => _on?.onClick?.(e.nativeEvent)}>
			{_label}
		</button>
	),
	KolInputRadio: ({ _label }: { _label?: string }) => <fieldset aria-label={_label} />,
}));

const mistral: LlmProvider = {
	id: 1,
	name: 'Mistral',
	endpoint: 'https://api.mistral.ai/v1',
	model: 'mistral-medium-latest',
	isActive: true,
	kind: 'builtin',
	hasApiKey: true,
};
const openrouter: LlmProvider = {
	id: 2,
	name: 'OpenRouter',
	endpoint: 'https://openrouter.ai/api/v1',
	model: 'openrouter/free',
	isActive: false,
	kind: 'builtin',
	hasApiKey: false,
};
const custom: LlmProvider = {
	id: 3,
	name: 'z.ai',
	endpoint: 'https://api.z.ai/v1',
	model: '',
	isActive: false,
	kind: 'custom',
	hasApiKey: true,
};

beforeEach(() => {
	listMock.mockResolvedValue([mistral, openrouter, custom]);
	modelsMock.mockResolvedValue({ models: [{ id: 'mistral-large-latest', name: 'Mistral Large' }] });
	activateMock.mockImplementation(async ({ id }: { id: number }) => ({ ...mistral, id, isActive: true }));
	updateMock.mockImplementation(async ({ id, input }: { id: number; input: { model?: string } }) => ({
		...mistral,
		id,
		model: input.model ?? 'mistral-medium-latest',
	}));
});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe('LlmSettings — Built-ins sind fix', () => {
	it('rendert Mistral/OpenRouter ohne Bearbeiten/Löschen, Custom-Provider mit beiden', async () => {
		render(<LlmSettings />);

		await waitFor(() => expect(screen.getByText('Provider verwalten')).toBeInTheDocument());

		// Genau EIN „Bearbeiten“/„Löschen“-Paar — nur für den Custom-Provider.
		expect(screen.getAllByRole('button', { name: 'Bearbeiten' })).toHaveLength(1);
		expect(screen.getAllByRole('button', { name: 'Löschen' })).toHaveLength(1);
		expect(screen.getAllByText(/fix, Key aus Server-ENV/)).toHaveLength(2);
	});
});

describe('LlmSettings — Modellwahl des aktiven Providers', () => {
	it('lädt die Modelle des aktiven Providers und speichert die Wahl über PUT', async () => {
		render(<LlmSettings />);

		await waitFor(() => expect(document.querySelector('#llm-active-model')).not.toBeNull());
		const select = document.querySelector<HTMLSelectElement>('#llm-active-model');
		if (select === null) throw new Error('Modell-Select fehlt');
		expect(modelsMock).toHaveBeenCalledWith({ id: mistral.id, signal: expect.anything() });
		expect(select.value).toBe('mistral-medium-latest');

		// Die gewählte Option muss in der Liste stehen — sonst springt das Select still um.
		const option = Array.from(select.options).find((o) => o.value === 'mistral-large-latest');
		expect(option).toBeDefined();
		fireEvent.change(select, { target: { value: 'mistral-large-latest' } });

		await waitFor(() =>
			expect(updateMock).toHaveBeenCalledWith({ id: mistral.id, input: { model: 'mistral-large-latest' } }),
		);
		await waitFor(() => expect(select.value).toBe('mistral-large-latest'));
	});

	it('zeigt den Bereitschafts-Hinweis, wenn Key UND Modell vorhanden sind', async () => {
		render(<LlmSettings />);
		await waitFor(() => expect(screen.getByText(/KI-Features bereit/)).toBeInTheDocument());
	});

	it('warnt, wenn der aktive Provider ohne ENV-Key ist', async () => {
		listMock.mockResolvedValue([{ ...mistral, isActive: true, hasApiKey: false }]);

		render(<LlmSettings />);
		await waitFor(() => expect(screen.getByText(/kein API-Key auf dem Server hinterlegt/)).toBeInTheDocument());
	});
});

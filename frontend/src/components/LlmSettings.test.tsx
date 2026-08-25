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

const { listMock, modelsMock, updateMock, activateMock, testMock } = vi.hoisted(() => ({
	listMock: vi.fn(),
	modelsMock: vi.fn(),
	updateMock: vi.fn(),
	activateMock: vi.fn(),
	testMock: vi.fn(),
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
								: prop === 'testLlmProvider'
									? testMock
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
	// KolSingleSelect als natives <select> mit stabiler id — die Modellwahl-Tests greifen
	// darauf über `#llm-active-model` zu (Muster wie TaskForm.test.tsx).
	KolSingleSelect: ({
		_label,
		_options,
		_value,
		_on,
	}: {
		_label?: string;
		_options?: { label: string; value: string }[];
		_value?: string;
		_on?: { onChange?: (_e: unknown, v: string) => void };
	}) => (
		<select
			id="llm-active-model"
			aria-label={_label}
			value={_value ?? ''}
			onChange={(e) => _on?.onChange?.(e.nativeEvent, e.target.value)}
		>
			{(_options ?? []).map((option) => (
				<option key={option.value} value={option.value}>
					{option.label}
				</option>
			))}
		</select>
	),
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

	it('readiness: konfiguriert + Test ok → grün mit „getestet“', async () => {
		testMock.mockResolvedValue({ ok: true, model: 'mistral-medium-latest', latencyMs: 210, sample: '{"ok": true}' });
		render(<LlmSettings />);
		await waitFor(() => expect(screen.getByText('Provider verwalten')).toBeInTheDocument());

		fireEvent.click(screen.getAllByRole('button', { name: 'Testen' })[0]);
		await waitFor(() => expect(screen.getByText(/getestet, 210 ms/)).toBeInTheDocument());
	});

	it('readiness: konfiguriert, aber Test schlägt fehl → roter Hinweis mit Ursache', async () => {
		testMock.mockResolvedValue({ ok: false, message: 'Mistral antwortete mit HTTP 402: Check your subscription' });
		render(<LlmSettings />);
		await waitFor(() => expect(screen.getByText('Provider verwalten')).toBeInTheDocument());

		fireEvent.click(screen.getAllByRole('button', { name: 'Testen' })[0]);
		await waitFor(() => expect(screen.getByText(/KI-Features schlagen derzeit fehl/)).toBeInTheDocument());
		// Ursache erscheint doppelt (inline Test-Ergebnis + readiness-Hinweis) — beides gewollt.
		expect(screen.getAllByText(/Check your subscription/).length).toBeGreaterThanOrEqual(2);
	});

	it('readiness: konfiguriert, noch ungetestet → blauer Hinweis mit Testen-Hinweis', async () => {
		render(<LlmSettings />);
		await waitFor(() => expect(screen.getByText(/KI-Features bereit \(noch ungetestet\)/)).toBeInTheDocument());
	});

	it('warnt, wenn der aktive Provider ohne ENV-Key ist', async () => {
		listMock.mockResolvedValue([{ ...mistral, isActive: true, hasApiKey: false }]);

		render(<LlmSettings />);
		await waitFor(() => expect(screen.getByText(/kein API-Key auf dem Server hinterlegt/)).toBeInTheDocument());
	});
});

describe('LlmSettings — Test-Prompt je Provider', () => {
	it('Testen-Button je Provider-Zeile: Erfolg zeigt Latenz-Alert mit Antwort-Auszug', async () => {
		testMock.mockResolvedValue({ ok: true, model: 'mistral-medium-latest', latencyMs: 321, sample: '{"ok": true}' });
		render(<LlmSettings />);
		await waitFor(() => expect(screen.getByText('Provider verwalten')).toBeInTheDocument());

		// Ein Testen-Button je Provider (2 Built-ins + 1 Custom).
		expect(screen.getAllByRole('button', { name: 'Testen' })).toHaveLength(3);
		fireEvent.click(screen.getAllByRole('button', { name: 'Testen' })[0]);

		await waitFor(() => expect(testMock).toHaveBeenCalledWith({ id: mistral.id }));
		await waitFor(() => expect(screen.getByText(/Test erfolgreich \(321 ms\)/)).toBeInTheDocument());
		await waitFor(() => expect(screen.getByText(/„\{"ok": true\}“/)).toBeInTheDocument());
	});

	it('Testen-Button: Misserfolg zeigt die konkrete Ursache (z. B. totes Abo)', async () => {
		testMock.mockResolvedValue({
			ok: false,
			message: 'Mistral antwortete mit HTTP 402: Check your subscription on https://admin.mistral.ai/subscription',
		});
		render(<LlmSettings />);
		await waitFor(() => expect(screen.getByText('Provider verwalten')).toBeInTheDocument());

		fireEvent.click(screen.getAllByRole('button', { name: 'Testen' })[0]);

		await waitFor(() => expect(screen.getAllByText(/Test fehlgeschlagen/).length).toBeGreaterThanOrEqual(1));
		await waitFor(() => expect(screen.getAllByText(/Check your subscription/).length).toBeGreaterThanOrEqual(1));
	});
});

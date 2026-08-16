import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { LlmConfigStatus } from 'client';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import { ModelSelectionDialog } from './ModelSelectionDialog';

/**
 * Tests für `ModelSelectionDialog` (#742): dynamische Free-Modell-Liste, Default-Auswahl aus
 * `GET /llm-config`, Persistenz über `PUT /llm-config` nur bei echtem Wechsel (Env-Pin-Guard),
 * Callback nach Speichern und Fehlerfälle je Ladestrom.
 *
 * Testebene: Vitest-Komponententest mit gemockter API (kein Backend, kein OpenRouter). KoliBri-
 * Komponenten werden durch native Elemente ersetzt (keine Custom-Element-Registry im jsdom, Muster:
 * TaskForm.test.tsx). Modal (KolDialog) wird als Passthrough gemockt — sein Öffnen/_race-Verhalten
 * ist separat durch die e2e-Suite abgedeckt.
 */

vi.mock('@public-ui/react-v19', () => ({
	KolAlert: ({ children }: { children?: ReactNode }) => <div role="alert">{children}</div>,
	KolButton: ({
		_label,
		_disabled,
		_on,
	}: {
		_label?: string;
		_disabled?: boolean;
		_on?: { onClick?: (event: unknown) => void };
	}) => (
		<button type="button" disabled={_disabled === true} onClick={(event) => _on?.onClick?.(event)}>
			{_label}
		</button>
	),
	KolSpin: () => <div role="status" />,
}));

vi.mock('./Modal', () => ({
	Modal: ({ children }: { children?: ReactNode }) => <div role="dialog">{children}</div>,
}));

vi.mock('../api', () => ({
	api: {
		getLlmConfig: vi.fn(),
		getFreeModels: vi.fn(),
		setLlmConfig: vi.fn(),
	},
}));

const MODELS = [
	{ id: 'openrouter/free', name: 'OpenRouter Free' },
	{ id: 'google/gemma-7b-it:free', name: 'Gemma 7B IT (Free)' },
	{ id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B Instruct (Free)' },
];

const statusWith = (openrouterModel: string): LlmConfigStatus => ({
	hasMistralApiKey: false,
	hasOpenrouterApiKey: false,
	openrouterModel,
});

beforeEach(() => {
	vi.mocked(api.getLlmConfig).mockResolvedValue(statusWith('openrouter/free'));
	vi.mocked(api.getFreeModels).mockResolvedValue({ models: MODELS.map((model) => ({ ...model })) });
	vi.mocked(api.setLlmConfig).mockImplementation(async ({ llmConfig }) => statusWith(llmConfig.openrouterModel ?? ''));
});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

const itemByModelId = (id: string): HTMLElement => {
	const item = document.querySelector(`[data-model-id="${id}"]`);
	if (item === null) throw new Error(`Kein Listen-Eintrag für ${id}`);
	return item as HTMLElement;
};

describe('ModelSelectionDialog (#742)', () => {
	it('zeigt die dynamische Liste und selektiert den Default openrouter/free', async () => {
		render(<ModelSelectionDialog onClose={vi.fn()} />);

		await waitFor(() => {
			expect(screen.getByTestId('free-models-list')).toBeInTheDocument();
		});
		expect(document.querySelectorAll('[data-testid="free-model-item"]')).toHaveLength(3);
		expect(itemByModelId('openrouter/free').getAttribute('data-selected')).toBe('true');
		expect(itemByModelId('google/gemma-7b-it:free').getAttribute('data-selected')).toBe('false');
		expect(screen.getByTestId('current-model-display').textContent).toContain('openrouter/free');
	});

	it('speichert eine andere Auswahl per PUT /llm-config und zeigt sie an', async () => {
		const onModelSaved = vi.fn();
		render(<ModelSelectionDialog onClose={vi.fn()} onModelSaved={onModelSaved} />);

		await waitFor(() => {
			expect(screen.getByTestId('free-models-list')).toBeInTheDocument();
		});
		fireEvent.click(itemByModelId('google/gemma-7b-it:free').querySelector('button') as HTMLButtonElement);

		await waitFor(() => {
			expect(api.setLlmConfig).toHaveBeenCalledWith({ llmConfig: { openrouterModel: 'google/gemma-7b-it:free' } });
		});
		expect(screen.getByTestId('current-model-display').textContent).toContain('google/gemma-7b-it:free');
		expect(itemByModelId('google/gemma-7b-it:free').getAttribute('data-selected')).toBe('true');
		expect(itemByModelId('openrouter/free').getAttribute('data-selected')).toBe('false');
		expect(onModelSaved).toHaveBeenCalledWith(statusWith('google/gemma-7b-it:free'));
	});

	it('sendet KEIN PUT, wenn das bereits gewählte Modell angeklickt wird (Env-Pin-Guard)', async () => {
		render(<ModelSelectionDialog onClose={vi.fn()} />);

		await waitFor(() => {
			expect(screen.getByTestId('free-models-list')).toBeInTheDocument();
		});
		fireEvent.click(itemByModelId('openrouter/free').querySelector('button') as HTMLButtonElement);

		expect(api.setLlmConfig).not.toHaveBeenCalled();
	});

	it('zeigt einen Fehler-Alert, wenn die Free-Modell-Liste nicht lädt', async () => {
		vi.mocked(api.getFreeModels).mockRejectedValue(new Error('Upstream weg'));
		render(<ModelSelectionDialog onClose={vi.fn()} />);

		await waitFor(() => {
			expect(screen.getByRole('alert')).toBeInTheDocument();
		});
		expect(screen.queryByTestId('free-models-list')).toBeNull();
		// Das aktuelle Modell bleibt trotzdem sichtbar — ein toter Upstream blockiert es nicht.
		expect(screen.getByTestId('current-model-display').textContent).toContain('openrouter/free');
	});

	it('zeigt einen Fehler-Alert, wenn das Speichern scheitert, und behält die alte Auswahl', async () => {
		vi.mocked(api.setLlmConfig).mockRejectedValue(new Error('save failed'));
		render(<ModelSelectionDialog onClose={vi.fn()} />);

		await waitFor(() => {
			expect(screen.getByTestId('free-models-list')).toBeInTheDocument();
		});
		fireEvent.click(itemByModelId('google/gemma-7b-it:free').querySelector('button') as HTMLButtonElement);

		await waitFor(() => {
			expect(screen.getByRole('alert')).toBeInTheDocument();
		});
		expect(screen.getByTestId('current-model-display').textContent).toContain('openrouter/free');
		expect(itemByModelId('openrouter/free').getAttribute('data-selected')).toBe('true');
	});
});

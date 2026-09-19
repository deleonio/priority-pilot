import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LlmProvider } from 'client';

/**
 * Rote Spec-Tests für #1577 — Testen-Schalter im Provider-Dialog
 * (Spec docs/spec/issue-1577.md, AK1–AK4).
 *
 * Muster: `GroupFormDialog.test.tsx` (Modal-Mock ohne Schließverhalten,
 * `useCtrlEnter` gestubbt, KoliBri durch native Elemente nachgebildet).
 */

vi.mock('@public-ui/react-v19', () => ({
	KolAlert: ({ _type, _label, children }: { _type?: string; _label?: string; children?: ReactNode }) => (
		<div role="alert" data-type={_type}>
			{_label}
			{children}
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
	KolInputText: ({
		_label,
		_value,
		_on,
	}: {
		_label?: string;
		_value?: string;
		_on?: { onInput?: (_e: unknown, v: string) => void; onChange?: (_e: unknown, v: string) => void };
	}) => (
		<input
			aria-label={_label}
			defaultValue={_value}
			onChange={(e) => {
				_on?.onInput?.(e.nativeEvent, e.target.value);
				_on?.onChange?.(e.nativeEvent, e.target.value);
			}}
		/>
	),
	KolInputPassword: ({
		_label,
		_value,
		_on,
	}: {
		_label?: string;
		_value?: string;
		_on?: { onInput?: (_e: unknown, v: string) => void; onChange?: (_e: unknown, v: string) => void };
	}) => (
		<input
			type="password"
			aria-label={_label}
			defaultValue={_value}
			onChange={(e) => {
				_on?.onInput?.(e.nativeEvent, e.target.value);
				_on?.onChange?.(e.nativeEvent, e.target.value);
			}}
		/>
	),
}));

vi.mock('./Modal', () => ({
	Modal: ({ title, children }: { title?: string; children?: ReactNode }) => (
		<div data-testid="modal">
			<h2>{title}</h2>
			{children}
		</div>
	),
}));

vi.mock('../lib/useCtrlEnter', () => ({ useCtrlEnter: () => undefined }));

vi.mock('../api', () => ({
	api: {
		createLlmProvider: vi.fn().mockResolvedValue({}),
		updateLlmProvider: vi.fn().mockResolvedValue({}),
		testLlmProviderDraft: vi.fn(),
	},
}));

import { api } from '../api';
import { LlmProviderFormDialog } from './LlmProviderFormDialog';

const draftMock = (api as unknown as { testLlmProviderDraft: ReturnType<typeof vi.fn> }).testLlmProviderDraft;

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

const editProvider = {
	id: 5,
	name: 'z.ai',
	endpoint: 'https://api.z.ai/v1',
	model: 'glm-4.7',
	isActive: false,
	kind: 'custom',
	hasApiKey: true,
	own: true,
} as unknown as LlmProvider;

/** Füllt die Dialog-Felder und klickt Testen (AK1: ohne Speichern). */
const fillAndTest = async (apiKey = 'key-neu-1577') => {
	fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'z.ai' } });
	fireEvent.change(screen.getByLabelText('Endpoint'), { target: { value: 'https://api.z.ai/v1' } });
	fireEvent.change(screen.getByLabelText('API-Key'), { target: { value: apiKey } });
	fireEvent.change(screen.getByLabelText('Modell'), { target: { value: 'glm-4.7' } });
	fireEvent.click(screen.getByRole('button', { name: 'Testen' }));
};

describe('LlmProviderFormDialog — Testen vor dem Speichern (#1577)', () => {
	it('AK1/AK3 (Anlegen): Testen ruft testLlmProviderDraft mit den Formulardaten auf, speichert nicht; Erfolg zeigt Latenz', async () => {
		draftMock.mockResolvedValue({ ok: true, model: 'glm-4.7', latencyMs: 123, sample: '{"ok": true}' });
		render(<LlmProviderFormDialog onClose={vi.fn()} onSaved={vi.fn()} />);

		fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'z.ai' } });
		fireEvent.change(screen.getByLabelText('Endpoint'), { target: { value: 'https://api.z.ai/v1' } });
		fireEvent.change(screen.getByLabelText('API-Key'), { target: { value: 'key-neu-1577' } });
		fireEvent.change(screen.getByLabelText('Modell'), { target: { value: 'glm-4.7' } });
		fireEvent.click(screen.getByRole('button', { name: 'Testen' }));

		await waitFor(() => {
			expect(draftMock).toHaveBeenCalledTimes(1);
		});
		expect(draftMock).toHaveBeenCalledWith(
			expect.objectContaining({
				endpoint: 'https://api.z.ai/v1',
				apiKey: 'key-neu-1577',
				model: 'glm-4.7',
			}),
		);
		expect(draftMock.mock.calls[0]?.[0]).not.toHaveProperty('providerId');

		// Der Test speichert nicht (AK3)
		expect(api.createLlmProvider).not.toHaveBeenCalled();
		expect(api.updateLlmProvider).not.toHaveBeenCalled();

		const alert = await screen.findByRole('alert');
		expect(alert.getAttribute('data-type')).toBe('success');
		// Erfolg nennt die Reaktionszeit in ms (AK3)
		expect(alert.textContent).toMatch(/123\s*ms/);
	});

	it('AK2 (Bearbeiten): leerer API-Key übergibt providerId — Server nutzt den gespeicherten Key', async () => {
		draftMock.mockResolvedValue({ ok: true, model: 'glm-4.7', latencyMs: 12 });
		render(<LlmProviderFormDialog provider={editProvider} onClose={vi.fn()} onSaved={vi.fn()} />);

		await fillAndTest(''); // API-Key-Feld bleibt leer (Edit-Modus startet leer)

		await waitFor(() => {
			expect(draftMock).toHaveBeenCalledTimes(1);
		});
		// Leeres Key-Feld + providerId = gespeicherter Key (AK2)
		expect(draftMock).toHaveBeenCalledWith(expect.objectContaining({ providerId: 5, apiKey: '' }));
	});

	it('AK4: Misserfolg zeigt die konkrete Ursache; der Dialog bleibt bedienbar', async () => {
		draftMock.mockResolvedValue({ ok: false, message: 'Ungültiger API-Key (401 vom Anbieter).' });
		render(<LlmProviderFormDialog onClose={vi.fn()} onSaved={vi.fn()} />);

		await fillAndTest('ungueltig');

		const alert = await screen.findByRole('alert');
		expect(alert.getAttribute('data-type')).toBe('error');
		// Konkrete Server-Meldung (AK4)
		expect(alert.textContent).toMatch(/Ungültiger API-Key/);

		await waitFor(() => {
			expect((screen.getByRole('button', { name: 'Anlegen' }) as HTMLButtonElement).disabled).toBe(false);
		});
		expect((screen.getByRole('button', { name: 'Abbrechen' }) as HTMLButtonElement).disabled).toBe(false);
	});
});

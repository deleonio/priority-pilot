import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { McpInstructionsSection } from './McpInstructionsSection';

/**
 * Rote Spec-Tests für #1935 AK5 (Spec docs/spec/issue-1935.md) — Dialog-Vorgaben im KI-Tab.
 * Rot, bis die Komponente existiert (neue Funktionalität: Modul fehlt).
 */

const apiMocks: Record<string, ReturnType<typeof vi.fn>> = {};
vi.mock('../api', () => ({
	api: new Proxy(
		{},
		{
			get: (_target, prop: string) => (apiMocks[prop] ??= vi.fn().mockResolvedValue(undefined)),
		},
	),
}));

const flush = () =>
	act(async () => {
		await Promise.resolve();
	});

beforeEach(() => {
	delete apiMocks.getMcpInstructions;
	delete apiMocks.updateMcpInstructions;
});
afterEach(cleanup);

describe('McpInstructionsSection – #1935 AK5', () => {
	it('zeigt gespeicherte Vorgaben beim Laden im Textfeld', async () => {
		apiMocks.getMcpInstructions = vi.fn().mockResolvedValue({ instructions: 'Antworte kurz und knapp.' });
		const { container } = render(<McpInstructionsSection />);
		await flush();

		const input = container.querySelector('[data-testid="mcp-instructions-input"]');
		expect(input, 'Textfeld fehlt').not.toBeNull();
		expect(String((input as unknown as { _value?: string })._value)).toBe('Antworte kurz und knapp.');
	});

	it('Ändern + Speichern sendet den Text an updateMcpInstructions', async () => {
		apiMocks.getMcpInstructions = vi.fn().mockResolvedValue({ instructions: '' });
		apiMocks.updateMcpInstructions = vi.fn().mockResolvedValue({ instructions: 'Immer Du-Form.' });
		const { container } = render(<McpInstructionsSection />);
		await flush();

		const input = container.querySelector('[data-testid="mcp-instructions-input"]') as unknown as {
			_on: { onInput?: (e: unknown, v: string) => void; onChange?: (e: unknown, v: string) => void };
		};
		await act(async () => {
			(input._on.onInput ?? input._on.onChange)?.({ target: input }, 'Immer Du-Form.');
			await Promise.resolve();
		});
		await act(async () => {
			container
				.querySelector('[data-testid="mcp-instructions-save"]')
				?.dispatchEvent(new Event('click', { bubbles: true }));
			await Promise.resolve();
		});

		expect(apiMocks.updateMcpInstructions).toHaveBeenCalledWith('Immer Du-Form.');
	});
});

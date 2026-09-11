import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiTokensSection } from './ApiTokensSection';

/**
 * Rote Spec-Tests für #1356 AK8 (Spec docs/spec/issue-1356.md) — Rechte-Umschalter je Token.
 *
 * Muster: der Zugriff-Teil in SettingsPage.test.tsx (#1352) — echte KoliBri-Custom-Elements
 * (kein @public-ui-Mock), Klicks per `dispatchEvent(new Event('click', {bubbles: true}))`, weil
 * `ButtonAction` (ApiTokensSection.tsx) den composed Klick am umgebenden Span abfängt.
 *
 * Rot, bis die Zeile einen Umschalter zeigt und `api.updateApiToken` existiert — heute rendert
 * `ApiTokensSection` weder Stufen-Text noch Umschalter (Selektoren finden nichts).
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

const readToken = {
	id: 1,
	name: 'CLI',
	scope: 'read',
	createdAt: new Date('2026-01-01T00:00:00Z').toISOString(),
	lastUsedAt: null,
};

beforeEach(() => {
	delete apiMocks.listApiTokens;
	delete apiMocks.createApiToken;
	delete apiMocks.deleteApiToken;
	delete apiMocks.updateApiToken;
});

afterEach(cleanup);

describe('ApiTokensSection – #1356 AK8: Rechte-Umschalter je Token', () => {
	it('zeigt „Nur lesend" für einen Token mit scope read', async () => {
		apiMocks.listApiTokens = vi.fn().mockResolvedValue([readToken]);
		const { container } = render(<ApiTokensSection />);

		await act(async () => {
			await Promise.resolve();
		});

		const row = container.querySelector('[data-testid="api-token-row"]');
		expect(row, 'Token-Zeile muss gerendert sein').not.toBeNull();
		expect(row?.textContent).toContain('Nur lesend');
		expect(row?.textContent).not.toContain('Lesen und Schreiben');
	});

	it('Umschalten sendet den PATCH mit readwrite und zeigt danach „Lesen und Schreiben"', async () => {
		apiMocks.listApiTokens = vi.fn().mockResolvedValue([readToken]);
		apiMocks.updateApiToken = vi.fn().mockResolvedValue({ ...readToken, scope: 'readwrite' });
		const { container } = render(<ApiTokensSection />);

		await act(async () => {
			await Promise.resolve();
		});

		const toggle = container.querySelector('[data-testid="api-token-row"] [data-testid="api-token-scope-toggle"]');
		expect(toggle, 'Umschalter für die Token-Rechtestufe fehlt').not.toBeNull();

		await act(async () => {
			(toggle as unknown as { _on: { onChange: (e: unknown, v: boolean) => void } })._on.onChange(
				{ target: toggle },
				true,
			);
			await Promise.resolve();
		});

		expect(apiMocks.updateApiToken).toHaveBeenCalledWith({ id: readToken.id, scope: 'readwrite' });

		const row = container.querySelector('[data-testid="api-token-row"]');
		expect(row?.textContent).toContain('Lesen und Schreiben');
	});

	it('bei fehlgeschlagenem PATCH bleibt die Stufe sichtbar unverändert und eine Fehlermeldung erscheint', async () => {
		apiMocks.listApiTokens = vi.fn().mockResolvedValue([readToken]);
		apiMocks.updateApiToken = vi.fn().mockRejectedValue(new Error('Netzwerkfehler'));
		const { container } = render(<ApiTokensSection />);

		await act(async () => {
			await Promise.resolve();
		});

		const toggle = container.querySelector('[data-testid="api-token-row"] [data-testid="api-token-scope-toggle"]');
		await act(async () => {
			(toggle as unknown as { _on: { onChange: (e: unknown, v: boolean) => void } })._on.onChange(
				{ target: toggle },
				true,
			);
			await Promise.resolve();
		});

		const row = container.querySelector('[data-testid="api-token-row"]');
		expect(row?.textContent, 'Wert bleibt unverändert sichtbar (read)').toContain('Nur lesend');
		expect(container.querySelector('kol-alert[_type="error"]'), 'Fehlermeldung fehlt').not.toBeNull();
	});

	// #1358: Ohne diesen Hinweis war nirgends erklärt, warum ein Token, das vor der Rechtestufe
	// vergeben wurde, seit dem Update jeden schreibenden MCP-Aufruf ablehnt.
	it('#1358: erklärt über der Liste, dass ein Token standardmäßig nur liest', async () => {
		apiMocks.listApiTokens = vi.fn().mockResolvedValue([readToken]);
		const { container } = render(<ApiTokensSection />);

		await act(async () => {
			await Promise.resolve();
		});

		const hint = container.querySelector('.api-tokens__scope-hint');
		expect(hint, 'Hinweis zur Standard-Rechtestufe fehlt').not.toBeNull();
		expect(hint?.textContent).toContain('liest standardmäßig nur');
		expect(hint?.textContent).toContain('task_create');
	});
});

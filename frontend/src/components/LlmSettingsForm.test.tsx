import { cleanup, render, waitFor } from '@testing-library/react';
import type { LlmConfigStatus } from 'client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import { LlmSettingsForm } from './LlmSettingsForm';

/**
 * Rote Spec-Tests für #972 — „UI: LLM-Einstellungen — Layout vereinheitlichen & X-Icon im
 * Key-löschen-Button".
 *
 * Spec-Bezug: docs/spec/issue-972.md → Erwartetes Ergebnis E1 (AK3)
 *
 * AK3: Der Entfernen-Schalter mit aria-label „API-Key löschen" zeigt ein sichtbares
 * Icon-Element (kolicon-cross via KolIcon/KolButton-_icons oder Inline-SVG) statt des
 * Unicode-Zeichens „✕" (U+2715), das je nach Systemfont nicht gerendert wird. Das Icon ist
 * rein dekorativ, der accessible name bleibt „API-Key löschen" (e2e-Vertrag aus #788).
 */

// Stabile Mock-Fns (vi.hoisted läuft vor dem vi.mock-Factory-Body); der Proxy fängt
// weitere api-Aufrufe aus LlmProviderToggle ab, ohne sie einzeln aufzuzählen.
const { getLlmConfigMock, getFreeModelsMock } = vi.hoisted(() => ({
	getLlmConfigMock: vi.fn(),
	getFreeModelsMock: vi.fn(),
}));

vi.mock('../api', () => ({
	api: new Proxy(
		{},
		{
			get: (_target, prop) =>
				prop === 'getLlmConfig'
					? getLlmConfigMock
					: prop === 'getFreeModels'
						? getFreeModelsMock
						: vi.fn().mockResolvedValue(undefined),
		},
	),
}));

/** Beide Keys gelten als gesetzt, damit beide X-Buttons rendern (Bedingung in LlmSettingsForm). */
const statusKeysSet: LlmConfigStatus = {
	hasMistralApiKey: true,
	hasOpenrouterApiKey: true,
	openrouterModel: 'openrouter/free',
};

beforeEach(() => {
	getLlmConfigMock.mockResolvedValue(statusKeysSet);
	getFreeModelsMock.mockResolvedValue({ models: [] });
});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe('#972 AK3: X-Button zeigt Icon statt Unicode „✕"', () => {
	it('rendert bei gesetzten Keys Icon-Elemente und behält den accessible name', async () => {
		render(<LlmSettingsForm />);

		const xButtons = await waitFor(() => {
			const buttons = Array.from(document.querySelectorAll('button[aria-label="API-Key löschen"]'));
			expect(buttons.length).toBeGreaterThanOrEqual(2);
			return buttons;
		});

		for (const button of xButtons) {
			// Accessible name bleibt der e2e-Vertrag aus #788 — das Icon darf ihn nicht ersetzen.
			expect(button.getAttribute('aria-label')).toBe('API-Key löschen');

			// Das Unicode-Zeichen U+2715 darf nicht länger Textinhalt des Buttons sein …
			expect(button.textContent).not.toContain('✕');

			// … stattdessen existiert ein echtes Icon-Element (KolIcon-Host oder Inline-SVG).
			const icon = button.querySelector('kol-icon, svg, i[class*="kolicon"]');
			expect(icon).not.toBeNull();
		}
	});
});

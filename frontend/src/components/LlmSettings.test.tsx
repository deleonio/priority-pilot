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
	// Gruppierungsflächen des Tabs (Design-Lauf 2026-09): `_label` ist die Überschrift der Gruppe.
	KolCard: ({ _label, children }: { _label?: string; children?: ReactNode }) => (
		<section>
			<h2>{_label}</h2>
			{children}
		</section>
	),
	// #1903: Unterbereiche der Karte „KI-Provider" — `_label` ist die Summary. Seit #1970
	// `_open`-abhängig, damit sich der geschlossene Klappbereich „Erweitert" testen lässt.
	KolDetails: ({
		_label,
		_open,
		_on,
		children,
	}: {
		_label?: string;
		_open?: boolean;
		_on?: { onToggle?: (event: unknown, value?: boolean) => void };
		children?: ReactNode;
	}) => (
		<details open={_open !== false}>
			<summary onClick={() => _on?.onToggle?.(null, _open !== true)}>{_label}</summary>
			{children}
		</details>
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
	// Eigentums-Marker der Verwaltungsliste (#1549): natives Inline-Element als Ersatzrender.
	KolBadge: ({ _label }: { _label?: string }) => <span>{_label}</span>,
}));

const mistral: LlmProvider = {
	id: 1,
	name: 'Mistral',
	endpoint: 'https://api.mistral.ai/v1',
	model: 'mistral-medium-latest',
	isActive: true,
	kind: 'builtin',
	hasApiKey: true,
	own: false,
};
const openrouter: LlmProvider = {
	id: 2,
	name: 'OpenRouter',
	endpoint: 'https://openrouter.ai/api/v1',
	model: 'openrouter/free',
	isActive: false,
	kind: 'builtin',
	hasApiKey: false,
	own: false,
};
const custom: LlmProvider = {
	id: 3,
	name: 'z.ai',
	endpoint: 'https://api.z.ai/v1',
	model: '',
	isActive: false,
	kind: 'custom',
	hasApiKey: true,
	own: true,
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

/** Öffnet „Erweitert" (#1970) — die Provider-Bedienelemente liegen seit #1970 dahinter. */
const openAdvanced = (): void => {
	fireEvent.click(screen.getByText('Erweitert'));
};

describe('LlmSettings — Built-ins sind fix', () => {
	it('rendert Mistral/OpenRouter ohne Bearbeiten/Löschen, Custom-Provider mit beiden', async () => {
		render(<LlmSettings />);
		openAdvanced();

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
		openAdvanced();

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
		openAdvanced();
		await waitFor(() => expect(screen.getByText(/KI-Features bereit/)).toBeInTheDocument());
	});

	it('readiness: konfiguriert + Test ok → grün mit „getestet“', async () => {
		testMock.mockResolvedValue({ ok: true, model: 'mistral-medium-latest', latencyMs: 210, sample: '{"ok": true}' });
		render(<LlmSettings />);
		openAdvanced();
		await waitFor(() => expect(screen.getByText('Provider verwalten')).toBeInTheDocument());

		fireEvent.click(screen.getAllByRole('button', { name: 'Testen' })[0]);
		await waitFor(() => expect(screen.getByText(/getestet, 210 ms/)).toBeInTheDocument());
	});

	it('readiness: konfiguriert, aber Test schlägt fehl → roter Hinweis mit Ursache', async () => {
		testMock.mockResolvedValue({ ok: false, message: 'Mistral antwortete mit HTTP 402: Check your subscription' });
		render(<LlmSettings />);
		openAdvanced();
		await waitFor(() => expect(screen.getByText('Provider verwalten')).toBeInTheDocument());

		fireEvent.click(screen.getAllByRole('button', { name: 'Testen' })[0]);
		await waitFor(() => expect(screen.getByText(/KI-Features schlagen derzeit fehl/)).toBeInTheDocument());
		// Ursache erscheint doppelt (inline Test-Ergebnis + readiness-Hinweis) — beides gewollt.
		expect(screen.getAllByText(/Check your subscription/).length).toBeGreaterThanOrEqual(2);
	});

	it('readiness: konfiguriert, noch ungetestet → blauer Hinweis mit Testen-Hinweis', async () => {
		render(<LlmSettings />);
		openAdvanced();
		await waitFor(() => expect(screen.getByText(/KI-Features bereit \(noch ungetestet\)/)).toBeInTheDocument());
	});

	it('warnt, wenn der aktive Provider ohne ENV-Key ist', async () => {
		listMock.mockResolvedValue([{ ...mistral, isActive: true, hasApiKey: false }]);

		render(<LlmSettings />);
		openAdvanced();
		await waitFor(() => expect(screen.getByText(/kein API-Key auf dem Server hinterlegt/)).toBeInTheDocument());
	});
});

describe('LlmSettings — Test-Prompt je Provider', () => {
	it('Testen-Button je Provider-Zeile: Erfolg zeigt Latenz-Alert mit Antwort-Auszug', async () => {
		testMock.mockResolvedValue({ ok: true, model: 'mistral-medium-latest', latencyMs: 321, sample: '{"ok": true}' });
		render(<LlmSettings />);
		openAdvanced();
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
		openAdvanced();
		await waitFor(() => expect(screen.getByText('Provider verwalten')).toBeInTheDocument());

		fireEvent.click(screen.getAllByRole('button', { name: 'Testen' })[0]);

		await waitFor(() => expect(screen.getAllByText(/Test fehlgeschlagen/).length).toBeGreaterThanOrEqual(1));
		await waitFor(() => expect(screen.getAllByText(/Check your subscription/).length).toBeGreaterThanOrEqual(1));
	});
});

describe('LlmSettings — „Erweitert" (#1970)', () => {
	it('TF1/AK1: standardmäßig zu — keine Provider-Bedienelemente erreichbar; nach dem Öffnen schon', async () => {
		render(<LlmSettings />);

		// Discoverability (KI-UX): der Klappbereich selbst ist sichtbar, sein Inhalt nicht.
		expect(screen.getByText('Erweitert')).toBeInTheDocument();
		expect(screen.queryByRole('group', { name: 'KI-Provider' })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Neuer Provider' })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Testen' })).toBeNull();
		expect(document.querySelector('#llm-active-model')).toBeNull();

		fireEvent.click(screen.getByText('Erweitert'));

		await waitFor(() => expect(screen.getByRole('group', { name: 'KI-Provider' })).toBeInTheDocument());
		expect(screen.getByRole('button', { name: 'Neuer Provider' })).toBeInTheDocument();
		expect(screen.getAllByRole('button', { name: 'Testen' })).toHaveLength(3);
	});

	it('TF2/AK2: Öffnen persistiert unter pp-ki-erweitert-open; Remount stellt den Zustand wieder her', async () => {
		render(<LlmSettings />);
		await waitFor(() => expect(screen.getByText('Erweitert')).toBeInTheDocument());

		// Standard ohne Eintrag: zu, kein Eintrag geschrieben.
		expect(localStorage.getItem('pp-ki-erweitert-open')).toBeNull();

		fireEvent.click(screen.getByText('Erweitert'));
		expect(localStorage.getItem('pp-ki-erweitert-open')).toBe('1');

		cleanup();
		render(<LlmSettings />);
		await waitFor(() => expect(screen.getByRole('button', { name: 'Neuer Provider' })).toBeInTheDocument());

		fireEvent.click(screen.getByText('Erweitert'));
		expect(localStorage.getItem('pp-ki-erweitert-open')).toBe('0');

		cleanup();
		render(<LlmSettings />);
		await waitFor(() => expect(screen.getByText('Erweitert')).toBeInTheDocument());
		expect(screen.queryByRole('button', { name: 'Neuer Provider' })).toBeNull();
	});

	it('KI-UX: „Erweitert" folgt nicht dem Master-Schalter, die inneren Details schon (#1903)', async () => {
		localStorage.setItem('pp-ki-erweitert-open', '1');
		render(<LlmSettings open={false} />);
		await waitFor(() => expect(screen.getByText('Erweitert')).toBeInTheDocument());

		// Der Klappbereich bleibt offen (Nutzpräferenz, nicht an useFollowingOpen gebunden) …
		const details = screen.getByText('Erweitert').closest('details');
		expect(details).not.toBeNull();
		expect(details!.open).toBe(true);
		// … während die inneren Details dem Master folgen und zu sind.
		expect(screen.queryByRole('group', { name: 'KI-Provider' })).toBeNull();
	});
});

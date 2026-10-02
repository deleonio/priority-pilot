import { act, cleanup, render, waitFor } from '@testing-library/react';
import { ResponseError, type Pillar } from 'client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntitlementMap } from '../lib/planOffers';

vi.mock('../api', () => ({
	api: {
		suggestInitialTasks: vi.fn(),
		createTask: vi.fn(),
		addDependency: vi.fn(),
	},
}));

import { PlanProvider } from '../lib/usePlan';
import { api } from '../api';
import { OnboardingFlow } from './OnboardingFlow';

// i18n initialisieren: Die Konfiguration initialisiert synchron beim Import (Ressourcen inline,
// config.ts:41-46), damit die KoliBri-Labels („Weiter“, „Später“, „Übernehmen“) auf Deutsch anliegen.
import '../i18n/config';

afterEach(cleanup);

// Test-Infrastruktur (Impl, dokumentiert im PR-Body): Isolierte Mocks je Test — die negativen
// Aufruf-Assertions („Später“ ruft X nicht auf) sind sonst durch Residuen der Vortests befleckt.
// Muster der Nachbarn (z. B. QuickCaptureModal.test.tsx). Keine Implementierungen werden entfernt.
beforeEach(() => {
	vi.clearAllMocks();
});

const pillars: Pillar[] = [
	{ id: 11, name: 'Körper', description: '', weight: 20 },
	{ id: 12, name: 'Geist', description: '', weight: 20 },
];

const suggestions = [
	{ title: 'Erststart A', pillarId: 11 },
	{ title: 'Erststart B', pillarId: 11, dependsOn: 0 },
	{ title: 'Erststart C', pillarId: 11 },
	{ title: 'Erststart D', pillarId: 11 },
	{ title: 'Erststart E', pillarId: 11 },
];

/** Lose getypte Mock-Handles — `suggestInitialTasks` existiert in api.ts erst mit der Umsetzung. */
const apiMock = api as unknown as Record<
	'suggestInitialTasks' | 'createTask' | 'addDependency',
	ReturnType<typeof vi.fn>
>;

const entitlements = { ai_assist: { allowed: true, requiredPlan: 'pro' } } as unknown as EntitlementMap;

const renderFlow = (): { onClose: ReturnType<typeof vi.fn> } => {
	const onClose = vi.fn();
	render(
		<PlanProvider value={{ plan: 'pro', entitlements }}>
			<OnboardingFlow pillars={pillars} onClose={onClose} />
		</PlanProvider>,
	);
	return { onClose };
};

/** Der Primär-/Sekundär-Button mit exakt diesem Label als gerendertes `kol-button`-Host-Element. */
const button = (label: string): Element | undefined =>
	[...document.body.querySelectorAll('.onboarding-flow kol-button')].find((el) => el.getAttribute('_label') === label);

const clickButton = async (label: string): Promise<void> => {
	const target = button(label);
	expect(target, `Button "${label}" nicht gefunden`).toBeDefined();
	await act(async () => {
		(target as unknown as { _on?: { onClick?: () => void } })._on?.onClick?.();
	});
};

/** Tippt in die Freitext-Textarea (KoliBri-Custom-Elements sind in jsdom inert — Muster QuickCaptureModal.test.tsx). */
const typeGoal = async (value: string): Promise<void> => {
	const textarea = document.body.querySelector('.onboarding-flow kol-textarea');
	expect(textarea).toBeDefined();
	await act(async () => {
		(textarea as unknown as { _on?: { onInput?: (event: Event, value: unknown) => void } })._on?.onInput?.(
			new Event('input'),
			value,
		);
	});
};

/** Setzt den Auswahlzustand einer Vorschlags-Karte. */
const toggleCard = async (title: string, value: boolean): Promise<void> => {
	const card = [...document.body.querySelectorAll('.onboarding-flow kol-input-checkbox')].find(
		(el) => el.getAttribute('_label') === title,
	);
	expect(card, `Karte "${title}" nicht gefunden`).toBeDefined();
	await act(async () => {
		(card as unknown as { _on?: { onInput?: (event: Event, value: unknown) => void } })._on?.onInput?.(
			new Event('input'),
			value,
		);
	});
};

const cardCount = (): number => document.body.querySelectorAll('.onboarding-flow kol-input-checkbox').length;

/** navigiert von Schritt 1 in Schritt 2 (SuggesterMock liefert fünf Karten). */
const gotoSuggestions = async (): Promise<void> => {
	apiMock.suggestInitialTasks.mockResolvedValue(suggestions);
	await typeGoal('Ich möchte wieder mehr Sport machen und geordneter leben');
	await clickButton('Weiter');
	await waitFor(() => expect(cardCount()).toBe(5));
};

describe('OnboardingFlow — Schrittfolge, Abbruch, Fehler- und Quota-Zustand (#2069, Spec AK5)', () => {
	it('führt die Schrittfolge 1→2→3 aus und legt genau die Auswahl mit Säule und Abhängigkeit an', async () => {
		renderFlow();
		await gotoSuggestions();

		// Genau zwei Karten ausgewählt — A (Vorgänger) und B (hängt an A); C bis E bleiben abgewählt.
		await toggleCard('Erststart A', true);
		await toggleCard('Erststart B', true);
		await clickButton('Weiter');
		await clickButton('Übernehmen');

		await waitFor(() => expect(apiMock.createTask).toHaveBeenCalledTimes(2));
		expect(apiMock.createTask).toHaveBeenNthCalledWith(1, {
			taskCreate: expect.objectContaining({ title: 'Erststart A', pillarIds: [11] }),
		});
		expect(apiMock.createTask).toHaveBeenNthCalledWith(2, {
			taskCreate: expect.objectContaining({ title: 'Erststart B', pillarIds: [11] }),
		});
		// Vorgänger zuerst angelegt (id 101), dann Abhängigkeits-Kante am Nachfolger (id 102).
		expect(apiMock.addDependency).toHaveBeenCalledWith({ id: 102, dependencyInput: { dependingTaskId: 101 } });
	});

	it('„Später“ in Schritt 1 beendet ohne Bestätigungsdialog und ohne Endpunkt-Aufruf', async () => {
		const { onClose } = renderFlow();
		const confirmSpy = vi.spyOn(window, 'confirm');

		await clickButton('Später');

		expect(onClose).toHaveBeenCalledTimes(1);
		expect(confirmSpy).not.toHaveBeenCalled();
		expect(apiMock.suggestInitialTasks).not.toHaveBeenCalled();
		expect(apiMock.createTask).not.toHaveBeenCalled();
	});

	it('„Später“ in Schritt 2 beendet ohne Bestätigungsdialog und ohne angelegte Aufgaben', async () => {
		const { onClose } = renderFlow();
		const confirmSpy = vi.spyOn(window, 'confirm');
		await gotoSuggestions();

		await clickButton('Später');

		expect(onClose).toHaveBeenCalledTimes(1);
		expect(confirmSpy).not.toHaveBeenCalled();
		expect(apiMock.createTask).not.toHaveBeenCalled();
	});

	it('„Später“ in Schritt 3 beendet ohne Bestätigungsdialog und ohne angelegte Aufgaben', async () => {
		const { onClose } = renderFlow();
		const confirmSpy = vi.spyOn(window, 'confirm');
		await gotoSuggestions();
		await toggleCard('Erststart A', true);
		await clickButton('Weiter');

		await clickButton('Später');

		expect(onClose).toHaveBeenCalledTimes(1);
		expect(confirmSpy).not.toHaveBeenCalled();
		expect(apiMock.createTask).not.toHaveBeenCalled();
	});

	it('zeigt bei Endpunkt-Fehler eine Fehlermeldung (KolAlert error) mit Ausweg „Später“ statt Karten', async () => {
		const { onClose } = renderFlow();
		const body = { message: 'Es sind keine Säulen konfiguriert.' };
		apiMock.suggestInitialTasks.mockRejectedValueOnce(
			new ResponseError(new Response(JSON.stringify(body), { status: 503 }), body),
		);
		await typeGoal('Ich möchte wieder mehr Sport machen');
		await clickButton('Weiter');

		await waitFor(() => {
			const alert = document.body.querySelector('.onboarding-flow kol-alert');
			expect(alert?.getAttribute('_type')).toBe('error');
		});
		expect(cardCount()).toBe(0);

		await clickButton('Später');
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('zeigt bei Quota-Abweisung (429 ai_throttled) die freundliche Quota-Meldung mit Ausweg „Später“', async () => {
		const { onClose } = renderFlow();
		const body = { message: 'Fair Use: bitte kurz warten.', code: 'ai_throttled' };
		apiMock.suggestInitialTasks.mockRejectedValueOnce(
			new ResponseError(new Response(JSON.stringify(body), { status: 429, headers: { 'Retry-After': '20' } }), body),
		);
		await typeGoal('Ich möchte wieder mehr Sport machen');
		await clickButton('Weiter');

		await waitFor(() => {
			const alerts = [...document.body.querySelectorAll('.onboarding-flow kol-alert')];
			expect(alerts.some((el) => el.getAttribute('_label') === 'KI-Hilfe etwas langsamer')).toBe(true);
		});
		expect(cardCount()).toBe(0);

		await clickButton('Später');
		expect(onClose).toHaveBeenCalledTimes(1);
	});
});

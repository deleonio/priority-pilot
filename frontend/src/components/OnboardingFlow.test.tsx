import { act, cleanup, render, waitFor } from '@testing-library/react';
import { ResponseError, type Pillar } from 'client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntitlementMap } from '../lib/planOffers';

vi.mock('../api', () => ({
	api: {
		suggestInitialTasks: vi.fn(),
		createTask: vi.fn(),
		addDependency: vi.fn(),
		setPillarWeights: vi.fn(),
	},
}));

import i18next from 'i18next';
import { AI_ENABLED_STORAGE_KEY } from '../lib/aiPreferences';
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
	'suggestInitialTasks' | 'createTask' | 'addDependency' | 'setPillarWeights',
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
		// IDs für den Abhängigkeits-Mock (Test-Infrastruktur, Kreuzverhör #2081 Finding 1).
		apiMock.createTask.mockResolvedValueOnce({ id: 101 }).mockResolvedValueOnce({ id: 102 });
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

	it('wählt beim Wählen eines Nachfolgers dessen Vorgänger-Kette mit (Kaskade, PO-Entscheidung Kreuzverhör #2081)', async () => {
		const { onClose } = renderFlow();
		apiMock.createTask.mockResolvedValueOnce({ id: 101 }).mockResolvedValueOnce({ id: 102 });
		await gotoSuggestions();

		await toggleCard('Erststart B', true);
		await clickButton('Weiter');
		await clickButton('Übernehmen');
		// Schritt 4 (Import, optional) liegt vor der Abschluss-Karte.
		await waitFor(() => expect(button('Weiter')).toBeDefined());
		await clickButton('Weiter');

		await waitFor(() => expect(apiMock.createTask).toHaveBeenCalledTimes(2));
		expect(apiMock.createTask).toHaveBeenNthCalledWith(1, {
			taskCreate: expect.objectContaining({ title: 'Erststart A', pillarIds: [11] }),
		});
		expect(apiMock.createTask).toHaveBeenNthCalledWith(2, {
			taskCreate: expect.objectContaining({ title: 'Erststart B', pillarIds: [11] }),
		});
		expect(apiMock.addDependency).toHaveBeenCalledWith({ id: 102, dependencyInput: { dependingTaskId: 101 } });
		// #2070: Apply zeigt die Abschluss-Karte — onClose feuert erst bei „Fertig" (Test-Pflege).
		await clickButton('Fertig');
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('wählt beim Abwählen eines Vorgängers die abhängigen Nachfolger gleich mit ab (Kaskade, PO-Entscheidung Kreuzverhör #2081)', async () => {
		const { onClose } = renderFlow();
		await gotoSuggestions();

		await toggleCard('Erststart B', true); // Kaskade: A + B
		await toggleCard('Erststart A', false); // Kaskade: B fällt mit weg
		await clickButton('Weiter');

		// Schritt 3 zeigt Auswahl 0 — ohne Kaskade stünde hier eine verwaiste Karte mit still
		// übersprungener „nach: …“-Zusage.
		await waitFor(() => {
			const counter = [...document.body.querySelectorAll('.onboarding-flow p')].find((el) =>
				el.textContent?.includes('Vorschlägen'),
			);
			expect(counter?.textContent).toContain('0 von 5');
		});
		expect(apiMock.createTask).not.toHaveBeenCalled();
		expect(onClose).not.toHaveBeenCalled();
	});

	it('merkt sich bei Teilfehler die angelegten Aufgaben und legt beim Retry nur die fehlenden an (keine Duplikate, PO-Entscheidung Kreuzverhör #2081)', async () => {
		const { onClose } = renderFlow();
		const body = { message: 'Datenbank nicht erreichbar.' };
		apiMock.createTask
			.mockResolvedValueOnce({ id: 101 })
			.mockResolvedValueOnce({ id: 102 })
			.mockRejectedValueOnce(new ResponseError(new Response(JSON.stringify(body), { status: 503 }), body));
		await gotoSuggestions();

		await toggleCard('Erststart A', true);
		await toggleCard('Erststart B', true);
		await toggleCard('Erststart C', true);
		// Der applyError-Alert lebt im Zusammenfassungs-Schritt — zuerst dorthin navigieren
		await clickButton('Weiter');
		await clickButton('Übernehmen');

		// Teilfehler bei C: A und B liegen an (IDs gemerkt), der Alert nennt den Stand.
		await waitFor(() => {
			const alert = document.body.querySelector('.onboarding-flow kol-alert');
			expect(alert?.getAttribute('_type')).toBe('error');
			expect(alert?.textContent).toContain('2 Aufgaben');
		});
		expect(apiMock.createTask).toHaveBeenCalledTimes(3);
		expect(onClose).not.toHaveBeenCalled();

		// Retry: nur C wird angelegt (103), die Kante läuft mit den gemerkten IDs — keine Duplikate.
		apiMock.createTask.mockResolvedValueOnce({ id: 103 });
		await clickButton('Übernehmen');
		// Schritt 4 (Import, optional) liegt vor der Abschluss-Karte.
		await waitFor(() => expect(button('Weiter')).toBeDefined());
		await clickButton('Weiter');

		// #2070: Apply endet auf der Abschluss-Karte — „Fertig" schließt (Test-Pflege).
		await waitFor(() => expect(button('Fertig')).toBeDefined());
		await clickButton('Fertig');
		await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
		expect(apiMock.createTask).toHaveBeenCalledTimes(4);
		expect(apiMock.addDependency).toHaveBeenCalledTimes(1);
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

describe('OnboardingFlow — Startgewichtung, Abschluss-Karte, dynamische Schritt-Anzeige (#2070, Spec AK1/AK2)', () => {
	it('zeigt die Schritt-Anzeige mit 4 Schritten und keine Startgewichtung (alle Konten starten mit 5 × 20 %)', async () => {
		renderFlow();
		const indicator = () => document.body.querySelector('.onboarding-step-indicator')?.textContent ?? '';
		expect(indicator()).toContain('Schritt 1 von 4');

		await gotoSuggestions();
		await toggleCard('Erststart A', true);
		await clickButton('Weiter');

		// Direkt nach den Vorschlägen folgt „Übernehmen“ als Schritt 3 — kein Gewichtungsschritt.
		await waitFor(() => expect(button('Übernehmen')).toBeDefined());
		expect(indicator()).toContain('Schritt 3 von 4');
		expect(button('Speichern')).toBeUndefined();
	});

	it('oeffnet nach dem Übernehmen die Abschluss-Karte (nächste Aufgabe abhakbar, Balance-Hinweis, "Fertig")', async () => {
		const { onClose } = renderFlow();
		await gotoSuggestions();
		await toggleCard('Erststart A', true);
		await toggleCard('Erststart B', true);
		await clickButton('Weiter');
		await clickButton('Übernehmen');
		// Schritt 4 (Import, optional) liegt vor der Abschluss-Karte.
		await waitFor(() => expect(button('Weiter')).toBeDefined());
		await clickButton('Weiter');
		await waitFor(() => expect(apiMock.createTask).toHaveBeenCalledTimes(2));

		// Abschluss-Karte statt sofortigem onClose: Flow bleibt offen, nächste Aufgabe direkt abhakbar.
		expect(onClose).not.toHaveBeenCalled();
		await waitFor(() => expect(button('Fertig'), 'Abschluss-Karte ohne "Fertig"').toBeDefined());
		const next = [...document.body.querySelectorAll('.onboarding-flow kol-input-checkbox')].find(
			(el) => el.getAttribute('_label') === 'Erststart A',
		);
		expect(next, 'Nächste Aufgabe "Erststart A" nicht als Checkbox der Abschluss-Karte').toBeDefined();
		expect(document.body.querySelector('.onboarding-flow')?.textContent).toContain('stärkste Säule');

		await clickButton('Fertig');
		await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
	});

	it('zeigt ohne eigene Auswahl in der Abschluss-Karte die erste Beispielaufgabe — rein lokal, ohne Task-Call (AK2)', async () => {
		const { onClose } = renderFlow();
		await gotoSuggestions();
		// Keine Karte ausgewählt — Schritt 2 führt trotzdem weiter, die Auswahl ist zulässig leer.
		await clickButton('Weiter');
		await clickButton('Übernehmen');
		// Schritt 4 (Import, optional) liegt vor der Abschluss-Karte.
		await waitFor(() => expect(button('Weiter')).toBeDefined());
		await clickButton('Weiter');
		await waitFor(() => expect(button('Fertig'), 'Abschluss-Karte ohne "Fertig"').toBeDefined());

		// Fallback statt leerer Karte: erste Beispielaufgabe, rein lokal — kein createTask.
		expect(apiMock.createTask).not.toHaveBeenCalled();
		const fallback = [...document.body.querySelectorAll('.onboarding-flow kol-input-checkbox')].find(
			(el) => el.getAttribute('_label') === '15 Minuten spazieren gehen',
		);
		expect(fallback, 'Erste Beispielaufgabe fehlt in der leeren Abschluss-Karte').toBeDefined();
		expect(onClose).not.toHaveBeenCalled();

		await clickButton('Fertig');
		await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
	});
});

// #1969 AK7: optionaler Verweis auf den Import — liegt in Schritt 5 (nach dem Übernehmen), damit er den
// Assistenten nicht mitten im Ablauf abbricht.
describe('OnboardingFlow — Import-Einstieg (Spec #1969 AK7)', () => {
	it('bietet den Import-Verweis nicht in Schritt 1, sondern in Schritt 4 an', async () => {
		const entry = () =>
			[...document.body.querySelectorAll('.onboarding-flow kol-button')].find((el) =>
				(el.getAttribute('_label') ?? '').includes('importieren'),
			);
		renderFlow();
		expect(entry(), 'Schritt 1 ohne Import-Verweis').toBeUndefined();

		await gotoSuggestions();
		await toggleCard('Erststart A', true);
		await clickButton('Weiter');
		apiMock.createTask.mockResolvedValueOnce({ id: 101 });
		await clickButton('Übernehmen');
		await waitFor(() => expect(entry(), 'Schritt 4 bietet den Import-Verweis an').toBeDefined());
	});
});

describe('OnboardingFlow — ohne KI-Paket', () => {
	it('überspringt Freitext und Vorschläge: nur der Import bleibt', async () => {
		const onClose = vi.fn();
		render(
			<PlanProvider
				value={{
					plan: 'free',
					entitlements: { ai_assist: { allowed: false, requiredPlan: 'plus' } } as unknown as EntitlementMap,
				}}
			>
				<OnboardingFlow pillars={pillars} onClose={onClose} />
			</PlanProvider>,
		);

		expect(document.body.querySelector('.onboarding-step-indicator')?.textContent).toContain('Schritt 1 von 1');
		expect(document.body.querySelector('.onboarding-flow kol-textarea')).toBeNull();
		await waitFor(() => expect(button('Aufgaben aus Todoist oder CSV importieren')).toBeDefined());
	});
});

// #2225: Free-Konto (ohne `ai_assist`) sieht im Import-Schritt einen erklärenden Satz und den Paket-Hinweis.
// Spec: docs/spec/issue-2225.md (Schlüssel `onboarding.importAiHint`, Test-ID `onboarding-import-ai-hint`).
describe('OnboardingFlow — Import-Schritt erklärt fehlende KI (Spec #2225)', () => {
	afterEach(() => localStorage.removeItem(AI_ENABLED_STORAGE_KEY));

	const renderWith = (allowed: boolean): void => {
		render(
			<PlanProvider
				value={{
					plan: allowed ? 'pro' : 'free',
					entitlements: { ai_assist: { allowed, requiredPlan: 'plus' } } as unknown as EntitlementMap,
				}}
			>
				<OnboardingFlow pillars={pillars} onClose={vi.fn()} />
			</PlanProvider>,
		);
	};
	const hint = () => document.body.querySelector('[data-testid="onboarding-import-ai-hint"]');
	const badge = () => document.body.querySelector('[data-testid="plan-badge-ai_assist"]');

	it('AK1/AK2: ohne ai_assist erscheinen Satz (neuer i18n-Schlüssel) und Paket-Hinweis, kein Dialog', async () => {
		renderWith(false);
		const expected = i18next.t('onboarding.importAiHint', { ns: 'common' });
		expect(expected, 'Schlüssel onboarding.importAiHint fehlt in common.json').not.toBe('onboarding.importAiHint');
		expect(hint()?.textContent).toBe(expected);
		expect(badge()).not.toBeNull();
		expect(document.body.querySelector('[role="dialog"]')).toBeNull();
	});

	it('AK3: mit ai_assist und eingeschalteter KI weder Satz noch Paket-Hinweis', () => {
		renderWith(true);
		expect(hint()).toBeNull();
		expect(badge()).toBeNull();
	});

	it('AK4: Paket erlaubt, KI per Einstellung aus → kein Paket-Hinweis', () => {
		localStorage.setItem(AI_ENABLED_STORAGE_KEY, 'false');
		renderWith(true);
		expect(badge()).toBeNull();
	});
});

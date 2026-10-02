import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// ROTER Spec-Test (#1793, Spec docs/spec/issue-1793.md): `CareHint` existiert noch nicht.
// Der Import schlägt fehl, bis `frontend/src/components/CareHint.tsx` die Komponente bereitstellt.
import { CareHint } from './CareHint';
// #2063: i18n läuft echt (vitest.setup.ts pinnt `de`) — die Sprach-Tests wechseln selbst.
import i18next from '../i18n/config';

/**
 * Spec-Tests für den Fürsorge-Hinweis (AK1–AK6, AK8, #1793): lädt die Vorschläge selbst über
 * `api.getCareSuggestions`, zeigt den ersten und bietet Übernehmen / Nicht jetzt / Ablehnen.
 * Ablehnen einer eigenen Aufgabe und „Nicht jetzt" wirken nur lokal (localStorage, Remount = Reload).
 */

interface Vorschlag {
	typ: 'task' | 'vorlage' | 'ki';
	titel: string;
	beschreibung: string | null;
	saeuleId: number;
	saeuleName: string;
	saeulenBeitraege: { pillarId: number; share: number }[];
	taskId?: number;
	templateKey?: string;
	anlass?: 'defizit' | 'ueberlast';
}

vi.mock('@public-ui/react-v19', () => ({
	// #2063: `data-label` macht das `_label` des KolAlert testbar (echtes Label liegt im Shadow-DOM).
	KolAlert: ({ children, _label }: { children?: ReactNode; _label?: string }) => (
		<div data-comp="kol-alert" data-label={_label}>
			{children}
		</div>
	),
	KolButton: ({ _label, _on }: { _label?: string; _on?: { onClick?: (event: MouseEvent) => void } }) => (
		<button type="button" onClick={() => _on?.onClick?.(new MouseEvent('click'))}>
			{_label}
		</button>
	),
}));

const getCareSuggestions = vi.fn<() => Promise<{ vorschlaege: Vorschlag[] }>>();
const dismissCareSuggestion = vi.fn<(arg: { templateKey: string }) => Promise<void>>();
const createTask = vi.fn<(arg: { taskCreate: Record<string, unknown> }) => Promise<unknown>>();
const updateTask = vi.fn<(arg: { id: number; taskUpdate: Record<string, unknown> }) => Promise<unknown>>();

vi.mock('../api', () => ({
	api: {
		getCareSuggestions: () => getCareSuggestions(),
		dismissCareSuggestion: (arg: { templateKey: string }) => dismissCareSuggestion(arg),
		createTask: (arg: { taskCreate: Record<string, unknown> }) => createTask(arg),
		updateTask: (arg: { id: number; taskUpdate: Record<string, unknown> }) => updateTask(arg),
	},
}));

const vorlage: Vorschlag = {
	typ: 'vorlage',
	titel: 'Zehn Minuten spazieren gehen',
	beschreibung: 'Ein kurzer Spaziergang an der frischen Luft',
	saeuleId: 3,
	saeuleName: 'Körper',
	saeulenBeitraege: [{ pillarId: 3, share: 100 }],
	templateKey: 'koerper-spaziergang',
};
const zweite: Vorschlag = { ...vorlage, titel: 'Dehnen', templateKey: 'koerper-dehnen' };
const eigene: Vorschlag = {
	typ: 'task',
	titel: 'Fahrrad reparieren',
	beschreibung: null,
	saeuleId: 3,
	saeuleName: 'Körper',
	saeulenBeitraege: [{ pillarId: 3, share: 100 }],
	taskId: 42,
};

const hint = (): HTMLElement | null => document.querySelector('[data-testid="care-hint"]');
const zeigeHinweis = async (): Promise<HTMLElement> => {
	await waitFor(() => expect(hint()).not.toBeNull());
	return hint()!;
};
const tap = (name: string): void => {
	fireEvent.click(screen.getByRole('button', { name }));
};

describe('CareHint (#1793)', () => {
	beforeEach(() => {
		window.localStorage.clear();
		createTask.mockResolvedValue({});
		updateTask.mockResolvedValue({});
		dismissCareSuggestion.mockResolvedValue(undefined);
	});

	afterEach(() => {
		cleanup();
		vi.useRealTimers();
		vi.clearAllMocks();
		// #2063: Sprach-Tests wechseln auf `en` — zurück auf den Setup-Pin, damit keine Folge-Assertion
		// in der Testdatei an der Sprache hängt.
		void i18next.changeLanguage('de');
	});

	// #1967 AK4: ärztlicher Rat + TelefonSeelsorge als Light-DOM-`a` in beiden Varianten.
	it.each([
		['mit Vorschlag', [vorlage]],
		['ohne Vorschlag', []],
	])('#1967 AK4: %s zeigt ärztlichen Rat und tel:-Link zur TelefonSeelsorge', async (_name, vorschlaege) => {
		getCareSuggestions.mockResolvedValue({ vorschlaege });
		render(<CareHint />);
		const el = await zeigeHinweis();
		expect(el.textContent).toContain('ärztlichen Rat');
		expect(el.querySelector('a[href="tel:08001110111"]')).not.toBeNull();
	});

	it('AK1: rendert genau EINEN Hinweis mit Säulenname und Titel des ersten Vorschlags', async () => {
		getCareSuggestions.mockResolvedValue({ vorschlaege: [vorlage, zweite] });
		render(<CareHint />);
		const el = await zeigeHinweis();
		expect(document.querySelectorAll('[data-testid="care-hint"]')).toHaveLength(1);
		expect(el.textContent).toContain('Körper');
		expect(el.textContent).toContain('Ein kurzer Spaziergang an der frischen Luft');
		expect(el.textContent).not.toContain('Dehnen');
	});

	it('AK2: Übernehmen einer Vorlage → genau ein createTask mit Titel + Säulenbeitrag, Hinweis weg', async () => {
		getCareSuggestions.mockResolvedValue({ vorschlaege: [vorlage] });
		render(<CareHint />);
		await zeigeHinweis();
		tap('Vorschlag übernehmen');
		await waitFor(() => expect(hint()).toBeNull());
		expect(createTask).toHaveBeenCalledTimes(1);
		const { taskCreate } = createTask.mock.calls[0]![0];
		expect(taskCreate.title).toBe(vorlage.titel);
		expect(taskCreate.pillars).toEqual([{ pillarId: 3, share: 100, confidence: 100 }]);
		expect(updateTask).not.toHaveBeenCalled();
	});

	it('AK2: Übernehmen einer eigenen Aufgabe → updateTask auf „In process", kein createTask, Hinweis weg', async () => {
		getCareSuggestions.mockResolvedValue({ vorschlaege: [eigene] });
		render(<CareHint />);
		await zeigeHinweis();
		tap('Vorschlag übernehmen');
		await waitFor(() => expect(hint()).toBeNull());
		expect(updateTask).toHaveBeenCalledTimes(1);
		expect(updateTask.mock.calls[0]![0]).toEqual({ id: 42, taskUpdate: { status: 'In process' } });
		expect(createTask).not.toHaveBeenCalled();
	});

	it('UX: schlägt Übernehmen fehl, kommt der Hinweis zurück und ein Fehler wird gemeldet', async () => {
		getCareSuggestions.mockResolvedValue({ vorschlaege: [vorlage] });
		createTask.mockRejectedValue(new Error('boom'));
		render(<CareHint />);
		await zeigeHinweis();
		tap('Vorschlag übernehmen');
		await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
		expect(hint()).not.toBeNull();
	});

	it('AK3: Ablehnen einer Vorlage → genau ein Dismissal mit templateKey, Hinweis weg', async () => {
		getCareSuggestions.mockResolvedValue({ vorschlaege: [vorlage] });
		render(<CareHint />);
		await zeigeHinweis();
		tap('Vorschlag ablehnen');
		await waitFor(() => expect(hint()).toBeNull());
		expect(dismissCareSuggestion).toHaveBeenCalledTimes(1);
		expect(dismissCareSuggestion).toHaveBeenCalledWith({ templateKey: 'koerper-spaziergang' });
	});

	it('AK3: Ablehnen einer eigenen Aufgabe → kein Server-Call, 14 Tage lokal unterdrückt', async () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(new Date(2026, 5, 10, 12, 0, 0));
		getCareSuggestions.mockResolvedValue({ vorschlaege: [eigene] });
		const { unmount } = render(<CareHint />);
		await zeigeHinweis();
		tap('Vorschlag ablehnen');
		await waitFor(() => expect(hint()).toBeNull());
		expect(dismissCareSuggestion).not.toHaveBeenCalled();
		expect(createTask).not.toHaveBeenCalled();
		expect(updateTask).not.toHaveBeenCalled();
		unmount();

		vi.setSystemTime(new Date(2026, 5, 23, 12, 0, 0)); // 13 Tage später: noch unterdrückt
		render(<CareHint />);
		await waitFor(() => expect(getCareSuggestions).toHaveBeenCalledTimes(2));
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(hint()).toBeNull();
		cleanup();

		vi.setSystemTime(new Date(2026, 5, 25, 12, 0, 0)); // 15 Tage später: wieder sichtbar
		render(<CareHint />);
		await zeigeHinweis();
	});

	it('AK4: „Nicht jetzt" → kein Server-Call, bis Tagesende ausgeblendet (auch nach Reload), am Folgetag wieder da', async () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(new Date(2026, 5, 10, 12, 0, 0));
		getCareSuggestions.mockResolvedValue({ vorschlaege: [vorlage] });
		const { unmount } = render(<CareHint />);
		await zeigeHinweis();
		tap('Nicht jetzt');
		await waitFor(() => expect(hint()).toBeNull());
		expect(dismissCareSuggestion).not.toHaveBeenCalled();
		expect(createTask).not.toHaveBeenCalled();
		unmount();

		vi.setSystemTime(new Date(2026, 5, 10, 23, 0, 0)); // gleicher Tag, „Reload"
		render(<CareHint />);
		await waitFor(() => expect(getCareSuggestions).toHaveBeenCalledTimes(2));
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(hint()).toBeNull();
		cleanup();

		vi.setSystemTime(new Date(2026, 5, 11, 1, 0, 0)); // Folgetag
		render(<CareHint />);
		await zeigeHinweis();
	});

	it('AK5: leere Liste → positive Rückmeldung ohne Aktionsbuttons', async () => {
		getCareSuggestions.mockResolvedValue({ vorschlaege: [] });
		render(<CareHint />);
		const el = await zeigeHinweis();
		expect(el.textContent).toContain('Gerade gibt es keinen Vorschlag für dich.');
		expect(screen.queryAllByRole('button')).toHaveLength(0);
	});

	it('AK6: Hinweis ist eine Status-Region mit zugänglichem Namen; Übernehmen steht vor den anderen Aktionen', async () => {
		getCareSuggestions.mockResolvedValue({ vorschlaege: [vorlage] });
		render(<CareHint />);
		await zeigeHinweis();
		const region = screen.getByRole('status');
		expect(region.getAttribute('aria-label') ?? '').not.toBe('');
		const namen = screen.getAllByRole('button').map((b) => b.textContent);
		expect(namen).toEqual(['Vorschlag übernehmen', 'Nicht jetzt', 'Vorschlag ablehnen']);
	});

	it('AK8: scheitert das Laden, wird nichts gerendert', async () => {
		getCareSuggestions.mockRejectedValue(new Error('offline'));
		render(<CareHint />);
		await waitFor(() => expect(getCareSuggestions).toHaveBeenCalled());
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(hint()).toBeNull();
		expect(screen.queryByRole('alert')).toBeNull();
	});

	it('#1795 AK4: anlass ueberlast → Erholungs-Rahmensatz statt „kam diese Woche zu kurz"', async () => {
		getCareSuggestions.mockResolvedValue({
			vorschlaege: [{ ...vorlage, anlass: 'ueberlast', titel: 'Kurze Pause', beschreibung: 'Atme fünf Minuten durch' }],
		});
		render(<CareHint />);
		const el = await zeigeHinweis();
		expect(el.textContent).not.toContain('zu kurz');
		expect(el.textContent).toContain('Atme fünf Minuten durch');
		expect(screen.getByRole('button', { name: 'Vorschlag übernehmen' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Nicht jetzt' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Vorschlag ablehnen' })).toBeTruthy();
	});

	it('#1795 AK4: anlass defizit → bisheriger Satz „kam diese Woche zu kurz"', async () => {
		getCareSuggestions.mockResolvedValue({ vorschlaege: [{ ...vorlage, anlass: 'defizit' }] });
		render(<CareHint />);
		const el = await zeigeHinweis();
		expect(el.textContent).toContain('Körper kam diese Woche zu kurz.');
	});

	// #2063 AK2/AK5 (Spec docs/spec/issue-2063.md): der Hinweis spricht die App-Sprache —
	// hier Englisch; Server-Daten (Säulenname, Titel, Beschreibung) bleiben wortgleich.
	it('#2063 AK2+AK5: Sprache en — Label, Knöpfe und Krisenhinweis englisch', async () => {
		await i18next.changeLanguage('en');
		getCareSuggestions.mockResolvedValue({ vorschlaege: [vorlage] });
		render(<CareHint />);
		const el = await zeigeHinweis();
		expect(screen.getByRole('status').getAttribute('aria-label')).toBe('Care hint');
		expect(document.querySelector('[data-comp="kol-alert"]')?.getAttribute('data-label')).toBe('Care hint');
		expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
			'Accept suggestion',
			'Not now',
			'Dismiss suggestion',
		]);
		const link = el.querySelector('a[href="tel:08001110111"]');
		expect(link).not.toBeNull();
		expect(link!.textContent).toBe('TelefonSeelsorge: 0800 111 0 111');
		expect(el.textContent).toContain('Not a substitute for medical advice');
		expect(el.textContent).toContain('(free, around the clock)');
	});

	it('#2063 AK2: Sprache en — beide Rahmungstexte englisch, Server-Daten unübersetzt', async () => {
		await i18next.changeLanguage('en');
		getCareSuggestions.mockResolvedValue({ vorschlaege: [vorlage] });
		const { unmount } = render(<CareHint />);
		let el = await zeigeHinweis();
		expect(el.textContent).toContain('Körper could use some care this week. Zehn Minuten spazieren gehen?');
		expect(el.textContent).not.toContain('kam diese Woche zu kurz');
		unmount();

		getCareSuggestions.mockResolvedValue({ vorschlaege: [{ ...vorlage, anlass: 'ueberlast' }] });
		render(<CareHint />);
		el = await zeigeHinweis();
		expect(el.textContent).toContain(
			'You have given a lot lately. Taking it easier today is allowed: Ein kurzer Spaziergang an der frischen Luft',
		);
		unmount();
	});

	it('#2063 AK2: Sprache en — KI-Kennzeichnung und Fehlermeldung englisch', async () => {
		await i18next.changeLanguage('en');
		getCareSuggestions.mockResolvedValue({ vorschlaege: [{ ...vorlage, typ: 'ki', templateKey: undefined }] });
		createTask.mockRejectedValue(new Error('boom'));
		render(<CareHint />);
		const el = await zeigeHinweis();
		expect(el.querySelector('[data-testid="care-hint-ki"]')?.textContent).toBe('AI suggestion');
		tap('Accept suggestion');
		await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
		expect(screen.getByRole('alert').textContent).toBe('Could not be created. Please try again in a moment.');
	});

	it('#2063 AK2: Sprache en — Leerzustand englisch', async () => {
		await i18next.changeLanguage('en');
		getCareSuggestions.mockResolvedValue({ vorschlaege: [] });
		render(<CareHint />);
		const el = await zeigeHinweis();
		expect(el.textContent).toContain('There is no suggestion for you right now. Keep going at your own pace.');
		expect(screen.queryAllByRole('button')).toHaveLength(0);
	});

	describe('#1873 KI-Vorschlag', () => {
		const ki: Vorschlag = {
			typ: 'ki',
			titel: 'Mit Anna wandern gehen',
			beschreibung: 'Du planst öfter Bewegung mit Freunden.',
			saeuleId: 3,
			saeuleName: 'Körper',
			saeulenBeitraege: [{ pillarId: 3, share: 100 }],
			anlass: 'defizit',
		};
		const kiKennzeichnung = (): HTMLElement | null => document.querySelector('[data-testid="care-hint-ki"]');

		it('AK5: KI-Kennzeichnung nur bei typ ki', async () => {
			getCareSuggestions.mockResolvedValue({ vorschlaege: [ki] });
			render(<CareHint />);
			await zeigeHinweis();
			expect(kiKennzeichnung()).not.toBeNull();
			cleanup();

			getCareSuggestions.mockResolvedValue({ vorschlaege: [vorlage] });
			render(<CareHint />);
			await zeigeHinweis();
			expect(kiKennzeichnung()).toBeNull();
		});

		it('AK6: Ablehnen → kein Dismissal-Request, lokal bis Tagesende, nach Remount weg', async () => {
			vi.useFakeTimers({ toFake: ['Date'] });
			vi.setSystemTime(new Date(2026, 5, 10, 12, 0, 0));
			getCareSuggestions.mockResolvedValue({ vorschlaege: [ki] });
			const { unmount } = render(<CareHint />);
			await zeigeHinweis();
			tap('Vorschlag ablehnen');
			await waitFor(() => expect(hint()).toBeNull());
			expect(dismissCareSuggestion).not.toHaveBeenCalled();
			unmount();

			vi.setSystemTime(new Date(2026, 5, 10, 23, 0, 0)); // gleicher Tag, „Reload"
			render(<CareHint />);
			await waitFor(() => expect(getCareSuggestions).toHaveBeenCalledTimes(2));
			await new Promise((resolve) => setTimeout(resolve, 0));
			expect(hint()).toBeNull();
			cleanup();

			vi.setSystemTime(new Date(2026, 5, 11, 1, 0, 0)); // Folgetag
			render(<CareHint />);
			await zeigeHinweis();
		});

		it('AK7: Übernehmen → createTask mit Titel, Beschreibung und Säulenbeitrag', async () => {
			getCareSuggestions.mockResolvedValue({ vorschlaege: [ki] });
			render(<CareHint />);
			await zeigeHinweis();
			tap('Vorschlag übernehmen');
			await waitFor(() => expect(hint()).toBeNull());
			expect(createTask).toHaveBeenCalledTimes(1);
			const { taskCreate } = createTask.mock.calls[0]![0];
			expect(taskCreate.title).toBe(ki.titel);
			expect(taskCreate.description).toBe(ki.beschreibung);
			expect(taskCreate.pillars).toEqual([{ pillarId: 3, share: 100, confidence: 100 }]);
		});
	});
});

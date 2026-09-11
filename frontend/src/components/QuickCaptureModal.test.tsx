import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import type { Pillar } from 'client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QuickCaptureModal } from './QuickCaptureModal';

afterEach(cleanup);

const pillars: Pillar[] = [{ id: 1, name: 'Körper', description: '', weight: 20 }];

/** Der Primär-CTA „Verarbeiten und weiter" als DOM-Element (gerendertes `kol-button`-Custom-Element). */
const processButton = (container: HTMLElement): Element | undefined =>
	[...container.querySelectorAll('kol-button')].find((el) => el.getAttribute('_label') === 'Verarbeiten und weiter');

/**
 * `_disabled` liegt als Prop am KoliBri-Custom-Element an. Beim **Mount** reicht React den booleschen
 * Wert als Attribut durch: `true` → Attribut gesetzt (Wert `""` oder `"true"`), `false` → Attribut
 * nicht vorhanden. Bei **Updates** schreibt React für Custom Elements dagegen die gleichnamige
 * Eigenschaft — das Attribut bleibt auf dem Mount-Wert stehen (#1335: `_disabled` blieb nach dem
 * Aktivieren des CTA weiterhin `""`). Deshalb zuerst die Eigenschaft lesen, Attribut nur als Fallback.
 */
const isDisabled = (button: Element | undefined): boolean => {
	if (button === undefined) return false;
	const property = (button as unknown as { _disabled?: unknown })._disabled;
	if (typeof property === 'boolean') return property;
	const raw = button.getAttribute('_disabled');
	return raw !== null && raw !== 'false';
};

/**
 * Tippt in die Capture-Textarea, indem der KoliBri-`onInput`-Callback am Host-Element aufgerufen wird
 * (Custom Elements sind in jsdom inert, ein echtes `input`-Event erreicht den Handler nicht).
 */
const typeCapture = async (container: HTMLElement, value: string): Promise<void> => {
	const textarea = container.querySelector('kol-textarea');
	await act(async () => {
		(textarea as unknown as { _on?: { onInput?: (event: Event, value: unknown) => void } })._on?.onInput?.(
			new Event('input'),
			value,
		);
	});
};

/**
 * Freitext-Gate des Primär-CTA „Verarbeiten und weiter" (#327 AK1, Weg seit #1335): Ohne Text bleibt
 * er `_disabled`, mit Text wird er aktiv. Der Text kommt ausschließlich aus dem Feld selbst — die
 * frühere Prop `initialText` ist mit #1335 entfallen, weil ihr einziger Aufrufer (der eigenständige
 * Berater-Dialog) ersatzlos weggefallen ist; die Übernahme eines Vorschlags schreibt seitdem direkt
 * in dieselbe Textarea (siehe AK3-Test weiter unten).
 */
describe('QuickCaptureModal — Freitext-Gate des Primär-CTA (#327)', () => {
	const props = { pillars, onClose: vi.fn(), onSaved: vi.fn() };

	it('lässt den CTA ohne Text deaktiviert (Ausgangsverhalten)', () => {
		const { container } = render(<QuickCaptureModal {...props} />);

		expect(isDisabled(processButton(container))).toBe(true);
	});

	it('aktiviert „Verarbeiten und weiter", sobald Text im Feld steht', async () => {
		const { container } = render(<QuickCaptureModal {...props} />);

		await typeCapture(container, 'Laufen gehen');

		expect(container.querySelector('kol-textarea')?.getAttribute('_value')).toBe('Laufen gehen');
		expect(isDisabled(processButton(container))).toBe(false);
	});
});

// ── #1213 (AK7): Empfängerauswahl auch in der Schnellerfassung ───────────────────────────────

/**
 * Rote Spec-Tests für #1213 (AK7, docs/spec/issue-1213.md): Die Schnellerfassung führt bekanntlich
 * in dasselbe TaskForm — nach „Überspringen" muss dort die Empfängerauswahl erscheinen, wenn der
 * Nutzer in mindestens einer Gruppe ist, und mit dem eigenen Konto vorbelegt sein.
 *
 * Ebene: wie die TaskForm-Tests von #1213 gemockte API (`api.listGroups`/`api.getGroupMembers`)
 * plus Stub des rohen `GET /api/v1/auth/me` (checkAuth). KoliBri bleibt hier ungemockt (Stil der
 * bestehenden Tests dieser Datei): Custom Elements sind in jsdom inaktiv, Props liegen als
 * Eigenschaften am Host-Element (`_options`, `_value`).
 */
vi.mock('../api', () => ({
	api: {
		listGroups: vi.fn(),
		getGroupMembers: vi.fn(),
		parseText: vi.fn(),
		advisePillarActivities: vi.fn(),
		createTask: vi.fn(),
		updateTask: vi.fn(),
		createSeries: vi.fn(),
		updateSeries: vi.fn(),
		suggestPillars: vi.fn().mockResolvedValue([]),
		geocodeSearch: vi.fn().mockResolvedValue([]),
	},
}));

import { api } from '../api';

const mockListGroups = api.listGroups as ReturnType<typeof vi.fn>;
const mockGetGroupMembers = api.getGroupMembers as ReturnType<typeof vi.fn>;
const mockParseText = api.parseText as ReturnType<typeof vi.fn>;

describe('QuickCaptureModal — Empfängerauswahl im Formular-Schritt (#1213 AK7)', () => {
	afterEach(() => {
		vi.clearAllMocks();
		vi.unstubAllGlobals();
		cleanup();
	});

	it('zeigt nach „Überspringen" die Empfängerauswahl mit eigenem Konto vorbelegt', async () => {
		mockListGroups.mockResolvedValue([{ id: 5, name: 'QCM Gruppe', description: null, role: 'admin', memberCount: 2 }]);
		mockGetGroupMembers.mockResolvedValue([
			{ userId: 1, displayName: 'Quin Schnell', role: 'admin' },
			{ userId: 2, displayName: 'Rita Rat', role: 'member' },
		]);
		vi.stubGlobal(
			'fetch',
			vi.fn(async (input: RequestInfo | URL) => {
				if (String(input).includes('/auth/me')) {
					return new Response(
						JSON.stringify({ id: 1, displayName: 'Quin Schnell', email: 'q@example.com', avatarUrl: null }),
						{ status: 200 },
					);
				}
				return new Response('{}', { status: 404 });
			}),
		);

		const { container } = render(<QuickCaptureModal {...{ pillars, onClose: vi.fn(), onSaved: vi.fn() }} />);

		// „Überspringen": KoliBri ist hier ungemockt und in jsdom inaktiv (kein Shadow-DOM, keine
		// Rolle) — der Click-Handler liegt als `_on`-Eigenschaft am Host und wird direkt gerufen.
		const skipButton = [...container.querySelectorAll('kol-button')].find(
			(el) => el.getAttribute('_label') === 'Überspringen',
		);
		expect(skipButton, '„Überspringen"-Button muss im Capture-Schritt gerendert werden').toBeTruthy();
		await act(async () => {
			(skipButton as unknown as { _on?: { onClick?: (event: MouseEvent) => void } })._on?.onClick?.(
				new MouseEvent('click'),
			);
		});

		const select = container.querySelector('kol-single-select[_label="Empfänger"]');
		expect(select, 'Empfänger-Auswahl muss im Formular-Schritt gerendert werden').toBeTruthy();

		const options = (select as unknown as { _options?: { label: string; value: string }[] })._options ?? [];
		expect(options.map((option) => option.label)).toContain('Rita Rat');

		// Vorbelegung: eigenes Konto (id 1 aus /auth/me).
		expect(String((select as unknown as { _value?: unknown })._value)).toBe('1');
	});
});

/**
 * Rote Spec-Tests für #1310 (TF4): Die neuen `ParsedTask`-Felder `isSeries`/`address`/`checklist`
 * müssen von `QuickCaptureModal.process()` in `TaskForm` (`initialMode` bzw. `initialValues`)
 * übernommen werden. Spec: `docs/spec/issue-1310.md`.
 *
 * KoliBri bleibt in dieser Datei ungemockt (Stil der bestehenden Tests) — Custom Elements sind in
 * jsdom inert, Zustand liegt als Attribut/Property am Host-Element (`_label`, `_value`).
 */
describe('QuickCaptureModal — erweiterte Schnellerfassung (#1310)', () => {
	afterEach(() => {
		vi.clearAllMocks();
		cleanup();
	});

	const props = { pillars, onClose: vi.fn(), onSaved: vi.fn() };

	/** Löst den Klick auf „Verarbeiten und weiter" aus (Host-`_on.onClick`, siehe processButton oben). */
	const clickProcess = async (container: HTMLElement): Promise<void> => {
		const button = processButton(container);
		await act(async () => {
			(button as unknown as { _on?: { onClick?: (event: MouseEvent) => void } })._on?.onClick?.(
				new MouseEvent('click'),
			);
		});
	};

	it('AK2: isSeries:true startet TaskForm im Serien-Modus (Rhythmus-Feld sichtbar)', async () => {
		mockParseText.mockResolvedValue({ title: 'Wöchentliches Teammeeting', isSeries: true });
		const { container } = render(<QuickCaptureModal {...props} />);
		await typeCapture(container, 'Jeden Montag Teammeeting');

		await clickProcess(container);

		await waitFor(() =>
			expect(
				container.querySelector('kol-single-select[_label="Rhythmus"]'),
				'Rhythmus-Feld = Serien-Modus',
			).toBeTruthy(),
		);
	});

	it('AK2: isSeries fehlend bleibt im Aufgaben-Modus (kein Rhythmus-Feld)', async () => {
		mockParseText.mockResolvedValue({ title: 'Einfacher Task' });
		const { container } = render(<QuickCaptureModal {...props} />);
		await typeCapture(container, 'Einfacher Task');

		await clickProcess(container);

		await waitFor(() => expect(container.querySelector('[data-testid="task-title"]')).toBeTruthy());
		expect(container.querySelector('kol-single-select[_label="Rhythmus"]')).toBeNull();
	});

	it('AK5: eine geparste Adresse befüllt das Adressfeld im Formular', async () => {
		mockParseText.mockResolvedValue({ title: 'Task mit Ortsbezug', address: 'Musterstraße 1, 12345 Musterstadt' });
		const { container } = render(<QuickCaptureModal {...props} />);
		await typeCapture(container, 'Termin in der Musterstraße 1');

		await clickProcess(container);

		await waitFor(() => {
			const field = container.querySelector('kol-input-text[_label="Adresse (optional)"]');
			expect(field?.getAttribute('_value')).toBe('Musterstraße 1, 12345 Musterstadt');
		});
	});

	it('AK6: geparste Checklisten-Punkte erzeugen Checklisten-Einträge im Formular', async () => {
		mockParseText.mockResolvedValue({ title: 'Task mit Checkliste', checklist: ['Punkt A', 'Punkt B'] });
		const { container } = render(<QuickCaptureModal {...props} />);
		await typeCapture(container, 'Erledige Punkt A und Punkt B');

		await clickProcess(container);

		await waitFor(() => {
			expect(container.querySelectorAll('[data-testid="checklist-item"]').length).toBe(2);
		});
	});
});

// ── #1335 (AK2/AK3/AK6): Verschmelzung mit dem Saeulen-Berater ───────────────────────────────

/**
 * Rote Spec-Tests fuer #1335 (AK2, AK3, AK6): der Berater-Weg "Beraten lassen" wird Teil des
 * Capture-Schritts von `QuickCaptureModal` - ohne dass ein zweiter Dialog entsteht oder die
 * bestehende Dialog-Instanz gewechselt wird. Ein uebernommener Vorschlag ("Als Aufgabe uebernehmen")
 * landet im selben Textfeld, statt den Dialog zu schliessen.
 *
 * Die Tests laufen ROT, weil `QuickCaptureModal` weder den CTA "Beraten lassen" noch
 * `api.advisePillarActivities` noch eine Uebernahme-Kette ins eigene Textfeld kennt.
 */
describe('QuickCaptureModal — Berater-Verschmelzung (#1335)', () => {
	afterEach(() => {
		vi.clearAllMocks();
		cleanup();
	});

	const props = { pillars, onClose: vi.fn(), onSaved: vi.fn() };

	it('AK2: zeigt im Capture-Schritt "Verarbeiten und weiter" UND "Beraten lassen" nebeneinander', () => {
		const { container } = render(<QuickCaptureModal {...props} />);

		const labels = [...container.querySelectorAll('kol-button')].map((el) => el.getAttribute('_label'));
		expect(labels).toContain('Verarbeiten und weiter');
		expect(labels).toContain('Beraten lassen');
	});

	it('AK2: "Beraten lassen" zeigt die Vorschlagsliste, ohne den Dialog zu wechseln oder zu duplizieren', async () => {
		const mockAdvise = api.advisePillarActivities as ReturnType<typeof vi.fn>;
		mockAdvise.mockResolvedValue({
			advice: [{ activity: 'Spaziergang im Park', reason: 'Bewegung.', pillarIds: [1] }],
		});

		const { container } = render(<QuickCaptureModal {...props} />);

		const adviseButton = [...container.querySelectorAll('kol-button')].find(
			(el) => el.getAttribute('_label') === 'Beraten lassen',
		);
		expect(adviseButton, '"Beraten lassen" muss im Capture-Schritt gerendert werden').toBeTruthy();
		await act(async () => {
			(adviseButton as unknown as { _on?: { onClick?: (event: MouseEvent) => void } })._on?.onClick?.(
				new MouseEvent('click'),
			);
		});

		await waitFor(() => expect(container.querySelector('.advisor-results')).toBeTruthy());
		// Das Capture-Textfeld bleibt im DOM - kein Dialog-/Schrittwechsel durch die Beratung.
		expect(container.querySelector('kol-textarea')).toBeTruthy();
	});

	it('AK3: "Als Aufgabe uebernehmen" schliesst den Dialog nicht, sondern befuellt das Capture-Textfeld', async () => {
		const mockAdvise = api.advisePillarActivities as ReturnType<typeof vi.fn>;
		mockAdvise.mockResolvedValue({
			advice: [{ activity: 'Spaziergang im Park', reason: 'Bewegung.', pillarIds: [1] }],
		});
		const onClose = vi.fn();

		const { container } = render(<QuickCaptureModal {...props} onClose={onClose} />);

		const adviseButton = [...container.querySelectorAll('kol-button')].find(
			(el) => el.getAttribute('_label') === 'Beraten lassen',
		);
		await act(async () => {
			(adviseButton as unknown as { _on?: { onClick?: (event: MouseEvent) => void } })._on?.onClick?.(
				new MouseEvent('click'),
			);
		});
		await waitFor(() => expect(container.querySelector('.advisor-results')).toBeTruthy());

		const adoptButton = [...container.querySelectorAll('kol-button')].find(
			(el) => el.getAttribute('_label') === 'Als Aufgabe übernehmen',
		);
		expect(adoptButton, '"Als Aufgabe übernehmen" muss je Vorschlag gerendert werden').toBeTruthy();
		// Test-Pflege (#1335): `AdvisorResults` hängt den Übernahme-Klick über React (`onClick`) an —
		// das ist ein delegierter Listener am Root, KEINE `onclick`-Eigenschaft am Host-Element. Ein
		// direkter `.onclick?.(…)`-Aufruf liefe wegen des Optional-Chainings wirkungslos ins Leere und
		// die Assertionen darunter wären ohne Klick rot. `fireEvent.click` ist derselbe Weg, den die
		// AdvisorResults-Tests seit #327 nutzen (`AdvisorResults.test.tsx:110`).
		await act(async () => {
			fireEvent.click(adoptButton as Element);
		});

		expect(onClose, 'Übernahme darf den Dialog nicht schließen').not.toHaveBeenCalled();

		const textarea = container.querySelector('kol-textarea');
		expect(textarea?.getAttribute('_value')).toBe('Spaziergang im Park');

		const processButtonEl = processButton(container);
		expect(isDisabled(processButtonEl)).toBe(false);
	});
});

/**
 * Übernommen aus `PillarAdvisorModal.test.tsx` (#440 AK3) — der Empty-State bei 0 Säulen hing am
 * eigenständigen Berater-Dialog, der mit #1335 entfallen ist. Geprüft wird dieselbe Zusage am neuen
 * Ort: Ohne Säulen kann der Berater nichts zuordnen, statt einer leeren Liste erscheint der
 * gestaltete Hinweis — und es geht keine Anfrage an `POST /pillars/advisor` raus.
 */
describe('QuickCaptureModal — Berater ohne Säulen (#440 AK3, seit #1335 im Anlege-Dialog)', () => {
	afterEach(() => {
		vi.clearAllMocks();
		cleanup();
	});

	const clickAdvise = async (container: HTMLElement): Promise<void> => {
		const adviseButton = [...container.querySelectorAll('kol-button')].find(
			(el) => el.getAttribute('_label') === 'Beraten lassen',
		);
		await act(async () => {
			(adviseButton as unknown as { _on?: { onClick?: (event: MouseEvent) => void } })._on?.onClick?.(
				new MouseEvent('click'),
			);
		});
	};

	it('zeigt bei pillars=[] den Hinweis „Keine Säulen definiert" statt einer Vorschlagsliste', async () => {
		const mockAdvise = api.advisePillarActivities as ReturnType<typeof vi.fn>;
		const { container } = render(<QuickCaptureModal pillars={[]} onClose={vi.fn()} onSaved={vi.fn()} />);

		await clickAdvise(container);

		expect(container.querySelector('kol-card')).toBeTruthy();
		expect(container.textContent ?? '').toMatch(/keine säulen definiert/i);
		expect(container.textContent ?? '').toMatch(/einstellungen/i);
		expect(container.querySelector('.advisor-results')).toBeNull();
		expect(mockAdvise, 'ohne Säulen keine LLM-Anfrage').not.toHaveBeenCalled();
	});

	it('fragt bei vorhandenen Säulen den Berater an und zeigt die Liste statt des Hinweises', async () => {
		const mockAdvise = api.advisePillarActivities as ReturnType<typeof vi.fn>;
		mockAdvise.mockResolvedValue({ advice: [{ activity: 'Yoga', reason: '', pillarIds: [1] }] });

		const { container } = render(<QuickCaptureModal pillars={pillars} onClose={vi.fn()} onSaved={vi.fn()} />);

		await clickAdvise(container);

		await waitFor(() => expect(container.querySelector('.advisor-results')).toBeTruthy());
		expect(mockAdvise).toHaveBeenCalledTimes(1);
		expect(container.querySelector('kol-card')).toBeNull();
	});
});

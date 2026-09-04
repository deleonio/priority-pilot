import { act, cleanup, render } from '@testing-library/react';
import type { Pillar } from 'client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QuickCaptureModal } from './QuickCaptureModal';

afterEach(cleanup);

const pillars: Pillar[] = [{ id: 1, name: 'Körper', description: '', weight: 20 }];

/** Der Primär-CTA „Verarbeiten und weiter" als DOM-Element (gerendertes `kol-button`-Custom-Element). */
const processButton = (container: HTMLElement): Element | undefined =>
	[...container.querySelectorAll('kol-button')].find((el) => el.getAttribute('_label') === 'Verarbeiten und weiter');

/**
 * `_disabled` liegt als Prop am KoliBri-Custom-Element an. React reicht den booleschen Wert als Attribut
 * durch: `true` → Attribut gesetzt (Wert `""` oder `"true"`), `false` → Attribut nicht vorhanden. Wir
 * lesen den Zustand daher über die Attribut-Präsenz, unabhängig von der genauen Serialisierung.
 */
const isDisabled = (button: Element | undefined): boolean => {
	if (button === undefined) return false;
	const raw = button.getAttribute('_disabled');
	return raw !== null && raw !== 'false';
};

/**
 * Rote Spec-Tests für #327 (AK1): `QuickCaptureModal` bekommt eine neue optionale Prop `initialText`.
 * Ist sie gesetzt, muss der Capture-Schritt den Text vorbelegen (Textarea-`_value`) UND der Primär-CTA
 * „Verarbeiten und weiter" muss ohne weitere Eingabe aktiv sein — sonst bliebe er trotz Text `_disabled`,
 * weil `hasText` sonst nicht gesetzt würde.
 *
 * Die Tests laufen ROT, weil `QuickCaptureModal` das Prop `initialText` noch nicht kennt und den Text
 * (und `hasText`) nicht vorbelegt.
 */
describe('QuickCaptureModal — Vorbelegung per initialText (#327)', () => {
	const props = { pillars, onClose: vi.fn(), onSaved: vi.fn() };

	it('belegt die Capture-Textarea mit dem übergebenen initialText vor', () => {
		const { container } = render(<QuickCaptureModal {...props} initialText="Laufen gehen" />);

		const textarea = container.querySelector('kol-textarea');
		expect(textarea?.getAttribute('_value')).toBe('Laufen gehen');
	});

	it('aktiviert „Verarbeiten und weiter" ohne weitere Eingabe, wenn initialText gesetzt ist', () => {
		const { container } = render(<QuickCaptureModal {...props} initialText="Laufen gehen" />);

		expect(isDisabled(processButton(container))).toBe(false);
	});

	it('lässt den CTA ohne initialText deaktiviert (Kontrolle des Ausgangsverhaltens)', () => {
		const { container } = render(<QuickCaptureModal {...props} />);

		expect(isDisabled(processButton(container))).toBe(true);
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

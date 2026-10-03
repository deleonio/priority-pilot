import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';

vi.mock('../api', () => ({
	api: {
		createTask: vi.fn(),
		updateTask: vi.fn(),
		deleteTask: vi.fn(),
	},
}));

import { api } from '../api';
import { EmptyState } from './EmptyState';

afterEach(cleanup);

const apiMock = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

/** `onReenter` existiert im Produktiv-Typ erst mit der Umsetzung — hier optional ergänzt (Intersection). */
type EmptyStateWithReenter = ComponentProps<typeof EmptyState> & { onReenter?: () => void };

const renderEmpty = (onReenter?: () => void): void => {
	const props: EmptyStateWithReenter = { onCreate: vi.fn(), ...(onReenter ? { onReenter } : {}) };
	render(<EmptyState {...(props as ComponentProps<typeof EmptyState>)} />);
};

describe('EmptyState — Beispielaufgaben und Wiedereinstieg (#2070, Spec AK3/AK4)', () => {
	it('zeigt mindestens drei abhakbare Beispielaufgaben in einer beschrifteten Gruppe — rein lokal, ohne Server-Call', () => {
		renderEmpty();

		const groupLabel = [...document.body.querySelectorAll('.empty-state p, .empty-state span')].find(
			(el) => el.textContent === 'Beispiele zum Ausprobieren',
		);
		expect(groupLabel, 'Gruppen-Beschriftung "Beispiele zum Ausprobieren" fehlt').toBeDefined();

		const boxes = document.body.querySelectorAll('.empty-state kol-input-checkbox');
		expect(boxes.length).toBeGreaterThanOrEqual(3);

		// Abhaken bleibt virtuell: kein einziger api-Call (PO-Entscheid #1986).
		const first = boxes[0] as unknown as { _on?: { onInput?: (event: Event, value: unknown) => void } } | undefined;
		act(() => {
			first?._on?.onInput?.(new Event('input'), true);
		});
		for (const fn of Object.values(apiMock)) {
			expect(fn).not.toHaveBeenCalled();
		}
	});

	it('heißt "Was beschäftigt dich gerade?" und bietet "Flow fortsetzen" → onReenter (Wiedereinstieg ohne Datenverlust)', () => {
		const onReenter = vi.fn();
		renderEmpty(onReenter);

		const card = document.body.querySelector('.empty-state kol-card');
		expect(card?.getAttribute('_label')).toBe('Was beschäftigt dich gerade?');

		const btn = [...document.body.querySelectorAll('.empty-state kol-button')].find(
			(el) => el.getAttribute('_label') === 'Flow fortsetzen',
		);
		expect(btn, 'Button "Flow fortsetzen" fehlt').toBeDefined();
		act(() => {
			(btn as unknown as { _on?: { onClick?: () => void } } | undefined)?._on?.onClick?.();
		});
		expect(onReenter).toHaveBeenCalledTimes(1);
	});

	// Spec issue-2110, AK2: unbenanntes div → benannte Gruppe (role="group" + aria-label).
	it('fasst die drei Beispielaufgaben als benannte Gruppe „Beispiele zum Ausprobieren“ zusammen (Spec issue-2110, AK2)', () => {
		const { getByRole } = render(<EmptyState onCreate={vi.fn()} />);
		const group = getByRole('group', { name: 'Beispiele zum Ausprobieren' });
		expect(group.querySelectorAll('kol-input-checkbox')).toHaveLength(3);
	});
});

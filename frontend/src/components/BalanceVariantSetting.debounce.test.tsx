import { act, cleanup, render } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BalanceVariantSetting } from './BalanceVariantSetting';

/**
 * Spec-Test #2560 AK2 (docs/spec/issue-2560.md): Der Shadow-DOM-Observer setzt das Zwei-Spalten-Raster
 * entprellt (100 ms, Muster `useShadowDOMLayout`) statt bei jeder einzelnen Mutation.
 */

let shadow: ShadowRoot | undefined;

vi.mock('@public-ui/react-v19', () => ({
	KolInputRadio: () =>
		createElement('kol-input-radio', {
			ref: (el: HTMLElement | null) => {
				if (el && !shadow) shadow = el.attachShadow({ mode: 'open' });
			},
		}),
}));

vi.mock('./HeartVessel', () => ({ HeartVessel: () => <div /> }));

vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

describe('BalanceVariantSetting — entprellter Observer (#2560 AK2)', () => {
	beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }));
	afterEach(() => {
		cleanup();
		shadow = undefined;
		vi.useRealTimers();
		localStorage.removeItem('pp-balance-variant');
	});

	it('setzt das Raster erst nach 100 ms Ruhe', async () => {
		render(<BalanceVariantSetting />);
		const root = shadow!;
		const list = document.createElement('div');
		list.className = 'kol-form-field__input';

		root.appendChild(list);
		await act(async () => {
			await Promise.resolve();
		});
		expect(list.style.display).toBe('');

		await act(async () => {
			vi.advanceTimersByTime(100);
		});
		expect(list.style.display).toBe('grid');
	});
});

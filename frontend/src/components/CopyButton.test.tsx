import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CopyButton } from './CopyButton';

/**
 * Rote Spec-Tests fürs PR-1422-Fixup (Review-Findings #1/#2) — deckt das falsche Erfolgssignal
 * ohne Clipboard-API und den verschluckten Kopier-Fehler ab.
 *
 * Muster: `.copy-button`-Span fängt den Klick ab (siehe `ApiTokensSection.test.tsx`, #1352) —
 * echte KoliBri-Custom-Elements, Klick per `dispatchEvent`.
 */

const click = (container: HTMLElement): void => {
	const span = container.querySelector('.copy-button');
	span?.dispatchEvent(new Event('click', { bubbles: true }));
};

const originalClipboard = navigator.clipboard;

afterEach(() => {
	cleanup();
	Object.defineProperty(navigator, 'clipboard', { value: originalClipboard, configurable: true, writable: true });
});

beforeEach(() => {
	Object.defineProperty(navigator, 'clipboard', {
		value: { writeText: vi.fn().mockResolvedValue(undefined) },
		configurable: true,
		writable: true,
	});
});

describe('CopyButton', () => {
	it('kopiert den Text und meldet Erfolg', async () => {
		const onSuccess = vi.fn();
		const onError = vi.fn();
		const { container } = render(
			<CopyButton text="hallo" ariaLabel="Kopieren" onSuccess={onSuccess} onError={onError} />,
		);

		await act(async () => {
			click(container);
			await Promise.resolve();
		});

		expect(navigator.clipboard.writeText).toHaveBeenCalledExactlyOnceWith('hallo');
		expect(onSuccess).toHaveBeenCalledOnce();
		expect(onError).not.toHaveBeenCalled();
	});

	it('meldet einen Fehler statt Erfolg, wenn navigator.clipboard fehlt', async () => {
		Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true, writable: true });
		const onSuccess = vi.fn();
		const onError = vi.fn();
		const { container } = render(
			<CopyButton text="hallo" ariaLabel="Kopieren" onSuccess={onSuccess} onError={onError} />,
		);

		await act(async () => {
			click(container);
			await Promise.resolve();
		});

		expect(onSuccess).not.toHaveBeenCalled();
		expect(onError).toHaveBeenCalledOnce();
	});

	it('meldet einen Fehler, wenn writeText abgelehnt wird', async () => {
		Object.defineProperty(navigator, 'clipboard', {
			value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
			configurable: true,
			writable: true,
		});
		const onSuccess = vi.fn();
		const onError = vi.fn();
		const { container } = render(
			<CopyButton text="hallo" ariaLabel="Kopieren" onSuccess={onSuccess} onError={onError} />,
		);

		await act(async () => {
			click(container);
			await Promise.resolve();
		});

		expect(onSuccess).not.toHaveBeenCalled();
		expect(onError).toHaveBeenCalledOnce();
	});
});

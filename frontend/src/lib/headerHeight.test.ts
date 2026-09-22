import { renderHook } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HEADER_HEIGHT_PROPERTY, useMeasuredHeaderHeight } from './headerHeight';

/**
 * Vertrag von `useMeasuredHeaderHeight`: Die randbündige Kopfzeile steht `fixed` und außerhalb des
 * Flusses; die Shell reserviert ihren Platz als Padding. Das rem-basierte CSS-Token trifft die Höhe
 * nur, solange die Leiste einzeilig bleibt — bei 200 % Textvergrößerung bricht sie um. Dieser Hook
 * meldet deshalb die TATSÄCHLICHE Höhe als CSS-Variable nach.
 *
 * - Beim Mount steht die gemessene Höhe an `<html>`.
 * - Größenänderungen (ResizeObserver) aktualisieren den Wert.
 * - Unveränderte Höhen schreiben NICHT erneut (kein Pendeln über einen Scrollbalken-Wechsel).
 * - Beim Unmount verschwindet die Variable, damit das CSS-Token wieder greift.
 * - Ohne `ResizeObserver` (älterer Browser, erster Paint) passiert nichts und nichts wirft.
 */

/** Minimaler ResizeObserver-Ersatz: merkt sich den Callback, damit der Test ihn auslösen kann. */
const installResizeObserver = (): { trigger: () => void; disconnected: () => boolean } => {
	let callback: (() => void) | null = null;
	let disconnected = false;
	class TestResizeObserver {
		constructor(cb: () => void) {
			callback = cb;
		}
		observe(): void {}
		disconnect(): void {
			disconnected = true;
		}
		unobserve(): void {}
	}
	vi.stubGlobal('ResizeObserver', TestResizeObserver);
	return { trigger: () => callback?.(), disconnected: () => disconnected };
};

/** Element mit fest eingestellter gemessener Höhe. */
const headerWithHeight = (height: number): HTMLElement => {
	const element = document.createElement('header');
	vi.spyOn(element, 'getBoundingClientRect').mockImplementation(() => ({ height }) as unknown as DOMRect);
	return element;
};

const measured = (): string | null => document.documentElement.style.getPropertyValue(HEADER_HEIGHT_PROPERTY) || null;

describe('useMeasuredHeaderHeight', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
		document.documentElement.style.removeProperty(HEADER_HEIGHT_PROPERTY);
	});

	it('schreibt die gemessene Höhe beim Mount an <html>', () => {
		installResizeObserver();
		const ref = createRef<HTMLElement>();
		(ref as { current: HTMLElement }).current = headerWithHeight(53);

		renderHook(() => useMeasuredHeaderHeight(ref));

		expect(measured()).toBe('53px');
	});

	it('rundet auf ganze Pixel auf, damit der reservierte Platz nie zu knapp ist', () => {
		installResizeObserver();
		const ref = createRef<HTMLElement>();
		(ref as { current: HTMLElement }).current = headerWithHeight(52.4);

		renderHook(() => useMeasuredHeaderHeight(ref));

		expect(measured()).toBe('53px');
	});

	it('aktualisiert den Wert, wenn die Leiste umbricht und höher wird', () => {
		const observer = installResizeObserver();
		const header = headerWithHeight(53);
		const ref = createRef<HTMLElement>();
		(ref as { current: HTMLElement }).current = header;

		renderHook(() => useMeasuredHeaderHeight(ref));
		vi.spyOn(header, 'getBoundingClientRect').mockImplementation(() => ({ height: 361 }) as unknown as DOMRect);
		observer.trigger();

		expect(measured()).toBe('361px');
	});

	it('schreibt bei unveränderter Höhe nicht erneut', () => {
		const observer = installResizeObserver();
		const ref = createRef<HTMLElement>();
		(ref as { current: HTMLElement }).current = headerWithHeight(53);

		renderHook(() => useMeasuredHeaderHeight(ref));
		const setProperty = vi.spyOn(document.documentElement.style, 'setProperty');
		observer.trigger();

		expect(setProperty).not.toHaveBeenCalled();
	});

	it('entfernt die Variable beim Unmount und trennt den Observer', () => {
		const observer = installResizeObserver();
		const ref = createRef<HTMLElement>();
		(ref as { current: HTMLElement }).current = headerWithHeight(53);

		const { unmount } = renderHook(() => useMeasuredHeaderHeight(ref));
		unmount();

		expect(measured()).toBeNull();
		expect(observer.disconnected()).toBe(true);
	});

	it('bleibt ohne ResizeObserver wirkungslos, statt zu werfen', () => {
		vi.stubGlobal('ResizeObserver', undefined);
		const ref = createRef<HTMLElement>();
		(ref as { current: HTMLElement }).current = headerWithHeight(53);

		expect(() => renderHook(() => useMeasuredHeaderHeight(ref))).not.toThrow();
		expect(measured()).toBeNull();
	});
});

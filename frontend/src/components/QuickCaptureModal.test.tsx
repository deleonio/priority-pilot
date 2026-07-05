import { cleanup, render } from '@testing-library/react';
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
		// @ts-expect-error: initialText ist noch nicht implementiert (rote Spec).
		const { container } = render(<QuickCaptureModal {...props} initialText="Laufen gehen" />);

		const textarea = container.querySelector('kol-textarea');
		expect(textarea?.getAttribute('_value')).toBe('Laufen gehen');
	});

	it('aktiviert „Verarbeiten und weiter" ohne weitere Eingabe, wenn initialText gesetzt ist', () => {
		// @ts-expect-error: initialText ist noch nicht implementiert (rote Spec).
		const { container } = render(<QuickCaptureModal {...props} initialText="Laufen gehen" />);

		expect(isDisabled(processButton(container))).toBe(false);
	});

	it('lässt den CTA ohne initialText deaktiviert (Kontrolle des Ausgangsverhaltens)', () => {
		const { container } = render(<QuickCaptureModal {...props} />);

		expect(isDisabled(processButton(container))).toBe(true);
	});
});

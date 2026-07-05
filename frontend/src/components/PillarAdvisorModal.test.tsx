import { cleanup, fireEvent, render } from '@testing-library/react';
import type { ActivityAdvice, Pillar } from 'client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdvisorResults } from './PillarAdvisorModal';

afterEach(cleanup);

const pillar = (id: number, name: string): Pillar => ({ id, name, description: '', weight: 20 });

/**
 * Der Säulen-Berater zeigt je Vorschlag die Aktivität, die betroffenen Säulen (als Badges, über
 * `pillarIds` gegen die Säulen-Liste aufgelöst) und die kurze Begründung. Diese Tests prüfen die
 * Ergebnisliste isoliert (ohne Dialog-Rahmen und ohne API-Aufruf).
 */
describe('AdvisorResults — Ergebnisliste des Säulen-Beraters', () => {
	const pillars = [pillar(1, 'Körper'), pillar(2, 'Beziehungen'), pillar(3, 'Sinn')];

	it('zeigt je Vorschlag Aktivität, Säulen-Badges und Begründung', () => {
		const advice: ActivityAdvice[] = [
			{ activity: 'Joggen im Park', reason: 'Bewegung an der frischen Luft.', pillarIds: [1] },
			{ activity: 'Spieleabend mit Freunden', reason: 'Gemeinsame Zeit.', pillarIds: [2, 3] },
		];

		const { container } = render(<AdvisorResults advice={advice} pillars={pillars} />);

		const items = container.querySelectorAll('.advisor-result');
		expect(items).toHaveLength(2);

		expect(items[0].querySelector('.advisor-activity')?.textContent).toBe('Joggen im Park');
		expect(items[0].querySelector('.advisor-reason')?.textContent).toBe('Bewegung an der frischen Luft.');
		expect(items[0].querySelectorAll('kol-badge')).toHaveLength(1);

		// Die pillarIds werden gegen die Säulen-Liste zu den Namen aufgelöst (Badge-Label).
		const badgeLabels = [...items[1].querySelectorAll('kol-badge')].map((badge) => badge.getAttribute('_label'));
		expect(badgeLabels).toEqual(['Beziehungen', 'Sinn']);
	});

	it('lässt die Begründung weg, wenn sie leer ist', () => {
		const advice: ActivityAdvice[] = [{ activity: 'Ehrenamt', reason: '', pillarIds: [3] }];

		const { container } = render(<AdvisorResults advice={advice} pillars={pillars} />);

		expect(container.querySelector('.advisor-activity')?.textContent).toBe('Ehrenamt');
		expect(container.querySelector('.advisor-reason')).toBeNull();
	});

	it('zeigt bei leerer Vorschlagsliste einen Hinweis statt einer Liste', () => {
		const { container } = render(<AdvisorResults advice={[]} pillars={pillars} />);

		expect(container.querySelector('.advisor-results')).toBeNull();
		expect(container.textContent).toMatch(/keine Vorschläge/i);
	});
});

/**
 * Rote Spec-Tests für #327 (AK2): Jeder Vorschlag bekommt genau EINE Aktion „Als Aufgabe übernehmen".
 * Ihr Klick meldet die Aktivität (`entry.activity`) über die neue Callback-Prop `onAdoptActivity` nach
 * oben — von dort öffnet der Aufrufer die Schnellerfassung mit dem Text vorbelegt.
 *
 * Die Tests laufen ROT, weil `AdvisorResults` die Prop `onAdoptActivity` und die „Als Aufgabe
 * übernehmen"-Aktion je Vorschlag noch nicht kennt.
 */
describe('AdvisorResults — „Als Aufgabe übernehmen" je Vorschlag (#327)', () => {
	const pillars = [pillar(1, 'Körper'), pillar(2, 'Beziehungen')];

	/** Die „Als Aufgabe übernehmen"-Buttons (gerenderte `kol-button`-Custom-Elemente). */
	const adoptButtons = (container: HTMLElement): Element[] =>
		[...container.querySelectorAll('kol-button')].filter((el) => el.getAttribute('_label') === 'Als Aufgabe übernehmen');

	it('rendert je Vorschlag genau eine Aktion „Als Aufgabe übernehmen"', () => {
		const advice: ActivityAdvice[] = [
			{ activity: 'Joggen im Park', reason: 'Bewegung.', pillarIds: [1] },
			{ activity: 'Spieleabend mit Freunden', reason: 'Gemeinsame Zeit.', pillarIds: [2] },
		];

		const { container } = render(
			// @ts-expect-error: onAdoptActivity ist noch nicht implementiert (rote Spec).
			<AdvisorResults advice={advice} pillars={pillars} onAdoptActivity={vi.fn()} />,
		);

		const items = container.querySelectorAll('.advisor-result');
		expect(items).toHaveLength(2);
		// Genau eine Aktion insgesamt je Vorschlag (zwei Vorschläge → zwei Buttons).
		expect(adoptButtons(container)).toHaveLength(2);
		// Und genau eine Aktion INNERHALB jedes einzelnen Vorschlags.
		for (const item of items) {
			const inItem = [...item.querySelectorAll('kol-button')].filter(
				(el) => el.getAttribute('_label') === 'Als Aufgabe übernehmen',
			);
			expect(inItem).toHaveLength(1);
		}
	});

	it('meldet beim Klick die Aktivität des jeweiligen Vorschlags an onAdoptActivity', () => {
		const onAdoptActivity = vi.fn();
		const advice: ActivityAdvice[] = [
			{ activity: 'Joggen im Park', reason: 'Bewegung.', pillarIds: [1] },
			{ activity: 'Spieleabend mit Freunden', reason: 'Gemeinsame Zeit.', pillarIds: [2] },
		];

		const { container } = render(
			// @ts-expect-error: onAdoptActivity ist noch nicht implementiert (rote Spec).
			<AdvisorResults advice={advice} pillars={pillars} onAdoptActivity={onAdoptActivity} />,
		);

		const buttons = adoptButtons(container);
		expect(buttons).toHaveLength(2);

		fireEvent.click(buttons[0]);
		expect(onAdoptActivity).toHaveBeenCalledWith('Joggen im Park');

		fireEvent.click(buttons[1]);
		expect(onAdoptActivity).toHaveBeenCalledWith('Spieleabend mit Freunden');
	});
});

import { cleanup, render } from '@testing-library/react';
import type { ActivityAdvice, Pillar } from 'client';
import { afterEach, describe, expect, it } from 'vitest';
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

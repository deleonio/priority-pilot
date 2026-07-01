import { cleanup, render } from '@testing-library/react';
import type { Pillar, Task, TaskPillarContribution, TaskTreeNode } from 'client';
import { TaskStatus } from 'client';
import { afterEach, describe, expect, it } from 'vitest';
import { Dashboard } from './Dashboard';

afterEach(cleanup);

const pillar = (id: number, name: string, weight: number): Pillar => ({ id, name, description: '', weight });

const task = (
	id: number,
	pillars: TaskPillarContribution[],
	estimatedEffort: number,
	status: Task['status'],
): Task => ({
	id,
	title: `T${id}`,
	status,
	priority: 3,
	estimatedEffort,
	actualEffort: null,
	description: null,
	deadline: null,
	seriesId: null,
	isException: false,
	pillars,
});

/**
 * AK4 (#124): Das Dashboard-Widget „Meine Themen" stellt je Säule den offenen und den erledigten
 * Anteil gegenüber. Dieser Komponententest rendert das Dashboard mit definierten Daten und prüft den
 * sichtbaren Text der jeweiligen Säulen-Kachel. Solange die Status-Aufschlüsselung in `Dashboard.tsx`
 * fehlt, ist der Test rot; er wird grün, sobald die Anzeige offen/erledigt je Säule ergänzt ist.
 */
describe('Dashboard — Meine Themen: offen/erledigt je Säule (#124)', () => {
	it('zeigt je Säule sowohl den offenen als auch den erledigten Anteil', () => {
		const koerper = pillar(1, 'Körper', 100);
		const tasks = [
			task(10, [{ pillarId: 1, share: 100, confidence: 100 }], 2, TaskStatus.Open),
			task(11, [{ pillarId: 1, share: 100, confidence: 100 }], 3, TaskStatus.Done),
		];

		const { container } = render(
			<Dashboard tasks={tasks} forest={[] as TaskTreeNode[]} nextTask={null} pillars={[koerper]} />,
		);

		const pillarItems = container.querySelectorAll('.dashboard-pillars-list .dashboard-pillar');
		expect(pillarItems).toHaveLength(1);

		const text = pillarItems[0].textContent ?? '';
		// Sowohl der offene (1 Task) als auch der erledigte (1 Task) Anteil müssen sichtbar sein.
		expect(text).toMatch(/1\s+offen/i);
		expect(text).toMatch(/1\s+erledigt/i);
	});
});

/**
 * #169: Das Dashboard begrüßt den Nutzer personalisiert mit „Hallo <Name>!". Der Name kommt als
 * `displayName`-Prop (von `App.tsx` aus `localStorage` gelesen). Diese Komponententests rendern das
 * Dashboard direkt mit der Prop und prüfen den sichtbaren Begrüßungstext. Bei leerem `displayName`
 * wird gar keine Begrüßung gerendert (kein Fallback-Name).
 */
describe('Dashboard — Personalisierte Begrüßung (#169)', () => {
	// AC1: Mit `displayName="Peter"` muss die Begrüßung „Hallo Peter!" sichtbar sein.
	it('zeigt „Hallo Peter!" wenn displayName="Peter" übergeben wird', () => {
		const { container } = render(
			<Dashboard tasks={[]} forest={[] as TaskTreeNode[]} nextTask={null} pillars={[]} displayName="Peter" />,
		);

		expect(container.textContent ?? '').toMatch(/Hallo\s+Peter!/i);
	});

	// AC2: Bei leerem displayName darf KEINE Begrüßung erscheinen (kein Fallback-Name).
	it('zeigt keine Begrüßung, wenn displayName leer ist', () => {
		const { container } = render(
			<Dashboard tasks={[]} forest={[] as TaskTreeNode[]} nextTask={null} pillars={[]} displayName="" />,
		);

		expect(container.textContent ?? '').not.toMatch(/Hallo/i);
		expect(container.querySelector('.dashboard-greeting')).toBeNull();
	});
});

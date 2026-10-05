import type { Task } from 'client';
import { describe, expect, it } from 'vitest';
import { tasksToCsv } from './taskCsv';

describe('tasksToCsv', () => {
	it('quotet Komma, Anführungszeichen und Zeilenumbruch und schreibt die Frist als JJJJ-MM-TT', () => {
		const csv = tasksToCsv([
			{
				id: 1,
				title: 'Brot, "frisch"',
				description: 'Zeile 1\nZeile 2',
				priority: 3,
				status: 'Open',
				deadline: new Date('2026-10-05T10:00:00Z'),
			} as unknown as Task,
		]);
		expect(csv.split('\n')[0]).toBe('Titel,Frist,Priorität,Status,Beschreibung');
		expect(csv).toContain('"Brot, ""frisch""",2026-10-05,3,Open,"Zeile 1\nZeile 2"');
	});
});

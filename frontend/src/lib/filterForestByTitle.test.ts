import type { TaskTreeNode } from 'client';
import { describe, expect, it } from 'vitest';
import { filterForestByTitle } from './filterForestByTitle';

const node = (
	id: number,
	title: string,
	dependents: TaskTreeNode[] = [],
	status: 'Open' | 'Done' = 'Open',
): TaskTreeNode => ({
	id,
	title,
	priority: 1,
	estimatedEffort: 1,
	totalEstimatedEffort: 1,
	value: 1,
	status,
	dependents,
});

describe('filterForestByTitle', () => {
	it('AK3-1: Leerer Suchstring liefert den ursprünglichen Wald', () => {
		const forest = [node(1, 'Parent', [node(2, 'Child')]), node(3, 'Other')];
		expect(filterForestByTitle(forest, '')).toEqual(forest);
	});

	it('AK3-2: Leerer Suchstring (Whitespace) liefert den ursprünglichen Wald', () => {
		const forest = [node(1, 'Parent', [node(2, 'Child')]), node(3, 'Other')];
		expect(filterForestByTitle(forest, '   ')).toEqual(forest);
	});

	it('AK3-3: Findet Tasks mit exaktem Titel-Treffer (case-insensitive)', () => {
		const forest = [node(1, 'Test Task'), node(2, 'Other Task')];
		const result = filterForestByTitle(forest, 'test task');
		expect(result).toHaveLength(1);
		expect(result[0].title).toBe('Test Task');
	});

	it('AK3-4: Findet Tasks mit Teilstring-Treffer (case-insensitive)', () => {
		const forest = [node(1, 'Important Meeting'), node(2, 'Other Task')];
		const result = filterForestByTitle(forest, 'meeting');
		expect(result).toHaveLength(1);
		expect(result[0].title).toBe('Important Meeting');
	});

	it('AK3-5: Behält Oberaufgaben als Kontext, wenn Unteraufgabe passt', () => {
		const forest = [node(1, 'Parent', [node(2, 'Child Task'), node(3, 'Other Child')])];
		const result = filterForestByTitle(forest, 'child task');
		// Parent bleibt als Kontext, nur der passende Child und der Parent bleiben
		expect(result).toHaveLength(1);
		expect(result[0].title).toBe('Parent');
		expect(result[0].dependents).toHaveLength(1);
		expect(result[0].dependents![0].title).toBe('Child Task');
	});

	it('AK3-6: Mehrere Treffer werden gefunden', () => {
		const forest = [node(1, 'Test Task'), node(2, 'Another Test'), node(3, 'Unrelated')];
		const result = filterForestByTitle(forest, 'test');
		expect(result).toHaveLength(2);
		expect(result[0].title).toBe('Test Task');
		expect(result[1].title).toBe('Another Test');
	});

	it('AK3-7: Kein Treffer liefert leeren Wald', () => {
		const forest = [node(1, 'Test Task'), node(2, 'Other Task')];
		const result = filterForestByTitle(forest, 'nonexistent');
		expect(result).toHaveLength(0);
	});

	it('AK3-8: Tiefe Baumstruktur mit mehreren Ebenen', () => {
		const forest = [node(1, 'Level 1', [node(2, 'Level 2', [node(3, 'Level 3 Target')])])];
		const result = filterForestByTitle(forest, 'target');
		// Alle Ebenen bleiben als Kontext erhalten
		expect(result).toHaveLength(1);
		expect(result[0].title).toBe('Level 1');
		expect(result[0].dependents).toHaveLength(1);
		expect(result[0].dependents![0].title).toBe('Level 2');
		expect(result[0].dependents![0].dependents).toHaveLength(1);
		expect(result[0].dependents![0].dependents![0].title).toBe('Level 3 Target');
	});

	it('AK3-9: Mehrere Wurzeln mit teilweisen Treffern', () => {
		const forest = [
			node(1, 'Tree A', [node(2, 'Child A1'), node(3, 'Target Child')]),
			node(4, 'Tree B', [node(5, 'Child B1')]),
			node(6, 'Tree C'),
		];
		const result = filterForestByTitle(forest, 'target');
		// Nur Tree A bleibt (wegen Target Child)
		expect(result).toHaveLength(1);
		expect(result[0].title).toBe('Tree A');
		expect(result[0].dependents).toHaveLength(1);
		expect(result[0].dependents![0].title).toBe('Target Child');
	});

	it('AK3-10: Umlaute und Sonderzeichen werden korrekt behandelt', () => {
		const forest = [node(1, 'Ärger mit Übeltäter'), node(2, 'Other Task')];
		const result = filterForestByTitle(forest, 'übelt');
		expect(result).toHaveLength(1);
		expect(result[0].title).toBe('Ärger mit Übeltäter');
	});
});

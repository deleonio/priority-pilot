import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PUSH_TARGETS } from './pushTargets.js';

/**
 * Rote Spec-Tests für #2851 (Vertrag: docs/spec/issue-2851.md): die Push-Ziele je Push-Art
 * stehen in EINER Server-Liste (AK2), und ein Spiegel-Test gleicht die `/#karte-…`-Anker der
 * Liste mit den `id="karte-…"`-Ankern im Frontend ab (AK4, Muster careDeficit.test.ts:146-170).
 */
describe('pushTargets (#2851 AK2) — die §6-Ziele je Push-Art in einer Liste', () => {
	it('enthält je Push-Art das Ziel aus docs/push-konzept.md §6 (Regel „eine Aufgabe vs. mehrere" als Funktion)', () => {
		assert.equal(PUSH_TARGETS.dueTask.eine(7), '/tasks/7');
		assert.equal(PUSH_TARGETS.dueTask.mehrere, '/#karte-deadlines');
		assert.equal(PUSH_TARGETS.dailyTopTasks.eine(7), '/tasks/7');
		assert.equal(PUSH_TARGETS.dailyTopTasks.mehrere, '/#karte-top-aufgaben');
		assert.equal(PUSH_TARGETS.carePush, '/#karte-fuersorge');
		assert.equal(PUSH_TARGETS.streakReminder, '/#karte-streak');
		assert.equal(PUSH_TARGETS.monthlyRecap, '/#karte-monatsrueckblick');
		assert.equal(PUSH_TARGETS.milestone, '/#karte-meilensteine');
		assert.equal(PUSH_TARGETS.taskCreated(7), '/tasks/7');
		assert.equal(PUSH_TARGETS.taskCompleted(7), '/tasks/7');
		assert.equal(PUSH_TARGETS.seriesGenerated, '/serien');
	});

	it('AK4: jeder karte-…-Anker der Server-Liste existiert als id="…" im Frontend (Spiegel)', () => {
		const quelltext = [
			'Dashboard.tsx',
			'CareHint.tsx',
			'StreakCard.tsx',
			'MonthlyBalanceCard.tsx',
			'MilestoneBadges.tsx',
		]
			.map((datei) => readFileSync(new URL(`../../../frontend/src/components/${datei}`, import.meta.url), 'utf8'))
			.join('\n');
		const ziele = [
			PUSH_TARGETS.dueTask.mehrere,
			PUSH_TARGETS.dailyTopTasks.mehrere,
			PUSH_TARGETS.carePush,
			PUSH_TARGETS.streakReminder,
			PUSH_TARGETS.monthlyRecap,
			PUSH_TARGETS.milestone,
		];
		for (const ziel of ziele) {
			const anker = ziel.replace(/^\/#/, '');
			assert.match(
				quelltext,
				new RegExp(`id="${anker}"`),
				`Anker ${ziel} fehlt im Frontend (Spiegel #2851 AK4) — Anker nachziehen oder Listeneintrag korrigieren`,
			);
		}
	});
});

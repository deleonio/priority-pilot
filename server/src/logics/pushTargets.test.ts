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

	// #2852 (docs/spec/issue-2852.md): Abo-/Rechnungs-Service-Pushes zielen auf den Pakete-Tab.
	it('#2852: aboInvoice zeigt auf /settings/pakete#rechnungen, aboStatus auf /settings/pakete', () => {
		assert.equal(PUSH_TARGETS.aboInvoice, '/settings/pakete#rechnungen');
		assert.equal(PUSH_TARGETS.aboStatus, '/settings/pakete');
	});

	// Spiegel (#2852 AK7): der Rechnungen-Anker existiert als id="rechnungen" im Frontend.
	it('#2852: der rechnungen-Anker existiert als id="rechnungen" in SubscriptionSection (Spiegel)', () => {
		const quelltext = readFileSync(
			new URL('../../../frontend/src/components/SubscriptionSection.tsx', import.meta.url),
			'utf8',
		);
		assert.match(
			quelltext,
			/id="rechnungen"/,
			'Anker /settings/pakete#rechnungen fehlt im Frontend (Spiegel #2852 AK7)',
		);
	});

	// #2855 AK8: die sechs neuen Push-Ziele — Karte-Anker per Spiegel an die Frontend-Ids gebunden.
	it('#2855 AK8: neue Ziele mit Spiegel-Ankern (Dashboard/Weekly/Yearly/WelcomeSteps)', () => {
		assert.equal(PUSH_TARGETS.appreciation, '/#karte-balance');
		assert.equal(PUSH_TARGETS.welcomeBack, '/#karte-balance');
		assert.equal(PUSH_TARGETS.weeklyRecap, '/#karte-wochenrueckblick');
		assert.equal(PUSH_TARGETS.yearlyRecap, '/#karte-jahresrueckblick');
		assert.equal(PUSH_TARGETS.welcomeSteps, '/#karte-willkommen');
		assert.equal(PUSH_TARGETS.journalImpulse, '/journal');

		const quelltext = ['Dashboard.tsx', 'WeeklyBalanceCard.tsx', 'YearlyRecapCard.tsx', 'WelcomeSteps.tsx']
			.map((datei) => readFileSync(new URL(`../../../frontend/src/components/${datei}`, import.meta.url), 'utf8'))
			.join('\n');
		for (const anker of ['karte-balance', 'karte-wochenrueckblick', 'karte-jahresrueckblick', 'karte-willkommen']) {
			assert.match(quelltext, new RegExp(`id="${anker}"`), `Anker #${anker} fehlt im Frontend (Spiegel #2855)`);
		}
	});
});

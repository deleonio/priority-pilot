import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Task, Series } from '../models/index.js';
import { resetDb, closeDb } from '../test/helpers.js';
import { runDeadlineAutoDelete } from './autoDeleteAfterDeadline.js';
import { generateDueInstances } from './series.js';

/**
 * Rote Spec-Tests für Issue #523 — „Automatisches Löschen von Aufgaben mit abgelaufener Deadline".
 *
 * Fachlicher Cron-Trigger `runDeadlineAutoDelete` (Vorbild: `dueTaskReminders` aus #355, jedoch löschend
 * statt benachrichtigend). Erwartete, noch nicht existierende Schnittstelle:
 *   runDeadlineAutoDelete(now?: Date): Promise<{ deleted: number }>
 * Regel: löscht jeden Task, bei dem `autoDeleteAfterDeadline === true` UND `status !== 'Done'` UND
 * `deadline != null` UND `deadline + 3 Tage <= now` ist. Gibt die Anzahl der gelöschten Tasks zurück.
 *
 * **Aufgelöste offene Entscheidungen (für die Umsetzung verbindlich):**
 *  - Frist: fest auf 3 Tage hardcodiert (nicht konfigurierbar) — entspricht dem AK „3 Tage nach
 *    Deadline-Ablauf", Minimalprinzip.
 *  - Schwellwert: **inklusiv ≥ 3 Tage** (`deadline + 3d <= now`); bei exakt 3 Tagen wird also gelöscht
 *    (siehe Grenzwert-Test). Konsistent zu `dueTaskReminders` (`Op.lte`).
 *  - Benachrichtigung: keine separate Vorab-Benachrichtigung; die „Info beim Anlegen/Bearbeiten" (AK6)
 *    ist reine Frontend-Sache (Checkbox-Hinweis, siehe TaskForm-Tests).
 *
 * Das Modul `autoDeleteAfterDeadline` wird per Import referenziert (existiert noch nicht → Tests rot).
 * Kein Produktivcode.
 */

const NOW = new Date('2026-07-07T08:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

type TaskOverrides = Partial<{
	title: string;
	status: 'Open' | 'In process' | 'Done';
	deadline: Date | null;
	autoDeleteAfterDeadline: boolean;
}>;

const createTask = (overrides: TaskOverrides = {}) =>
	Task.create({
		title: overrides.title ?? 'Task',
		status: overrides.status ?? 'Open',
		priority: 3,
		estimatedEffort: 0.5,
		deadline: overrides.deadline ?? null,
		autoDeleteAfterDeadline: overrides.autoDeleteAfterDeadline ?? false,
	});

describe('logics/autoDeleteAfterDeadline — Cron-Löschung bei verpasster Deadline (Issue #523)', () => {
	beforeEach(async () => {
		await resetDb();
	});
	after(async () => {
		await closeDb();
	});

	it('löscht eine offene Aufgabe mit aktivierter Option, deren Deadline >3 Tage abgelaufen ist (AK2 + AK8)', async () => {
		const task = await createTask({
			title: 'Müll rausbringen',
			deadline: new Date(NOW.getTime() - 4 * DAY),
			autoDeleteAfterDeadline: true,
		});

		const result = await runDeadlineAutoDelete(NOW);

		assert.equal(result.deleted, 1, 'genau eine Aufgabe wird gelöscht');
		assert.equal(await Task.findByPk(task.id), null, 'die Aufgabe ist aus der DB entfernt — Backlog bereinigt');
	});

	it('löscht eine Aufgabe im Status "In process" ebenfalls (Bedingung gilt für alle Status ≠ Done)', async () => {
		const task = await createTask({
			title: 'In Arbeit',
			status: 'In process',
			deadline: new Date(NOW.getTime() - 5 * DAY),
			autoDeleteAfterDeadline: true,
		});

		await runDeadlineAutoDelete(NOW);

		assert.equal(await Task.findByPk(task.id), null, 'nicht-erledigte Aufgabe wird gelöscht');
	});

	it('löscht eine erledigte Aufgabe NICHT, auch wenn Deadline und Option zutreffen (Status ≠ Done)', async () => {
		const task = await createTask({
			title: 'Erledigt',
			status: 'Done',
			deadline: new Date(NOW.getTime() - 4 * DAY),
			autoDeleteAfterDeadline: true,
		});

		const result = await runDeadlineAutoDelete(NOW);

		assert.equal(result.deleted, 0, 'erledigte Aufgabe wird nicht gelöscht');
		assert.notEqual(await Task.findByPk(task.id), null, 'erledigte Aufgabe bleibt erhalten');
	});

	it('löscht eine abgelaufene Aufgabe ohne aktivierte Option NICHT (autoDeleteAfterDeadline = false)', async () => {
		const task = await createTask({
			title: 'Ohne Auto-Delete',
			deadline: new Date(NOW.getTime() - 4 * DAY),
			autoDeleteAfterDeadline: false,
		});

		await runDeadlineAutoDelete(NOW);

		assert.notEqual(await Task.findByPk(task.id), null, 'Aufgabe ohne Option bleibt erhalten');
	});

	it('löscht eine Aufgabe ohne Deadline NICHT (kein Trigger — AK3/4 der Testfall-Tabelle)', async () => {
		const task = await createTask({
			title: 'Keine Deadline',
			deadline: null,
			autoDeleteAfterDeadline: true,
		});

		await runDeadlineAutoDelete(NOW);

		assert.notEqual(await Task.findByPk(task.id), null, 'Aufgabe ohne Deadline wird nicht gelöscht');
	});

	it('Schwellwert ≥3 Tage: exakt 3 Tage → gelöscht; knapp unter 3 Tagen → bleibt erhalten (Grenzwert AK6)', async () => {
		const exact = await createTask({
			title: 'Exakt 3 Tage',
			deadline: new Date(NOW.getTime() - 3 * DAY),
			autoDeleteAfterDeadline: true,
		});
		const justUnder = await createTask({
			title: 'Knapp unter 3 Tagen',
			deadline: new Date(NOW.getTime() - 3 * DAY + 1),
			autoDeleteAfterDeadline: true,
		});

		const result = await runDeadlineAutoDelete(NOW);

		assert.equal(await Task.findByPk(exact.id), null, 'bei exakt 3 Tagen wird gelöscht (inklusiver Schwellwert)');
		assert.notEqual(await Task.findByPk(justUnder.id), null, 'kurz vor 3 Tagen wird noch nicht gelöscht');
		assert.equal(result.deleted, 1, 'nur die Aufgabe ab dem Schwellwert wird gezählt');
	});

	it('löscht alle passenden Aufgaben in einem Lauf und zählt sie korrekt', async () => {
		await createTask({ title: 'A', deadline: new Date(NOW.getTime() - 4 * DAY), autoDeleteAfterDeadline: true });
		await createTask({ title: 'B', deadline: new Date(NOW.getTime() - 6 * DAY), autoDeleteAfterDeadline: true });
		await createTask({ title: 'C', deadline: new Date(NOW.getTime() - 4 * DAY), autoDeleteAfterDeadline: false });

		const result = await runDeadlineAutoDelete(NOW);

		assert.equal(result.deleted, 2, 'zwei passende Aufgaben werden gelöscht, die dritte (ohne Option) nicht');
		assert.equal(await Task.count(), 1, 'nur die nicht passende Aufgabe bleibt in der DB');
	});
});

describe('logics/autoDeleteAfterDeadline — Vererbung vom Series-Template (Issue #523, AK4)', () => {
	beforeEach(async () => {
		await resetDb();
	});
	after(async () => {
		await closeDb();
	});

	it('generierte Serien-Instanz erbt autoDeleteAfterDeadline vom Template', async () => {
		const series = await Series.create({
			title: 'Müll rausbringen',
			rhythm: 'daily',
			priority: 3,
			estimatedEffort: 0.5,
			active: true,
			startDate: new Date('2020-01-01T00:00:00Z'),
			autoDeleteAfterDeadline: true,
		});

		const instances = await generateDueInstances(series, { until: new Date(Date.now() + 7 * DAY) });

		assert.ok(instances.length > 0, 'mindestens eine Instanz wird generiert');
		for (const instance of instances) {
			assert.equal(
				instance.autoDeleteAfterDeadline,
				true,
				'jede generierte Instanz erbt autoDeleteAfterDeadline vom Template',
			);
		}
	});
});

/**
 * Regression-Guard / Spec für #534, AK5 — „Auto-Löschen nach 3 Tagen bei verpasster Deadline greift auch
 * bei Serien-Aufgaben".
 *
 * Serien-Instanzen sind reguläre `Task`-Datensätze mit gesetzem `seriesId`/`seriesOccurrence` und einer
 * aus dem Serien-Raster abgeleiteten `deadline` (siehe `generateDueInstances`). Der Cron darf sie nicht
 * ausschließen: eine verpasste Serien-Instanz mit vererbtem `autoDeleteAfterDeadline` wird wie jede andere
 * Aufgabe nach Ablauf der 3-Tage-Frist gelöscht — und zwar nur diese Einzelinstanz, nicht das Template
 * oder künftige Instanzen.
 *
 * **Status:** Der bestehende #523-Cron filtert nicht nach `seriesId`, sodass diese Guard vermutlich
 * bereits GRÜN ist. Sie sichert das Verhalten explizit für den #534-Erweiterungsfall, in dem der
 * Auto-Löschen-Schalter erstmals auch auf Serien-Templates gesetzt werden kann.
 */
describe('logics/autoDeleteAfterDeadline — greift auch bei Serien-Aufgaben (Issue #534, AK5)', () => {
	beforeEach(async () => {
		await resetDb();
	});
	after(async () => {
		await closeDb();
	});

	it('löscht eine verpasste Serien-Instanz (seriesId gesetzt) wie eine reguläre Aufgabe', async () => {
		const series = await Series.create({
			title: 'Wöchentlich aufräumen',
			rhythm: 'weekly',
			priority: 3,
			estimatedEffort: 0.5,
			active: true,
			startDate: new Date('2020-01-01T00:00:00Z'),
			autoDeleteAfterDeadline: true,
		});

		// Eine materialisierte Serien-Instanz: deadline (occurrence) >3 Tage vergangen, Option vererbt.
		const instance = await Task.create({
			title: series.title,
			status: 'Open',
			priority: series.priority,
			estimatedEffort: series.estimatedEffort,
			deadline: new Date(NOW.getTime() - 4 * DAY),
			seriesId: series.id,
			seriesOccurrence: new Date(NOW.getTime() - 4 * DAY),
			isException: false,
			autoDeleteAfterDeadline: true,
		});

		const result = await runDeadlineAutoDelete(NOW);

		assert.equal(result.deleted, 1, 'die verpasste Serien-Instanz wird gelöscht');
		assert.equal(await Task.findByPk(instance.id), null, 'die Einzelinstanz ist entfernt');
		// Das Serien-Template bleibt unangetastet (nur die Instanz wird gelöscht, nicht die Serie).
		assert.notEqual(await Series.findByPk(series.id), null, 'das Serien-Template bleibt erhalten');
	});

	it('löscht nur die verpasste Einzelinstanz, nicht künftige Instanzen derselben Serie', async () => {
		const series = await Series.create({
			title: 'Tägliche Serie',
			rhythm: 'daily',
			priority: 3,
			estimatedEffort: 0.5,
			active: true,
			startDate: new Date('2020-01-01T00:00:00Z'),
			autoDeleteAfterDeadline: true,
		});

		// Eine verpasste (>3 Tage) …
		const overdue = await Task.create({
			title: 'überfällig',
			status: 'Open',
			priority: 3,
			estimatedEffort: 0.5,
			deadline: new Date(NOW.getTime() - 4 * DAY),
			seriesId: series.id,
			seriesOccurrence: new Date(NOW.getTime() - 4 * DAY),
			isException: false,
			autoDeleteAfterDeadline: true,
		});
		// … und eine noch nicht fällige Serien-Instanz (deadline in der Zukunft).
		const upcoming = await Task.create({
			title: 'zukünftig',
			status: 'Open',
			priority: 3,
			estimatedEffort: 0.5,
			deadline: new Date(NOW.getTime() + 1 * DAY),
			seriesId: series.id,
			seriesOccurrence: new Date(NOW.getTime() + 1 * DAY),
			isException: false,
			autoDeleteAfterDeadline: true,
		});

		const result = await runDeadlineAutoDelete(NOW);

		assert.equal(result.deleted, 1, 'nur die überfällige Instanz wird gelöscht');
		assert.equal(await Task.findByPk(overdue.id), null, 'die überfällige Einzelinstanz ist entfernt');
		assert.notEqual(await Task.findByPk(upcoming.id), null, 'die zukünftige Instanz bleibt erhalten');
	});
});

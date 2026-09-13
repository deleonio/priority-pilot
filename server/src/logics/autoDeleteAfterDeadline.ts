import { Op } from 'sequelize';
import { Task, MissedTask } from '../models/index.js';
import sequelize from '../database.js';

/**
 * Fachlicher Cron-Trigger „Auto-Löschung bei verpasster Deadline" (Issue #523). Das Pendant zum
 * benachrichtigenden `dueTaskReminders` (#355) — hier löschend statt meldend.
 *
 * Regel (verbindlich für die Umsetzung, siehe Spec-Tests `autoDeleteAfterDeadline.test.ts`):
 * Eine Aufgabe wird gelöscht, wenn **alle** Bedingungen zutreffen:
 *  - `autoDeleteAfterDeadline === true` (Nutzer hat die Option aktiv gesetzt),
 *  - `status !== 'Done'` (nur nicht-erledigte Aufgaben werden bereinigt),
 *  - `deadline != null` (ohne Deadline gibt es keinen Trigger),
 *  - `deadline + 3 Tage <= now` — **inklusiver** Schwellwert (≥ 3 Tage), konsistent zu `dueTaskReminders`
 *    (`Op.lte`). Bei exakt 3 Tagen wird also gelöscht, knapp darunter noch nicht.
 *
 * Die Frist ist fest auf 3 Tage hardcodiert (Minimalprinzip, entspricht dem AK „3 Tage nach
 * Deadline-Ablauf"); eine separate Vorab-Benachrichtigung gibt es nicht (die Info beim Anlegen/Bearbeiten
 * ist reine Frontend-Sache, siehe TaskForm).
 *
 * Für jede gelöschte Aufgabe wird zusätzlich (in derselben Transaktion) ein `MissedTask`-Schnappschuss
 * geschrieben — rein informativ fürs Bewertungssystem (sichtbare Kennzahl „verpasste Aufgaben"), ohne
 * Auswirkung auf Punkte/Streak (`score.ts`/`streak.ts` bleiben unberührt).
 *
 * Gibt die Anzahl der gelöschten Aufgaben zurück.
 */

/** Karenzzeit: 3 Tage nach Deadline-Ablauf, bevor die Aufgabe automatisch gelöscht wird. */
const AUTO_DELETE_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

export const runDeadlineAutoDelete = async (now: Date = new Date()): Promise<{ deleted: number }> => {
	// `deadline <= now - 3d` ⟺ `deadline + 3d <= now` (inklusiver ≥-Schwellwert).
	const threshold = new Date(now.getTime() - AUTO_DELETE_GRACE_MS);
	const where = {
		autoDeleteAfterDeadline: true,
		status: { [Op.ne]: 'Done' },
		deadline: { [Op.ne]: null, [Op.lte]: threshold },
	};

	const candidates = await Task.findAll({
		where,
		attributes: ['id', 'userId', 'title', 'deadline', 'priority'],
	});
	if (candidates.length === 0) {
		return { deleted: 0 };
	}

	const deleted = await sequelize.transaction(async (transaction) => {
		await MissedTask.bulkCreate(
			candidates.map((task) => ({
				taskId: task.id,
				userId: task.userId,
				title: task.title,
				deadline: task.deadline,
				priority: task.priority,
				verpasstAm: now,
			})),
			{ transaction },
		);
		return Task.destroy({
			where: { ...where, id: candidates.map((task) => task.id) },
			transaction,
		});
	});

	return { deleted };
};

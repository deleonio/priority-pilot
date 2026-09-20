import { Pillar, Task, TaskPillar, User } from '../models/index.js';
import sequelize from '../database.js';
import type { FeedbackExample, PillarClassifier } from '../llm/llm.js';
import { loadFeedbackExamples } from './pillarFeedbackExamples.js';

/**
 * Batch-Neuzuordnung der Säulen-Beiträge („Säulenverteilung"): Berechnet für die Aufgaben
 * eines Ziel-Nutzers die TaskPillar-Zuordnungen anhand des Aufgabenkontexts (Titel/
 * Beschreibung) über den KI-Klassifikator NEU und speichert sie — auch für bereits
 * erledigte Aufgaben (`status === 'Done'`). Status, Punkte (ScoreEntries) und Streak
 * bleiben dabei unberührt: Der Batch öffnet Aufgaben NICHT wieder im Sinne eines
 * Statuswechsels, er „öffnet" sie nur für die Neuberechnung ihrer Verteilung.
 *
 * Muster wie `autoDeleteAfterDeadline.ts` (eigenständige, testbare Batch-Funktion) plus
 * injizierbarer Klassifikator (Muster `createSuggestPillarsRouter`, Tests ohne echten
 * API-Call). Pro Aufgabe gilt:
 *  - Klassifikation mit den SÄULEN DES EIGENTÜMERS (`userId`-Scope, #430-Datenisolation)
 *    plus dessen Few-Shot-Korrektur-Beispielen,
 *  - Zuordnungen mit `share`-Summe 100 (proportional aus der Konfidenz normalisiert),
 *  - Ersetzung der TaskPillar-Zeilen in EINER Transaktion je Aufgabe
 *    (`destroy` + `bulkCreate({ validate: true })`, kanonisches Muster aus routes/tasks.ts),
 *  - ein Fehler darf den Batch nicht abreißen: Die Aufgabe wird als fehlgeschlagen
 *    gezählt und der Lauf setzt sich fort.
 *
 * Ohne Säulen am Konto wird der Nutzer übersprungen (wie der 503-Fall von
 * /tasks/suggest-pillars — hier still, weil der Batch viele Konten in einem Lauf
 * abarbeitet). Nutzer ohne eigene Säulen und ohne Aufgaben werden nicht gezählt.
 */

/**
 * Normalisiert die Konfidenz-Vorschläge des Klassifikators auf eine `share`-Verteilung
 * mit Summe 100: Die Konfidenzen werden proportional aufgeteilt (gleicher Mechanismus
 * wie im Frontend beim Übernehmen der Vorschläge). Ungültige IDs (Säule des Fremdkontos,
 * Dubletten, Konfidenz <= 0) fallen vorher raus. Liefert `[]`, wenn nichts Gültiges
 * bleibt — dann wird die bestehende Zuordnung des Tasks unverändert gelassen.
 */
const toContributions = (
	suggestions: { pillarId: number; confidence: number }[],
	validIds: ReadonlySet<number>,
): { pillarId: number; share: number; confidence: number }[] => {
	const seen = new Set<number>();
	const usable = suggestions.filter((entry) => {
		if (!validIds.has(entry.pillarId) || seen.has(entry.pillarId)) {
			return false;
		}
		if (typeof entry.confidence !== 'number' || !Number.isFinite(entry.confidence) || entry.confidence <= 0) {
			return false;
		}
		seen.add(entry.pillarId);
		return true;
	});
	if (usable.length === 0) {
		return [];
	}
	const total = usable.reduce((sum, entry) => sum + entry.confidence, 0);
	const raw = usable.map((entry) => ({
		pillarId: entry.pillarId,
		confidence: entry.confidence,
		share: (entry.confidence / total) * 100,
	}));
	// Rundungsrest auf den letzten Beitrag legen, damit die Summe exakt 100 bleibt.
	const drift = 100 - raw.reduce((sum, entry) => sum + entry.share, 0);
	raw[raw.length - 1].share += drift;
	return raw;
};

/** Ergebnis eines Batch-Laufs. */
export interface ReassignPillarsResult {
	/** Anzahl der Aufgaben mit erfolgreich ersetzter Verteilung. */
	updated: number;
	/** Anzahl der Aufgaben, deren Klassifikation oder Speichern fehlschlug. */
	failed: number;
	/** Anzahl der übersprungenen Aufgaben (keine gültigen Vorschläge, Kontext unverändert). */
	skipped: number;
}

/**
 * Berechnet die Säulen-Verteilung aller Aufgaben eines Nutzers neu — einschließlich der
 * erledigten. `userId === undefined` (Pass-Through-Modus, lokale Entwicklung ohne Login)
 * verarbeitet die NULL-owned Bestandsaufgaben mit den NULL-owned Stammsäulen.
 *
 * Läuft synchron über die Aufgaben (Sequenz statt Parallelität): Der Klassifikator
 * schlägt gegen einen bezahlten LLM-Upstream, parallele Aufrufe würden Lastspitzen
 * und Rate-Limit-Fehler häufen.
 */
export const reassignTaskPillarsForUser = async (
	userId: number | undefined,
	classifier: PillarClassifier,
	provider?: Parameters<PillarClassifier>[1],
): Promise<ReassignPillarsResult> => {
	const pillars = await Pillar.findAll({
		where: userId !== undefined ? { userId } : { userId: null },
		order: [['id', 'ASC']],
	});
	if (pillars.length === 0) {
		return { updated: 0, failed: 0, skipped: 0 };
	}
	const validIds = new Set(pillars.map((pillar) => pillar.id));

	const tasks = await Task.findAll({
		where: userId !== undefined ? { userId } : { userId: null },
		attributes: ['id', 'title', 'description'],
	});
	if (tasks.length === 0) {
		return { updated: 0, failed: 0, skipped: 0 };
	}

	let examples: FeedbackExample[] = [];
	if (userId !== undefined) {
		try {
			examples = await loadFeedbackExamples(userId);
		} catch {
			examples = [];
		}
	}

	const pillarDtos = pillars.map((pillar) => ({
		id: pillar.id,
		name: pillar.name,
		description: pillar.description ?? undefined,
	}));

	const result: ReassignPillarsResult = { updated: 0, failed: 0, skipped: 0 };
	for (const task of tasks) {
		try {
			const suggestions = await classifier(
				{ title: task.title, description: task.description ?? undefined, pillars: pillarDtos, examples },
				provider,
				userId,
			);
			const contributions = toContributions(suggestions ?? [], validIds);
			if (contributions.length === 0) {
				result.skipped++;
				continue;
			}
			await sequelize.transaction(async (transaction) => {
				await TaskPillar.destroy({ where: { taskId: task.id }, transaction });
				await TaskPillar.bulkCreate(
					contributions.map((entry) => ({
						taskId: task.id,
						pillarId: entry.pillarId,
						share: entry.share,
						confidence: entry.confidence,
					})),
					{ transaction, validate: true },
				);
			});
			result.updated++;
		} catch (error) {
			console.warn(`Säulen-Neuzuordnung für Aufgabe ${task.id} fehlgeschlagen — setze den Batch fort.`, error);
			result.failed++;
		}
	}
	return result;
};

/**
 * App-weiter Backfill: berechnet die Säulen-Verteilung ALLER Aufgaben (aller Konten,
 * inklusive erledigter) neu. Admin-Trigger („Änderung des Systems" — z. B. nach Umbenennung
 * oder Neu-Anlage von Säulen), siehe routes/admin.ts.
 */
export const reassignTaskPillarsForAllUsers = async (
	classifier: PillarClassifier,
	provider?: Parameters<PillarClassifier>[1],
): Promise<ReassignPillarsResult & { users: number }> => {
	const users = await User.findAll({ attributes: ['id'] });
	let aggregated: ReassignPillarsResult = { updated: 0, failed: 0, skipped: 0 };
	let processed = 0;
	for (const user of users) {
		const result = await reassignTaskPillarsForUser(user.id, classifier, provider);
		if (result.updated + result.failed + result.skipped > 0) {
			processed++;
		}
		aggregated = {
			updated: aggregated.updated + result.updated,
			failed: aggregated.failed + result.failed,
			skipped: aggregated.skipped + result.skipped,
		};
	}
	// Pass-Through-Bestand (Aufgaben ohne Eigentümerkonto) — NULL-owned Stammsäulen.
	const legacy = await reassignTaskPillarsForUser(undefined, classifier, provider);
	aggregated = {
		updated: aggregated.updated + legacy.updated,
		failed: aggregated.failed + legacy.failed,
		skipped: aggregated.skipped + legacy.skipped,
	};
	if (legacy.updated + legacy.failed + legacy.skipped > 0) {
		processed++;
	}
	return { ...aggregated, users: processed };
};

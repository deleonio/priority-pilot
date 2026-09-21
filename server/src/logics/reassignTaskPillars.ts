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
 *
 * `budget`, sofern gesetzt, begrenzt die Zahl der in diesem Aufruf verarbeiteten
 * Aufgaben (Portionierung eines großen Batch-Laufs, siehe `reassignTaskPillarsForAllUsers`).
 * `offset` überspringt die ersten `offset` Aufgaben des Kontos (feste Reihenfolge nach `id`) —
 * damit ein Folgeaufruf mit demselben `offset + <in diesem Lauf verbrauchte Aufgaben>` bei den
 * noch unbearbeiteten Aufgaben fortsetzt, statt immer wieder dieselbe erste Portion zu treffen
 * (Finding #5). `total` im Ergebnis ist die Gesamtzahl der Aufgaben des Kontos VOR Offset/Budget
 * — der Aufrufer braucht sie, um den Offset für das nächste Konto zu verrechnen.
 */
const reassignTaskPillarsForUser = async (
	userId: number | undefined,
	classifier: PillarClassifier,
	provider?: Parameters<PillarClassifier>[1],
	budget?: number,
	offset = 0,
): Promise<ReassignPillarsResult & { total: number }> => {
	if (budget !== undefined && budget <= 0) {
		return { updated: 0, failed: 0, skipped: 0, total: 0 };
	}
	const pillars = await Pillar.findAll({
		where: userId !== undefined ? { userId } : { userId: null },
		order: [['id', 'ASC']],
	});
	if (pillars.length === 0) {
		return { updated: 0, failed: 0, skipped: 0, total: 0 };
	}
	const validIds = new Set(pillars.map((pillar) => pillar.id));

	const allTasks = await Task.findAll({
		where: userId !== undefined ? { userId } : { userId: null },
		attributes: ['id', 'title', 'description'],
		order: [['id', 'ASC']],
	});
	const total = allTasks.length;
	let tasks = offset > 0 ? allTasks.slice(offset) : allTasks;
	if (tasks.length === 0) {
		return { updated: 0, failed: 0, skipped: 0, total };
	}
	if (budget !== undefined) {
		tasks = tasks.slice(0, budget);
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
	return { ...result, total };
};

/** Fällt auf 200 Aufgaben je Lauf zurück, wenn kein `limit` übergeben wird (Finding #4). */
export const DEFAULT_REASSIGN_LIMIT = 200;

/**
 * App-weiter Backfill: berechnet die Säulen-Verteilung ALLER Aufgaben (aller Konten,
 * inklusive erledigter) neu. Admin-Trigger („Änderung des Systems" — z. B. nach Umbenennung
 * oder Neu-Anlage von Säulen), siehe routes/admin.ts.
 *
 * `limit` begrenzt die Gesamtzahl der in diesem Aufruf verarbeiteten Aufgaben (Default
 * `DEFAULT_REASSIGN_LIMIT`) — ein großer Bestand läuft sonst unbeschränkt im offenen
 * HTTP-Request und übersteht keinen Proxy-Timeout. `remaining` im Ergebnis zeigt, wie viele
 * Aufgaben noch offen sind.
 *
 * `offset` (Finding #5): ohne ihn würde jeder Folgeaufruf wieder bei Konto 1/Aufgabe 1 anfangen
 * und dieselbe erste Portion neu (und nur die) verarbeiten — `remaining` bliebe über beliebig
 * viele Läufe konstant. Konten werden nach `id` sortiert durchlaufen (feste Reihenfolge), der
 * Aufrufer reicht als `offset` die Summe aus `attempted` aller vorherigen Läufe derselben Serie
 * ein; der Batch überspringt dann genau so viele Aufgaben, bevor er wieder `limit` verarbeitet.
 */
export const reassignTaskPillarsForAllUsers = async (
	classifier: PillarClassifier,
	provider?: Parameters<PillarClassifier>[1],
	limit: number = DEFAULT_REASSIGN_LIMIT,
	offset = 0,
): Promise<ReassignPillarsResult & { users: number; remaining: number }> => {
	const totalTasks = await Task.count();
	const users = await User.findAll({ attributes: ['id'], order: [['id', 'ASC']] });
	let aggregated: ReassignPillarsResult = { updated: 0, failed: 0, skipped: 0 };
	let processed = 0;
	let attempted = 0;
	let budget = limit;
	let skip = offset;
	for (const user of users) {
		if (budget <= 0) break;
		const result = await reassignTaskPillarsForUser(user.id, classifier, provider, budget, skip);
		skip = Math.max(0, skip - result.total);
		const consumed = result.updated + result.failed + result.skipped;
		if (consumed > 0) {
			processed++;
		}
		attempted += consumed;
		budget -= consumed;
		aggregated = {
			updated: aggregated.updated + result.updated,
			failed: aggregated.failed + result.failed,
			skipped: aggregated.skipped + result.skipped,
		};
	}
	// Pass-Through-Bestand (Aufgaben ohne Eigentümerkonto) — NULL-owned Stammsäulen.
	if (budget > 0) {
		const legacy = await reassignTaskPillarsForUser(undefined, classifier, provider, budget, skip);
		const consumed = legacy.updated + legacy.failed + legacy.skipped;
		attempted += consumed;
		aggregated = {
			updated: aggregated.updated + legacy.updated,
			failed: aggregated.failed + legacy.failed,
			skipped: aggregated.skipped + legacy.skipped,
		};
		if (consumed > 0) {
			processed++;
		}
	}
	return { ...aggregated, users: processed, remaining: Math.max(0, totalTasks - offset - attempted) };
};

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

/**
 * Statusauswahl eines Laufs (#1614). „offen" schließt Aufgaben in Bearbeitung ein — dieselbe
 * Abgrenzung wie im Frontend (`lib/dayDone.ts`), sonst fielen laufende Aufgaben stillschweigend
 * aus der Auswahl.
 */
export type ReassignStatusFilter = 'all' | 'open' | 'done';

/** Prüft den `status`-Query-Parameter. Fehlt er, gilt `'all'`; `null` heißt „ungültiger Wert". */
export const parseStatusFilter = (raw: unknown): ReassignStatusFilter | null => {
	if (raw === undefined) {
		return 'all';
	}
	return raw === 'all' || raw === 'open' || raw === 'done' ? raw : null;
};

const statusWhere = (status: ReassignStatusFilter): { status?: string[] } => {
	if (status === 'open') {
		return { status: ['Open', 'In process'] };
	}
	if (status === 'done') {
		return { status: ['Done'] };
	}
	return {};
};

/**
 * Versuche je Aufgabe, bevor ihre Klassifikation als fehlgeschlagen gilt (#1614). Der Batch
 * schlägt gegen einen bezahlten LLM-Upstream; dessen Rate-Limits und kurze Ausfälle waren der
 * Grund, warum ein Lauf regelmäßig einen Teil der Aufgaben als `failed` zurückmeldete. Nur der
 * Klassifikator-Aufruf wird wiederholt — ein Fehler beim Speichern ist keine Wackelkontakt-Sache
 * und soll unverändert sofort als Fehler zählen.
 */
const CLASSIFY_ATTEMPTS = 3;
const RETRY_BASE_MS = 250;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

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
export interface ReassignRunOptions {
	classifier: PillarClassifier;
	provider?: Parameters<PillarClassifier>[1];
	/** Obergrenze der in diesem Aufruf verarbeiteten Aufgaben. */
	budget?: number;
	/** Bereits verarbeitete Aufgaben vorheriger Läufe derselben Serie. */
	offset?: number;
	/** Statusauswahl; `'all'` verarbeitet auch erledigte Aufgaben. */
	status?: ReassignStatusFilter;
	/**
	 * Kontingent-Buchung je Aufgabe (#1614). Der Lauf löst pro Aufgabe einen Provider-Aufruf aus;
	 * ohne Buchung an dieser Stelle zählte ein ganzer Batch als eine einzige Anfrage. Fehlt der
	 * Haken, wird nicht gezählt (Admin-Batch, Pass-Through-Modus, eigener Provider des Nutzers).
	 */
	quota?: { book: () => Promise<boolean>; refund: () => Promise<void> };
}

export const reassignTaskPillarsForUser = async (
	userId: number | undefined,
	{ classifier, provider, budget, offset = 0, status = 'all', quota }: ReassignRunOptions,
): Promise<ReassignPillarsResult & { total: number; quotaExhausted: boolean }> => {
	if (budget !== undefined && budget <= 0) {
		return { updated: 0, failed: 0, skipped: 0, total: 0, quotaExhausted: false };
	}
	const pillars = await Pillar.findAll({
		where: userId !== undefined ? { userId } : { userId: null },
		order: [['id', 'ASC']],
	});
	if (pillars.length === 0) {
		return { updated: 0, failed: 0, skipped: 0, total: 0, quotaExhausted: false };
	}
	const validIds = new Set(pillars.map((pillar) => pillar.id));

	const allTasks = await Task.findAll({
		where: { ...(userId !== undefined ? { userId } : { userId: null }), ...statusWhere(status) },
		attributes: ['id', 'title', 'description'],
		order: [['id', 'ASC']],
	});
	const total = allTasks.length;
	let tasks = offset > 0 ? allTasks.slice(offset) : allTasks;
	if (tasks.length === 0) {
		return { updated: 0, failed: 0, skipped: 0, total, quotaExhausted: false };
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
	let quotaExhausted = false;
	for (const task of tasks) {
		// Buchung VOR dem Provider-Aufruf, wie in der Middleware — sonst käme ein paralleler
		// Schwung Läufe am Deckel vorbei. Ist das Kontingent alle, endet der Lauf hier; die
		// restlichen Aufgaben bleiben unangetastet und zählen weder als `failed` noch `skipped`.
		if (quota !== undefined && !(await quota.book())) {
			quotaExhausted = true;
			break;
		}
		let classified = false;
		try {
			let suggestions: Awaited<ReturnType<PillarClassifier>> | undefined;
			for (let attempt = 1; ; attempt++) {
				try {
					suggestions = await classifier(
						{ title: task.title, description: task.description ?? undefined, pillars: pillarDtos, examples },
						provider,
						userId,
					);
					break;
				} catch (error) {
					if (attempt >= CLASSIFY_ATTEMPTS) {
						throw error;
					}
					await sleep(RETRY_BASE_MS * 2 ** (attempt - 1));
				}
			}
			classified = true;
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
			// Nur ein gescheiterter Provider-Aufruf wird storniert — dieselbe Linie wie die
			// Middleware, die bei Status >= 400 zurückbucht. Kam die Klassifikation durch und erst
			// das Speichern scheiterte, ist der Aufruf beim Anbieter angefallen und bleibt gebucht.
			if (quota !== undefined && !classified) {
				await quota.refund().catch((reason: unknown) => {
					console.warn('KI-Kontingent-Rückbuchung fehlgeschlagen', reason);
				});
			}
		}
	}
	return { ...result, total, quotaExhausted };
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
export const reassignTaskPillarsForAllUsers = async ({
	classifier,
	provider,
	limit = DEFAULT_REASSIGN_LIMIT,
	offset = 0,
	status = 'all',
}: Omit<ReassignRunOptions, 'budget'> & { limit?: number }): Promise<
	ReassignPillarsResult & { users: number; remaining: number }
> => {
	// Muss dieselbe Statusauswahl zählen wie der Lauf selbst — sonst meldete `remaining` bei
	// gefilterten Läufen die Aufgaben mit, die der Filter gerade ausschließt.
	const totalTasks = await Task.count({ where: statusWhere(status) });
	const users = await User.findAll({ attributes: ['id'], order: [['id', 'ASC']] });
	let aggregated: ReassignPillarsResult = { updated: 0, failed: 0, skipped: 0 };
	let processed = 0;
	let attempted = 0;
	let budget = limit;
	let skip = offset;
	for (const user of users) {
		if (budget <= 0) break;
		const result = await reassignTaskPillarsForUser(user.id, { classifier, provider, budget, offset: skip, status });
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
		const legacy = await reassignTaskPillarsForUser(undefined, { classifier, provider, budget, offset: skip, status });
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

import { Op, type WhereOptions } from 'sequelize';
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
 * Auswahl der Aufgaben eines Kontos. Mit `since` nur die noch offenen eines Laufs: Verteilung nie
 * oder vor dem Laufstart neu bestimmt. Fehlgeschlagene Aufgaben bekommen keinen Zeitstempel und
 * bleiben damit in dieser Auswahl — genau sie nimmt ein fortgesetzter Lauf wieder auf.
 */
const taskWhere = (
	userId: number | undefined,
	status: ReassignStatusFilter,
	since: Date | undefined,
): WhereOptions => ({
	...(userId !== undefined ? { userId } : { userId: null }),
	...statusWhere(status),
	...(since === undefined
		? {}
		: { [Op.or]: [{ pillarsRecalculatedAt: null }, { pillarsRecalculatedAt: { [Op.lt]: since } }] }),
});

/** Zahl der Aufgaben, die ein Lauf mit Start `since` noch nicht erfolgreich verarbeitet hat. */
export const countPendingTasks = (
	userId: number | undefined,
	status: ReassignStatusFilter,
	since: Date | undefined,
): Promise<number> => Task.count({ where: taskWhere(userId, status, since) });

/**
 * Versuche je Aufgabe, bevor ihre Klassifikation als fehlgeschlagen gilt (#1614). Der Batch
 * schlägt gegen einen bezahlten LLM-Upstream; dessen Rate-Limits und kurze Ausfälle waren der
 * Grund, warum ein Lauf regelmäßig einen Teil der Aufgaben als `failed` zurückmeldete. Nur der
 * Klassifikator-Aufruf wird wiederholt — ein Fehler beim Speichern ist keine Wackelkontakt-Sache
 * und soll unverändert sofort als Fehler zählen.
 */
const CLASSIFY_ATTEMPTS = 3;
const RETRY_BASE_MS = 250;

/**
 * Rate-Limit (429) und Upstream-Überlastung (5xx) brauchen mehr Geduld als ein Wackelkontakt: Ein
 * Rate-Limit-Fenster dauert Sekunden, nicht 250 ms. Mit den kurzen Retries oben schlug in Produktion
 * gut ein Drittel eines 145-Aufgaben-Laufs fehl. Wartezeit: `Retry-After` des Providers, sonst
 * exponentiell ab `TRANSIENT_RETRY_BASE_MS`, gedeckelt auf `TRANSIENT_RETRY_MAX_MS`.
 */
const TRANSIENT_ATTEMPTS = 5;
const TRANSIENT_RETRY_BASE_MS = 1000;
const TRANSIENT_RETRY_MAX_MS = 20_000;

/** Pause zwischen zwei Aufgaben — der Lauf soll den Provider nicht im Burst treffen. */
const TASK_PAUSE_MS = 200;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** HTTP-Status eines Provider-Fehlers (`MistralRequestError.status`), sofern vorhanden. */
const statusOf = (error: unknown): number | undefined => {
	const status = (error as { status?: unknown } | null)?.status;
	return typeof status === 'number' ? status : undefined;
};

const isTransient = (error: unknown): boolean => {
	const status = statusOf(error);
	return status !== undefined && (status === 429 || status >= 500);
};

/** Wartezeit vor dem nächsten Versuch nach `attempt` Fehlversuchen. */
const retryDelay = (error: unknown, attempt: number): number => {
	if (!isTransient(error)) {
		return RETRY_BASE_MS * 2 ** (attempt - 1);
	}
	const retryAfter = (error as { retryAfterMs?: unknown }).retryAfterMs;
	const delay = typeof retryAfter === 'number' ? retryAfter : TRANSIENT_RETRY_BASE_MS * 2 ** (attempt - 1);
	return Math.min(delay, TRANSIENT_RETRY_MAX_MS);
};

/**
 * Kurzform des Fehlergrunds für die Rückmeldung an den Nutzer: `HTTP <status>` bei Provider-Fehlern,
 * sonst eine feste Kategorie — keine rohen Fehlermeldungen (die können SQL oder Upstream-Bodies
 * enthalten) und keine unbegrenzte Zahl verschiedener Schlüssel.
 */
const failureReasonOf = (error: unknown, classified: boolean): string => {
	if (classified) {
		return 'Speichern fehlgeschlagen';
	}
	const status = statusOf(error);
	if (status !== undefined) {
		return `HTTP ${status}`;
	}
	return error instanceof Error && error.name === 'MissingApiKeyError'
		? 'Kein KI-Provider konfiguriert'
		: 'KI-Anfrage fehlgeschlagen';
};

/** Ergebnis eines Batch-Laufs. */
export interface ReassignPillarsResult {
	/** Anzahl der Aufgaben mit erfolgreich ersetzter Verteilung. */
	updated: number;
	/** Anzahl der Aufgaben, deren Klassifikation oder Speichern fehlschlug. */
	failed: number;
	/** Anzahl der übersprungenen Aufgaben (keine gültigen Vorschläge, Kontext unverändert). */
	skipped: number;
	/** Fehlergründe der fehlgeschlagenen Aufgaben, Grund → Anzahl (nur gesetzt, wenn `failed > 0`). */
	failureReasons?: Record<string, number>;
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
	 * Laufstart eines fortsetzbaren Laufs (#1614): nur Aufgaben, die seitdem nicht erfolgreich
	 * verarbeitet wurden. Verarbeitete fallen damit aus der Auswahl — `offset` zählt dann nur noch die
	 * in dieser Serie fehlgeschlagenen, die vorn in der Auswahl stehen bleiben.
	 */
	since?: Date;
	/**
	 * Kontingent-Buchung je Aufgabe (#1614). Der Lauf löst pro Aufgabe einen Provider-Aufruf aus;
	 * ohne Buchung an dieser Stelle zählte ein ganzer Batch als eine einzige Anfrage. Fehlt der
	 * Haken, wird nicht gezählt (Admin-Batch, Pass-Through-Modus, eigener Provider des Nutzers).
	 */
	quota?: { book: () => Promise<boolean>; refund: () => Promise<void> };
}

export const reassignTaskPillarsForUser = async (
	userId: number | undefined,
	{ classifier, provider, budget, offset = 0, status = 'all', since, quota }: ReassignRunOptions,
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
		where: taskWhere(userId, status, since),
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
	const failureReasons: Record<string, number> = {};
	let quotaExhausted = false;
	for (const [index, task] of tasks.entries()) {
		if (index > 0) {
			await sleep(TASK_PAUSE_MS);
		}
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
					if (attempt >= (isTransient(error) ? TRANSIENT_ATTEMPTS : CLASSIFY_ATTEMPTS)) {
						throw error;
					}
					await sleep(retryDelay(error, attempt));
				}
			}
			classified = true;
			const contributions = toContributions(suggestions ?? [], validIds);
			if (contributions.length === 0) {
				// Bewusst belassen zählt als verarbeitet — ein fortgesetzter Lauf fragt nicht erneut.
				// `silent`: die Neuberechnung ist keine inhaltliche Änderung, `updatedAt` bleibt.
				await Task.update({ pillarsRecalculatedAt: new Date() }, { where: { id: task.id }, silent: true });
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
				await Task.update({ pillarsRecalculatedAt: new Date() }, { where: { id: task.id }, transaction, silent: true });
			});
			result.updated++;
		} catch (error) {
			console.warn(`Säulen-Neuzuordnung für Aufgabe ${task.id} fehlgeschlagen — setze den Batch fort.`, error);
			result.failed++;
			const reason = failureReasonOf(error, classified);
			failureReasons[reason] = (failureReasons[reason] ?? 0) + 1;
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
	return { ...result, ...(result.failed > 0 ? { failureReasons } : {}), total, quotaExhausted };
};

/** Fällt auf 200 Aufgaben je Lauf zurück, wenn kein `limit` übergeben wird (Finding #4). */
export const DEFAULT_REASSIGN_LIMIT = 200;

/**
 * Laufstart je Konto (#1614) — Bezugspunkt für „Fortsetzen": offen sind die Aufgaben, deren
 * `pillarsRecalculatedAt` fehlt oder älter ist. Der Pass-Through-Bestand (Aufgaben ohne Konto) hat
 * keine `users`-Zeile; sein Start lebt nur im Prozess und geht bei einem Neustart verloren.
 */
let passthroughRunStartedAt: Date | null = null;

export const readRunStart = async (userId: number | undefined): Promise<Date | null> => {
	if (userId === undefined) {
		return passthroughRunStartedAt;
	}
	const user = await User.findByPk(userId, { attributes: ['id', 'pillarRecalcStartedAt'] });
	return user?.pillarRecalcStartedAt ?? null;
};

const writeRunStart = async (userId: number | undefined, startedAt: Date): Promise<void> => {
	if (userId === undefined) {
		passthroughRunStartedAt = startedAt;
		return;
	}
	await User.update({ pillarRecalcStartedAt: startedAt }, { where: { id: userId } });
};

/** Laufstart lesen und, falls noch keiner existiert (oder `restart`), jetzt setzen. */
export const ensureRunStart = async (userId: number | undefined, restart: boolean): Promise<Date> => {
	const existing = restart ? null : await readRunStart(userId);
	if (existing !== null) {
		return existing;
	}
	const now = new Date();
	await writeRunStart(userId, now);
	return now;
};

/** Neustart für ALLE Konten (Admin-Batch): ab jetzt gilt jede Aufgabe wieder als offen. */
const restartAllRuns = async (startedAt: Date): Promise<void> => {
	await User.update({ pillarRecalcStartedAt: startedAt }, { where: {} });
	passthroughRunStartedAt = startedAt;
};

const mergeFailureReasons = (
	into: Record<string, number>,
	from: Record<string, number> | undefined,
): Record<string, number> => {
	for (const [reason, count] of Object.entries(from ?? {})) {
		into[reason] = (into[reason] ?? 0) + count;
	}
	return into;
};

/** Stand des Admin-Batches: Aufgaben insgesamt und seit dem jeweiligen Kontostart noch offen. */
export const reassignStatusForAllUsers = async (
	status: ReassignStatusFilter,
): Promise<{ startedAt: Date | null; total: number; pending: number }> => {
	const users = await User.findAll({ attributes: ['id', 'pillarRecalcStartedAt'], order: [['id', 'ASC']] });
	let pending = 0;
	let startedAt: Date | null = null;
	for (const user of users) {
		const since = user.pillarRecalcStartedAt ?? undefined;
		pending += await countPendingTasks(user.id, status, since);
		if (since !== undefined && (startedAt === null || since > startedAt)) {
			startedAt = since;
		}
	}
	pending += await countPendingTasks(undefined, status, passthroughRunStartedAt ?? undefined);
	const total = await Task.count({ where: statusWhere(status) });
	return { startedAt, total, pending };
};

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
 * Fortsetzbar wie der Nutzer-Lauf (#1614): Jedes Konto verarbeitet nur Aufgaben, die seit seinem
 * Laufstart nicht erfolgreich neu berechnet wurden. `restart` setzt diesen Start für ALLE Konten
 * neu. Erfolgreich verarbeitete fallen damit aus der Auswahl, die fehlgeschlagenen bleiben vorn in
 * der Auswahl ihres Kontos stehen — `offset` zählt deshalb nur die Fehlschläge der laufenden Serie.
 */
export const reassignTaskPillarsForAllUsers = async ({
	classifier,
	provider,
	limit = DEFAULT_REASSIGN_LIMIT,
	offset = 0,
	status = 'all',
	restart = false,
}: Omit<ReassignRunOptions, 'budget' | 'since'> & { limit?: number; restart?: boolean }): Promise<
	ReassignPillarsResult & { users: number; remaining: number }
> => {
	if (restart) {
		await restartAllRuns(new Date());
	}
	const users = await User.findAll({ attributes: ['id', 'pillarRecalcStartedAt'], order: [['id', 'ASC']] });
	// Konten ohne Laufstart bekommen jetzt einen — ohne ihn fielen verarbeitete Aufgaben nicht aus
	// der Auswahl, und der offset (nur Fehlschläge) stimmte nicht mehr.
	const accounts: { userId: number | undefined; since: Date }[] = [];
	for (const user of users) {
		accounts.push({ userId: user.id, since: user.pillarRecalcStartedAt ?? (await ensureRunStart(user.id, false)) });
	}
	accounts.push({ userId: undefined, since: await ensureRunStart(undefined, false) });

	// Muss dieselbe Auswahl zählen wie der Lauf selbst — sonst stimmte `remaining` nicht.
	let totalPending = 0;
	for (const account of accounts) {
		totalPending += await countPendingTasks(account.userId, status, account.since);
	}

	const aggregated: ReassignPillarsResult = { updated: 0, failed: 0, skipped: 0 };
	const failureReasons: Record<string, number> = {};
	let processed = 0;
	let attempted = 0;
	let budget = limit;
	let skip = offset;
	for (const account of accounts) {
		if (budget <= 0) break;
		const result = await reassignTaskPillarsForUser(account.userId, {
			classifier,
			provider,
			budget,
			offset: skip,
			status,
			since: account.since,
		});
		skip = Math.max(0, skip - result.total);
		const consumed = result.updated + result.failed + result.skipped;
		if (consumed > 0) {
			processed++;
		}
		attempted += consumed;
		budget -= consumed;
		aggregated.updated += result.updated;
		aggregated.failed += result.failed;
		aggregated.skipped += result.skipped;
		mergeFailureReasons(failureReasons, result.failureReasons);
	}
	return {
		...aggregated,
		...(aggregated.failed > 0 ? { failureReasons } : {}),
		users: processed,
		remaining: Math.max(0, totalPending - offset - attempted),
	};
};

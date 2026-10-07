import { ResponseError } from 'client';
import type {
	ActivityAdvisorInput,
	ActivityAdvisorResult,
	AdminUser,
	AllowedEmail,
	ApiToken,
	BalanceHistoryEntry,
	BalanceStatus,
	CalendarEvent,
	CalendarSource,
	CalendarSourceInput,
	Category,
	CategoryCreate,
	CategoryUpdate,
	CreatedApiToken,
	components,
	DependencyInput,
	Group,
	GroupInput,
	GroupInvitation,
	GroupMember,
	GroupTask,
	Duo,
	GroupSeries,
	GroupChallenge,
	GroupUpdate,
	GroupInviteLink,
	Milestone,
	MissedTasksSummary,
	MonthlyRecap,
	PlaceFavorite,
	PlaceFavoriteInput,
	JournalEntry,
	JournalEntryInput,
	JournalEntryUpdate,
	JournalStats,
	InviteLinkPreview,
	InviteLinkRedeemResult,
	ReceivedInvitation,
	UserSearchHit,
	LlmModels,
	LlmProvider,
	LlmProviderTestResult,
	LlmProviderTestDraft,
	LlmProviderInput,
	LlmProviderUpdate,
	NearbyTask,
	GeoConfig,
	McpInstructions,
	FreeSlot,
	FreeSlotConfig,
	CareConfig,
	SplitHintConfig,
	CareVorschlag,
	Profile,
	ParsedSearch,
	ParsedTask,
	ReassignRunStarted,
	OwnReassignPillarsStatus,
	ReassignStatusFilter,
	paths,
	Pillar,
	PillarFeedbackInput,
	PushSubscriptionInput,
	PillarSuggestion,
	PillarWeightsInput,
	Series,
	SeriesCreate,
	SeriesGenerateInput,
	SeriesUpdate,
	Streak,
	SuggestInitialTaskSuggestion,
	SuggestPillarsInput,
	Task,
	TaskCreate,
	TaskImportMapping,
	TaskImportPreview,
	TaskImportResult,
	TaskImportAnalysis,
	TaskImportMergeResult,
	TaskTreeNode,
	TaskGraph,
	TaskUpdate,
	YearlyRecap,
} from 'client';
import createClient from 'openapi-fetch';
import { planRequiredDetail } from './lib/apiError';
import { appTokenHeaders, clearAppToken, getAppToken, setAppToken } from './lib/appToken';
import { sortCategoriesByName } from './lib/categories';
import { getChannel } from './lib/platform';
import { getApiBase } from './lib/siteOrigin';

// Im Dev-Betrieb leitet der Vite-Proxy (siehe vite.config.ts) /api/v1/*-Anfragen an
// http://localhost:3000 weiter und streift das Präfix ab. In Prod übernimmt Caddy denselben
// Rewrite. Über VITE_API_BASE_URL lässt sich die Basis-URL bei Bedarf überschreiben.
const baseUrl = import.meta.env.VITE_API_BASE_URL ?? getApiBase();
const client = createClient<paths>({ baseUrl });

// CSRF-Schutz (Server: server/src/express/csrf.ts): Vor dem ersten schreibenden Aufruf holt der
// Client einen Token von GET /auth/csrf und sendet ihn als `x-csrf-token`-Header mit. Bei 403
// wird der Cache verworfen, damit der nächste Aufruf einen frischen Token holt.
let csrfToken: string | null = null;

const ensureCsrfToken = async (): Promise<string> => {
	if (csrfToken === null) {
		const response = await fetch(`${baseUrl}/auth/csrf`);
		if (!response.ok) {
			throw new Error(`CSRF-Token konnte nicht geladen werden (${response.status})`);
		}
		csrfToken = ((await response.json()) as { csrfToken: string }).csrfToken;
	}
	return csrfToken;
};

client.use({
	onRequest: async ({ request }) => {
		// Kanal für die serverseitige Kanal-Regel (ADR 0016), z. B. keine PayPal-Kasse in der Android-App.
		request.headers.set('X-Client-Channel', getChannel());
		// App-Token der Android-App (#2379); ohne Token bleibt die Website bei der Cookie-Session.
		const appToken = getAppToken();
		if (appToken !== null) {
			request.headers.set('Authorization', `Bearer ${appToken}`);
		}
		if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
			request.headers.set('x-csrf-token', await ensureCsrfToken());
		}
	},
	onResponse: async ({ response }) => {
		if (response.status !== 403) {
			return;
		}
		// Paket-Ablehnung (#1458 AK8): Ein 403 mit `code: plan_required` ist KEIN CSRF-Problem — der
		// Token bleibt gültig, sonst holt jede gesperrte Aktion unnötig einen neuen. Entscheidend ist
		// der Body, nicht der Status: der echte CSRF-403 (server/src/express/csrf.ts) trägt den Code
		// nicht und verwirft den Token weiterhin. Der `clone()` lässt den Original-Body unberührt,
		// den openapi-fetch danach selbst liest.
		let body: unknown;
		try {
			body = await response.clone().json();
		} catch {
			body = undefined;
		}
		if (planRequiredDetail(body, 'plan_required') !== null) {
			return;
		}
		csrfToken = null;
	},
});

type RawTask = components['schemas']['Task'];
type RawSeries = components['schemas']['Series'];
type SeriesInstanceInput = components['schemas']['SeriesInstanceInput'];
type GeocodeSearchResultDto = components['schemas']['GeocodeSearchResult'];

// Serien-`startDate` (im Vertrag ISO-String) zu einem echten `Date` revivieren — analog zu `reviveTask`.
const reviveSeries = (raw: RawSeries): Series => {
	const { startDate, ...rest } = raw;
	return { ...rest, startDate: new Date(startDate) };
};

// openapi-fetch liefert rohes JSON; Datumsfelder kommen als ISO-String. Der frühere generierte
// Client lieferte echte `Date`-Objekte — diese Funktion stellt dasselbe Verhalten wieder her.
const reviveTask = (raw: RawTask): Task => {
	const { deadline, ...rest } = raw;
	return { ...rest, deadline: deadline == null ? null : new Date(deadline) };
};

// `Date` -> ISO-String für ausgehende Bodies, damit der Body exakt dem Vertragstyp entspricht.
const toRawDeadline = (deadline: Date | null | undefined): string | null =>
	deadline == null ? null : deadline.toISOString();

interface Init {
	signal?: AbortSignal;
}

/**
 * Wiederholt einen API-Aufruf bei transienten 5xx-Fehlern (502, 503, 504).
 * Maximale Anzahl von Versuchen: 3 (initialer Versuch + 2 Retries).
 *
 * **Nur für LLM-Endpoints (#620):** Bei Ausfall/Timeout des Mistral-Dienstes wird ein
 * limitierter Retry versucht, bevor der Fehler an die UI durchgereicht wird.
 */
async function withRetry<T>(
	fetch: () => Promise<{ data?: T; error?: { message: string }; response: Response }>,
	isTransientError: (status: number) => boolean = (status) => status === 502 || status === 503 || status === 504,
	maxAttempts = 3,
): Promise<{ data: T; response: Response }> {
	let lastError: Error | undefined;
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			const result = await fetch();
			if (result.response.ok && result.data !== undefined) {
				return { data: result.data, response: result.response };
			}
			if (!isTransientError(result.response.status)) {
				throw new ResponseError(result.response, result.error);
			}
			// Transienter Fehler → bei weiteren Attempts wiederholen
			lastError = new ResponseError(result.response, result.error);
		} catch (error) {
			if (error instanceof ResponseError) {
				lastError = error;
				if (!isTransientError(error.response.status)) {
					throw error;
				}
				// Transienter Fehler → bei weiteren Attempts wiederholen
			} else {
				throw error;
			}
		}
	}
	throw lastError || new Error('Alle Retry-Versuche fehlgeschlagen.');
}

/**
 * Typsichere API-Fassade über `openapi-fetch`. Bildet die früheren Methoden des generierten
 * Clients nach (gleiche Signaturen, wirft `ResponseError` bei nicht-erfolgreichen Antworten),
 * damit die UI-Komponenten unverändert bleiben.
 */
/**
 * Frontend-Sicht eines gespeicherten Orts (#1342): `lat`/`lon` statt `latitude`/`longitude` — so
 * heißen die Koordinaten überall im Adress-Frontend (`AddressSuggestion`), und ein Favorit lässt
 * sich dadurch ohne Umrechnung als Treffer übernehmen.
 */
export type PlaceFavoriteView = Omit<PlaceFavorite, 'latitude' | 'longitude'> & {
	lat: number | null;
	lon: number | null;
};

const toPlaceFavoriteView = ({ latitude, longitude, ...rest }: PlaceFavorite): PlaceFavoriteView => ({
	...rest,
	lat: latitude,
	lon: longitude,
});

export const api = {
	async listTasks(init: Init = {}): Promise<Task[]> {
		const { data, error, response } = await client.GET('/tasks', { signal: init.signal });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data.map(reviveTask);
	},

	// Verpasst-Auswahl (#1964): überfällige, nicht erledigte Aufgaben ohne Auto-Lösch-Häkchen und
	// ohne Archiv (`GET /tasks?missed=1`) — abgeleitete Ansicht, kein neuer Status.
	async listMissedTasks(init: Init = {}): Promise<Task[]> {
		const { data, error, response } = await client.GET('/tasks', {
			params: { query: { missed: '1' } },
			signal: init.signal,
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data.map(reviveTask);
	},

	// Archiv-Ansicht: nur archivierte Aufgaben (`GET /tasks?archived=1`).
	async listArchivedTasks(init: Init = {}): Promise<Task[]> {
		const { data, error, response } = await client.GET('/tasks', {
			params: { query: { archived: '1' } },
			signal: init.signal,
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data.map(reviveTask);
	},

	/**
	 * Paket-Katalog (`GET /plans`, #1456): Feature-Matrix und Preise. Einzige Preisquelle des
	 * Frontends — im Code stehen weder Preise noch Matrixzeilen (#1458 AK11).
	 */
	async getPlansCatalog(init: Init = {}): Promise<components['schemas']['PlansCatalog']> {
		const { data, error, response } = await client.GET('/plans', { signal: init.signal });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	// --- Buchungs-/Verwaltungsflow (#1496, T6c) — Backend bereits fertig (#1505/#1506) ---

	/** Welche Anmeldewege die Instanz anbietet (Google, Magic Link per E-Mail) — öffentlich. */
	async getAuthProviders(): Promise<components['schemas']['AuthProviders']> {
		const { data, error, response } = await client.GET('/auth/providers');
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	/** Fordert einen Anmeldelink per E-Mail an. Der Server antwortet bewusst immer gleich (202). */
	async requestMagicLink(email: string): Promise<void> {
		const { error, response } = await client.POST('/auth/magic-link', { body: { email } });
		if (!response.ok) {
			throw new ResponseError(response, error);
		}
	},

	/** Trägt eine Adresse auf die Warteliste ein (#1982, ADR 0019); idempotent, liefert Position und Empfehlungs-Code. */
	async addToWaitlist(email: string, ref?: string): Promise<components['schemas']['WaitlistJoined']> {
		const { data, error, response } = await client.POST('/auth/waitlist', { body: { email, ref } });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	/**
	 * Löst den Token aus dem Anmeldelink ein; `false` bei abgelaufenem oder benutztem Link. In der
	 * Android-App kommt statt des Cookies ein App-Token zurück (#2379), das gespeichert wird.
	 */
	async verifyMagicLink(token: string): Promise<boolean> {
		const { data, response } = await client.POST('/auth/magic-link/verify', { body: { token } });
		if (response.ok && data?.token) {
			setAppToken(data.token);
		}
		return response.ok;
	},

	/** Löst den Einmal-Code aus dem App-Login mit dem `state` der App ein (#1678) und speichert das App-Token (#2379). */
	async exchangeNativeLoginCode(code: string, state: string): Promise<boolean> {
		const { data, response } = await client.POST('/auth/native/exchange', { body: { code, state } });
		if (response.ok && data?.token) {
			setAppToken(data.token);
		}
		return response.ok;
	},

	/** Legt ein Abo an (AK1); die Antwort trägt die PayPal-Zustimmungs-URL zum Weiterleiten. */
	async createBillingSubscription(
		input: components['schemas']['BillingSubscriptionInput'],
	): Promise<components['schemas']['BillingApproval']> {
		const { data, error, response } = await client.POST('/billing/subscriptions', { body: input });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	/** Kündigt das laufende Abo (AK3) mit den Angaben des Bestätigungsschritts (#2308); ohne `input` verwirft sie nur einen offenen Checkout. Wirksam wird sie erst über das Webhook-Ereignis. */
	async cancelBillingSubscription(input?: components['schemas']['BillingCancelInput']): Promise<void> {
		const { error, response } = await client.POST('/billing/subscriptions/cancel', { body: input });
		if (!response.ok) {
			throw new ResponseError(response, error);
		}
	},

	/** Wechselt Paket/Zeitraum (AK3); `approvalUrl` fehlt, wenn PayPal keine erneute Zustimmung verlangt. */
	async changeBillingSubscription(
		input: components['schemas']['BillingSubscriptionInput'],
	): Promise<components['schemas']['BillingApproval']> {
		const { data, error, response } = await client.POST('/billing/subscriptions/change', { body: input });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	/** Vorschau des Paketwechsels (#1913): Guthaben und fälliger Betrag in Cent, ohne Nebenwirkung. */
	async previewBillingChange(
		input: components['schemas']['BillingSubscriptionInput'],
	): Promise<components['schemas']['BillingChangePreview']> {
		const { data, error, response } = await client.POST('/billing/subscriptions/change/preview', { body: input });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	/** Eigene Rechnungen, neueste zuerst (AK5). */
	async listBillingInvoices(init: Init = {}): Promise<components['schemas']['Invoice'][]> {
		const { data, error, response } = await client.GET('/billing/invoices', { signal: init.signal });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	/** Einzelne eigene Rechnung; fremde oder unbekannte Id liefert 404. */
	async getBillingInvoice({ id }: { id: number }): Promise<components['schemas']['Invoice']> {
		const { data, error, response } = await client.GET('/billing/invoices/{id}', { params: { path: { id } } });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	async getForest(init: Init = {}): Promise<TaskTreeNode[]> {
		const { data, error, response } = await client.GET('/forest', { signal: init.signal });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	/** Aufgabengraph (`GET /graph`): Knoten + gewichtete Kanten, jede Aufgabe genau einmal. */
	async getGraph(init: Init = {}): Promise<TaskGraph> {
		const { data, error, response } = await client.GET('/graph', { signal: init.signal });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	async getNextTask(init: Init = {}): Promise<Task | null> {
		const { data, error, response } = await client.GET('/next', { signal: init.signal });
		if (!response.ok) {
			throw new ResponseError(response, error);
		}
		return data == null ? null : reviveTask(data);
	},

	// „Was ist jetzt dran?"-Vorschlagsliste (`GET /suggestions`): nach Score sortiert, post-gefiltert.
	async getSuggestions(init: Init = {}): Promise<Task[]> {
		const { data, error, response } = await client.GET('/suggestions', { signal: init.signal });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data.map(reviveTask);
	},

	async createTask({ taskCreate }: { taskCreate: TaskCreate }): Promise<Task> {
		const { deadline, ...rest } = taskCreate;
		const { data, error, response } = await client.POST('/tasks', {
			body: { ...rest, deadline: toRawDeadline(deadline) },
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return reviveTask(data);
	},

	// Schnellerfassung (#236): extrahiert aus frei formuliertem Text strukturierte Task-Felder
	// per LLM (`POST /tasks/parse-text`), die anschließend das Anlege-Formular vorausfüllen.
	// **Retry bei transienten 5xx-Fehlern (#620):** Bei Ausfall/Timeout wird bis zu 2× retry-t.
	async parseText({ text }: { text: string }): Promise<ParsedTask> {
		const { data } = await withRetry(() => client.POST('/tasks/parse-text', { body: { text } }));
		return data;
	},

	// Suchanfrage in Suchbegriff und Kategorie zerlegen (`POST /tasks/parse-search`), damit eine
	// gesprochene Anfrage wie „offene Sachen zum Hausbau" direkt den Kategorie-Filter setzt.
	// Retry-Verhalten wie `parseText` — derselbe LLM-Upstream.
	async parseSearch({ text }: { text: string }): Promise<ParsedSearch> {
		const { data } = await withRetry(() => client.POST('/tasks/parse-search', { body: { text } }));
		return data;
	},

	// CSV-Import (#1969): Vorschau ohne Schreibzugriff — Datei clientseitig gelesen und als String
	// gesendet. Ohne `mapping` gilt die Todoist-Auto-Erkennung (TYPE/CONTENT/PRIORITY/DATE).
	async previewTaskImport({ csv, mapping }: { csv: string; mapping?: TaskImportMapping }): Promise<TaskImportPreview> {
		const { data, error, response } = await client.POST('/tasks/import/preview', {
			body: mapping === undefined ? { csv } : { csv, mapping },
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	// CSV-Import (#1969): legt die übernehmbaren Zeilen als Aufgaben an; `errors` nennt die
	// übersprungenen Zeilen einzeln (Nummer + Grund), ohne den Import abzubrechen.
	async importTasks({ csv, mapping }: { csv: string; mapping?: TaskImportMapping }): Promise<TaskImportResult> {
		const { data, error, response } = await client.POST('/tasks/import', {
			body: mapping === undefined ? { csv } : { csv, mapping },
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	// Import-Bericht (#1988): Analyse derselben CSV — Grundform (Anzahl, ohne Frist, Dubletten)
	// ohne KI-Kontingent; KI-Vorschläge degradiert der Server still (leere Liste).
	async analyzeTaskImport({ csv, mapping }: { csv: string; mapping?: TaskImportMapping }): Promise<TaskImportAnalysis> {
		const { data, error, response } = await client.POST('/tasks/import/analysis', {
			body: mapping === undefined ? { csv } : { csv, mapping },
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	// Exakte Dublette zusammenführen (#1988): Kopie entfernen, fehlende Frist/Priorität übernehmen.
	async mergeTaskImportDuplicate({
		keepTaskId,
		duplicateTaskId,
	}: {
		keepTaskId: number;
		duplicateTaskId: number;
	}): Promise<TaskImportMergeResult> {
		const { data, error, response } = await client.POST('/tasks/import/merge', {
			body: { keepTaskId, duplicateTaskId },
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	async updateTask({ id, taskUpdate }: { id: number; taskUpdate: TaskUpdate }): Promise<Task> {
		const { deadline, ...rest } = taskUpdate;
		const { data, error, response } = await client.PATCH('/tasks/{id}', {
			params: { path: { id } },
			body: { ...rest, deadline: toRawDeadline(deadline) },
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return reviveTask(data);
	},

	async deleteTask({ id }: { id: number }): Promise<void> {
		const { error, response } = await client.DELETE('/tasks/{id}', { params: { path: { id } } });
		if (!response.ok) {
			throw new ResponseError(response, error);
		}
	},

	// Archivieren (#1964): einstufig, ohne Bestätigungsdialog — nimmt die Aufgabe aus Liste und
	// Verpasst-Bereich, ohne sie zu löschen und ohne Statuswechsel.
	async archiveTask({ id }: { id: number }): Promise<Task> {
		const { data, error, response } = await client.POST('/tasks/{id}/archive', { params: { path: { id } } });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return reviveTask(data);
	},

	// Kurz zurückstellen (#2244): blendet die Aufgabe serverseitig 3 h aus /next und /suggestions aus.
	async snoozeTask({ id }: { id: number }): Promise<Task> {
		const { data, error, response } = await client.POST('/tasks/{id}/snooze', { params: { path: { id } } });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return reviveTask(data);
	},

	// KI-Entwurf (#2350): erst dieser Aufruf startet das LLM; das Ergebnis liegt danach in `aiDraft`.
	async createTaskAiDraft({ id }: { id: number }): Promise<string> {
		const { data, error, response } = await client.POST('/tasks/{id}/ai-draft', { params: { path: { id } } });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data.aiDraft;
	},

	async deleteTaskAiDraft({ id }: { id: number }): Promise<void> {
		const { error, response } = await client.DELETE('/tasks/{id}/ai-draft', { params: { path: { id } } });
		if (!response.ok) {
			throw new ResponseError(response, error);
		}
	},

	// Wiederherstellen: holt eine archivierte Aufgabe zurück in Liste (und ggf. Verpasst-Bereich).
	async unarchiveTask({ id }: { id: number }): Promise<Task> {
		const { data, error, response } = await client.POST('/tasks/{id}/unarchive', { params: { path: { id } } });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return reviveTask(data);
	},

	async addDependency({ id, dependencyInput }: { id: number; dependencyInput: DependencyInput }): Promise<Task> {
		const { data, error, response } = await client.POST('/tasks/{id}/dependencies', {
			params: { path: { id } },
			body: dependencyInput,
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return reviveTask(data);
	},

	async removeDependency({ id, depId }: { id: number; depId: number }): Promise<void> {
		const { error, response } = await client.DELETE('/tasks/{id}/dependencies/{depId}', {
			params: { path: { id, depId } },
		});
		if (!response.ok) {
			throw new ResponseError(response, error);
		}
	},

	async listPillars(init: Init = {}): Promise<Pillar[]> {
		const { data, error, response } = await client.GET('/pillars', { signal: init.signal });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	async setPillarWeights({ pillarWeightsInput }: { pillarWeightsInput: PillarWeightsInput }): Promise<Pillar[]> {
		const { data, error, response } = await client.PUT('/pillars/weights', { body: pillarWeightsInput });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	// ── Kategorien (thematische Ordnungsebene neben den Säulen) ────────────────

	async listCategories(init: Init = {}): Promise<Category[]> {
		const { data, error, response } = await client.GET('/categories', { signal: init.signal });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		// Hier sortiert statt in den einzelnen Auswahlfeldern: So stehen Formular, Suchfilter,
		// Aufgaben-Filterleiste und die Liste im Einstellungs-Tab in derselben Reihenfolge. Warum die
		// Server-Sortierung dafür nicht reicht, steht bei `sortCategoriesByName`.
		return sortCategoriesByName(data);
	},

	async createCategory({ categoryCreate }: { categoryCreate: CategoryCreate }): Promise<Category> {
		const { data, error, response } = await client.POST('/categories', { body: categoryCreate });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	async updateCategory({ id, categoryUpdate }: { id: number; categoryUpdate: CategoryUpdate }): Promise<Category> {
		const { data, error, response } = await client.PATCH('/categories/{id}', {
			params: { path: { id } },
			body: categoryUpdate,
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	async deleteCategory({ id }: { id: number }): Promise<void> {
		const { error, response } = await client.DELETE('/categories/{id}', { params: { path: { id } } });
		if (!response.ok) {
			throw new ResponseError(response, error);
		}
	},

	// ── Gruppen (#1211) ────────────────────────────────────────────────────────

	async listGroups(init: Init = {}): Promise<Group[]> {
		const { data, error, response } = await client.GET('/groups', { signal: init.signal });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	async createGroup({ groupInput }: { groupInput: GroupInput }): Promise<Group> {
		const { data, error, response } = await client.POST('/groups', { body: groupInput });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	// `tz` bestimmt serverseitig die Kalendertagsgrenze des gemeinsamen Streaks (Muster `getStreak`).
	async getGroupDuo({ id, tz, signal }: { id: number; tz?: string } & Init): Promise<Duo> {
		const { data, error, response } = await client.GET('/groups/{id}/duo', {
			params: { path: { id }, query: { tz } },
			signal,
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	async updateGroup({ id, groupUpdate }: { id: number; groupUpdate: GroupUpdate }): Promise<Group> {
		const { data, error, response } = await client.PATCH('/groups/{id}', {
			params: { path: { id } },
			body: groupUpdate,
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	async deleteGroup({ id }: { id: number }): Promise<void> {
		const { error, response } = await client.DELETE('/groups/{id}', { params: { path: { id } } });
		if (!response.ok) {
			throw new ResponseError(response, error);
		}
	},

	// ── Einladungen und Mitgliedschaftspflege (#1212) ──────────────────────────

	async searchUsers({ query, ...init }: { query: string } & Init): Promise<UserSearchHit[]> {
		const { data, error, response } = await client.GET('/users/search', {
			params: { query: { query } },
			signal: init.signal,
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	// ── Nutzerverwaltung (Rollensystem admin/member) ───────────────────────────

	async getAdminUsers(init: Init = {}): Promise<AdminUser[]> {
		const { data, error, response } = await client.GET('/admin/users', { signal: init.signal });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	/** #1983: Zugelassene Adressen mit Herkunft (auch ohne Konto) — Admin-Sicht. */
	async getAllowedEmails(init: Init = {}): Promise<AllowedEmail[]> {
		const { data, error, response } = await client.GET('/admin/allowed-emails', { signal: init.signal });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	async updateUserRole({ id, role }: { id: number; role: AdminUser['role'] }): Promise<AdminUser> {
		const { data, error, response } = await client.PATCH('/admin/users/{id}/role', {
			params: { path: { id } },
			body: { role },
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	/** #1556: Kostenfreier Paket-Wechsel des eigenen Kontos (Route aus #1456, ohne Zahlungsweg). */
	async updateUserPlan({ id, plan }: { id: number; plan: AdminUser['plan'] }): Promise<AdminUser> {
		const { data, error, response } = await client.PATCH('/admin/users/{id}/plan', {
			params: { path: { id } },
			body: { plan },
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	/** #1959: Sperrt das Abo eines Nutzers — Zugriff aufs bezahlte Paket stoppt sofort (Admin). */
	async lockUserSubscription({ id }: { id: number }): Promise<AdminUser> {
		const { data, error, response } = await client.POST('/admin/users/{id}/subscription/lock', {
			params: { path: { id } },
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	/** #1959: Kündigt das Abo eines Nutzers beim Zahlungsdienstleister (Admin, ADR 0013). */
	async cancelUserSubscription({ id }: { id: number }): Promise<AdminUser> {
		const { data, error, response } = await client.POST('/admin/users/{id}/subscription/cancel', {
			params: { path: { id } },
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	/** #1958: Rechnungen eines Nutzers — Admin-Sicht (Spiegel der Eigentümer-Route /billing/invoices). */
	async getAdminUserInvoices({ id, signal }: { id: number } & Init): Promise<components['schemas']['Invoice'][]> {
		const { data, error, response } = await client.GET('/admin/users/{id}/invoices', {
			params: { path: { id } },
			signal,
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	/** #2327: fremdes Konto löschen (dieselben Regeln wie die Selbstlöschung). */
	async deleteAdminUser({ id }: { id: number }): Promise<void> {
		const { error, response } = await client.DELETE('/admin/users/{id}', { params: { path: { id } } });
		if (!response.ok) {
			throw new ResponseError(response, error);
		}
	},

	/** #2295: Abos eines Nutzers — Admin-Sicht, Grundlage der Lösch-Aktionen. */
	async getAdminUserSubscriptions({ id }: { id: number }): Promise<components['schemas']['AdminSubscription'][]> {
		const { data, error, response } = await client.GET('/admin/users/{id}/subscriptions', {
			params: { path: { id } },
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	/** #2295: ein Abo restlos löschen (PayPal-Kündigung, Abo + Rechnungen) — `subscriptionId` fehlt = alle Abos. */
	async deleteAdminUserSubscriptions({
		id,
		subscriptionId,
	}: {
		id: number;
		subscriptionId?: number;
	}): Promise<AdminUser> {
		const { data, error, response } =
			subscriptionId === undefined
				? await client.DELETE('/admin/users/{id}/subscriptions', { params: { path: { id } } })
				: await client.DELETE('/admin/users/{id}/subscriptions/{subscriptionId}', {
						params: { path: { id, subscriptionId } },
					});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	/**
	 * Batch: Säulenverteilung aller Aufgaben (inkl. erledigter) neu berechnen — Admin-Trigger.
	 * Fortsetzbar (#1614): `restart: true` beginnt den Lauf für alle Konten neu, sonst werden nur
	 * die seit dem Laufstart noch offenen Aufgaben verarbeitet. Erfolgreich verarbeitete fallen aus
	 * der Auswahl, `offset` zählt daher nur die Fehlschläge der laufenden Serie.
	 */
	async reassignTaskPillars({
		offset,
		status,
		limit,
		restart,
		signal,
	}: {
		offset?: number;
		status?: ReassignStatusFilter;
		limit?: number;
		restart?: boolean;
	} & Init = {}): Promise<ReassignRunStarted> {
		const { data, error, response } = await client.POST('/admin/tasks/reassign-pillars', {
			params: {
				query: { offset: offset !== undefined && offset > 0 ? offset : undefined, status, limit, restart },
			},
			signal,
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},
	/** Stand des app-weiten Batches (#1614): Aufgaben insgesamt und noch offen. */
	async getReassignPillarsStatus({
		status,
		signal,
	}: { status?: ReassignStatusFilter } & Init = {}): Promise<OwnReassignPillarsStatus> {
		const { data, error, response } = await client.GET('/admin/tasks/reassign-pillars/status', {
			params: { query: { status } },
			signal,
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},
	/**
	 * Neuberechnung der Säulenverteilung über die EIGENEN Aufgaben (#1614). Ein Aufruf verarbeitet
	 * höchstens `limit` noch offene Aufgaben des Laufs. `restart: true` beginnt einen neuen Lauf,
	 * sonst wird der letzte fortgesetzt. Erfolgreich verarbeitete fallen aus der Auswahl, `offset`
	 * zählt daher nur die in dieser Serie fehlgeschlagenen. Fortschritt aus `remaining`.
	 */
	async reassignOwnTaskPillars({
		status,
		limit,
		offset,
		restart,
		signal,
	}: {
		status?: ReassignStatusFilter;
		limit?: number;
		offset?: number;
		restart?: boolean;
	} & Init = {}): Promise<ReassignRunStarted> {
		const { data, error, response } = await client.POST('/tasks/reassign-pillars', {
			params: { query: { status, limit, offset, restart } },
			signal,
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},
	/** Stand des letzten Laufs der Säulen-Neuberechnung (#1614): Start und noch offene Aufgaben. */
	async getOwnReassignPillarsStatus({
		status,
		signal,
	}: { status?: ReassignStatusFilter } & Init = {}): Promise<OwnReassignPillarsStatus> {
		const { data, error, response } = await client.GET('/tasks/reassign-pillars/status', {
			params: { query: { status } },
			signal,
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	async getGroupMembers({ id, ...init }: { id: number } & Init): Promise<GroupMember[]> {
		const { data, error, response } = await client.GET('/groups/{id}/members', {
			params: { path: { id } },
			signal: init.signal,
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	async getGroupInvitations({ id, ...init }: { id: number } & Init): Promise<GroupInvitation[]> {
		const { data, error, response } = await client.GET('/groups/{id}/invitations', {
			params: { path: { id } },
			signal: init.signal,
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	/** Füreinander angelegte offene Aufgaben der Gruppe (#1223), sortiert nach Empfänger/Fälligkeit. */
	async getGroupTasks({ id, ...init }: { id: number } & Init): Promise<GroupTask[]> {
		const { data, error, response } = await client.GET('/groups/{id}/tasks', {
			params: { path: { id } },
			signal: init.signal,
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	/** Füreinander angelegte Serien der Gruppe (#1254), sortiert nach Eigentümer/Titel. */
	async getGroupSeries({ id, ...init }: { id: number } & Init): Promise<GroupSeries[]> {
		const { data, error, response } = await client.GET('/groups/{id}/series', {
			params: { path: { id } },
			signal: init.signal,
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	async inviteGroupMember({ id, userId }: { id: number; userId: number }): Promise<GroupInvitation> {
		const { data, error, response } = await client.POST('/groups/{id}/invitations', {
			params: { path: { id } },
			body: { userId },
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	async removeGroupMember({ id, userId }: { id: number; userId: number }): Promise<void> {
		const { error, response } = await client.DELETE('/groups/{id}/members/{userId}', {
			params: { path: { id, userId } },
		});
		if (!response.ok) {
			throw new ResponseError(response, error);
		}
	},

	async updateGroupMemberRole({
		id,
		userId,
		role,
	}: {
		id: number;
		userId: number;
		role: GroupMember['role'];
	}): Promise<GroupMember> {
		const { data, error, response } = await client.PATCH('/groups/{id}/members/{userId}', {
			params: { path: { id, userId } },
			body: { role },
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	async listReceivedInvitations(init: Init = {}): Promise<ReceivedInvitation[]> {
		const { data, error, response } = await client.GET('/invitations', { signal: init.signal });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	async acceptInvitation({ id }: { id: number }): Promise<void> {
		const { error, response } = await client.POST('/invitations/{id}/accept', { params: { path: { id } } });
		if (!response.ok) {
			throw new ResponseError(response, error);
		}
	},

	async declineInvitation({ id }: { id: number }): Promise<void> {
		const { error, response } = await client.POST('/invitations/{id}/decline', { params: { path: { id } } });
		if (!response.ok) {
			throw new ResponseError(response, error);
		}
	},

	// ── Einladungslinks (#1226) ───────────────────────────────────────────────────────
	// `getInviteLink` und `redeemInviteLink` sprechen den ÖFFENTLICH gemounteten Teil-Router an
	// (express/index.ts vor requireAuth); redeem prüft die Session selbst (401).

	/** Jüngste Challenge der Gruppe (#1992) — `null`, solange die Gruppe noch keine hatte (204). */
	async getGroupChallenge({ id, ...init }: { id: number } & Init): Promise<GroupChallenge | null> {
		const { data, error, response } = await client.GET('/groups/{id}/challenge', {
			params: { path: { id } },
			signal: init.signal,
		});
		if (!response.ok) {
			throw new ResponseError(response, error);
		}
		return data ?? null;
	},

	async startGroupChallenge({ id }: { id: number }): Promise<GroupChallenge> {
		const { data, error, response } = await client.POST('/groups/{id}/challenge', { params: { path: { id } } });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	async createGroupInviteLink({ id }: { id: number }): Promise<GroupInviteLink> {
		const { data, error, response } = await client.POST('/groups/{id}/invite-links', { params: { path: { id } } });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	async getInviteLink({ token }: { token: string }): Promise<InviteLinkPreview> {
		const { data, error, response } = await client.GET('/invite-links/{token}', { params: { path: { token } } });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	async redeemInviteLink({ token }: { token: string }): Promise<InviteLinkRedeemResult> {
		const { data, error, response } = await client.POST('/invite-links/{token}/redeem', {
			params: { path: { token } },
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	async revokeInviteLink({ id }: { id: number }): Promise<void> {
		const { error, response } = await client.DELETE('/invite-links/{id}', { params: { path: { id } } });
		if (!response.ok) {
			throw new ResponseError(response, error);
		}
	},

	async suggestPillars({
		suggestPillarsInput,
		signal,
	}: { suggestPillarsInput: SuggestPillarsInput } & Init): Promise<PillarSuggestion[]> {
		const { data, error, response } = await client.POST('/tasks/suggest-pillars', {
			body: suggestPillarsInput,
			signal,
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data.suggestions;
	},

	// Erststart-Flow (#2069): schlägt aus einem Freitext konkrete erste Aufgaben vor
	// (`POST /tasks/suggest-initial`, #2068). Der Server kann nach Bereinigung auch weniger als
	// 5 Einträge — bis hin zu keiner — mit 200 liefern; das ist kein Fehlerfall.
	async suggestInitialTasks({ text }: { text: string }): Promise<SuggestInitialTaskSuggestion[]> {
		const { data, error, response } = await client.POST('/tasks/suggest-initial', { body: { text } });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data.suggestions;
	},

	// Aktivitäten-Berater (`POST /pillars/advisor`): schlägt per Mistral konkrete Aktivitäten vor
	// und ordnet sie den Säulen zu, auf die sie einzahlen würden — optional gelenkt durch eine Frage.
	// **Retry bei transienten 5xx-Fehlern (#620):** Bei Ausfall/Timeout wird bis zu 2× retry-t.
	async advisePillarActivities({
		activityAdvisorInput,
		signal,
	}: { activityAdvisorInput: ActivityAdvisorInput } & Init): Promise<ActivityAdvisorResult> {
		const { data } = await withRetry(() => client.POST('/pillars/advisor', { body: activityAdvisorInput, signal }));
		return data;
	},

	// Speichert eine vom Nutzer bestätigte/korrigierte Säulen-Zuordnung als Lern-Sample für
	// nachfolgende Vorschläge (Feedback-Loop, #45). Best-Effort: Fehler werden vom Aufrufer
	// bewusst geschluckt, da das Feedback ein Nice-to-have ist und das Speichern nicht blockieren darf.
	async recordPillarFeedback({
		pillarFeedbackInput,
		signal,
	}: { pillarFeedbackInput: PillarFeedbackInput } & Init): Promise<void> {
		const { error, response } = await client.POST('/tasks/suggest-pillars/feedback', {
			body: pillarFeedbackInput,
			signal,
		});
		if (!response.ok) {
			throw new ResponseError(response, error);
		}
	},

	// Lektorat (#680): Lektoriert Texte und kürzt sie optional auf eine Maximallänge.
	// Auth via Session-Cookie (same-origin) — direkter fetch, nicht im OpenAPI-Spec.
	async lektorat({ text, maxLength, signal }: { text: string; maxLength?: number } & Init): Promise<{ text: string }> {
		const response = await fetch(`${baseUrl}/lektorat`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'x-csrf-token': await ensureCsrfToken(), ...appTokenHeaders() },
			body: JSON.stringify({ text, maxLength }),
			signal,
		});
		if (!response.ok) {
			const error = await response.json().catch(() => ({ message: 'Unbekannter Fehler' }));
			throw new ResponseError(response, error);
		}
		const data = await response.json();
		return { text: data.text };
	},

	// Feedback nach Obsidian (#1435): Kategorie/Titel/Beschreibung landen als Markdown im
	// Feedback-Branch des Vault-Repos. Auth via Session-Cookie (same-origin) — direkter fetch,
	// nicht im OpenAPI-Spec (Muster `lektorat` oben).
	async sendFeedback({
		category,
		title,
		description,
		signal,
	}: { category: string; title: string; description: string } & Init): Promise<void> {
		const response = await fetch(`${baseUrl}/feedback`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'x-csrf-token': await ensureCsrfToken(), ...appTokenHeaders() },
			body: JSON.stringify({ category, title, description }),
			signal,
		});
		if (!response.ok) {
			const error = await response.json().catch(() => ({ message: 'Unbekannter Fehler' }));
			throw new ResponseError(response, error);
		}
	},

	// --- Serien-Templates (#120/#142) ---

	async listSeries(init: Init = {}): Promise<Series[]> {
		const { data, error, response } = await client.GET('/series', { signal: init.signal });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data.map(reviveSeries);
	},

	async getSeries({ id }: { id: number }): Promise<Series> {
		const { data, error, response } = await client.GET('/series/{id}', { params: { path: { id } } });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return reviveSeries(data);
	},

	async createSeries({ seriesCreate }: { seriesCreate: SeriesCreate }): Promise<Series> {
		const { startDate, ...rest } = seriesCreate;
		const { data, error, response } = await client.POST('/series', {
			body: startDate === undefined ? rest : { ...rest, startDate: startDate.toISOString() },
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return reviveSeries(data);
	},

	async updateSeries({ id, seriesUpdate }: { id: number; seriesUpdate: SeriesUpdate }): Promise<Series> {
		const { startDate, ...rest } = seriesUpdate;
		const { data, error, response } = await client.PATCH('/series/{id}', {
			params: { path: { id } },
			body: startDate === undefined ? rest : { ...rest, startDate: startDate.toISOString() },
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return reviveSeries(data);
	},

	// Legt genau eine Aufgabe aus einer Serie/Vorlage an (#2357/#2359); `deadline` als ISO-String.
	async createSeriesInstance({
		id,
		seriesInstanceInput,
	}: {
		id: number;
		seriesInstanceInput: SeriesInstanceInput;
	}): Promise<Task> {
		const { data, error, response } = await client.POST('/series/{id}/instances', {
			params: { path: { id } },
			body: seriesInstanceInput,
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return reviveTask(data);
	},

	async deleteSeries({ id, cascade }: { id: number; cascade?: boolean }): Promise<void> {
		const { error, response } = await client.DELETE('/series/{id}', {
			params: cascade === undefined ? { path: { id } } : { path: { id }, query: { cascade } },
		});
		if (!response.ok) {
			throw new ResponseError(response, error);
		}
	},

	// Meldet einen Kauf aus Google Play an den Server, der ihn prüft, bestätigt und freischaltet (#1692).
	async submitGooglePurchase(purchaseToken: string): Promise<void> {
		const { error, response } = await client.POST('/billing/google/purchase', { body: { purchaseToken } });
		if (!response.ok) {
			throw new ResponseError(response, error);
		}
	},

	// Löscht das eigene Konto samt Session (#1671). Die Frontend-Aufräumarbeit erledigt der Aufrufer.
	/** Speichert die Zustimmung zu Nutzungsbedingungen und Datenschutzerklärung (#1901). */
	async acceptTerms(): Promise<void> {
		const { error, response } = await client.POST('/auth/terms', { body: { acceptTerms: true, acceptPrivacy: true } });
		if (!response.ok) {
			throw new ResponseError(response, error);
		}
	},

	async deleteAccount(): Promise<void> {
		const { error, response } = await client.DELETE('/auth/me');
		if (!response.ok) {
			throw new ResponseError(response, error);
		}
	},

	// Zerstört die serverseitige Session. Die Frontend-Aufräumarbeit (localStorage, Redirect) erledigt
	// der Aufrufer. Eigener fetch statt openapi-fetch, da /auth/* nicht in der OpenAPI-Spec steht —
	// aber wie alle anderen Endpunkte unter dem proxied `/api/v1`-Präfix (s. checkAuth() in lib/auth.ts).
	async logout(): Promise<void> {
		const response = await fetch(`${getApiBase()}/auth/logout`, {
			method: 'POST',
			headers: { 'x-csrf-token': await ensureCsrfToken(), ...appTokenHeaders() },
		});
		if (!response.ok) {
			throw new Error(`Logout fehlgeschlagen (${response.status})`);
		}
		// Session ist serverseitig zerstört — den (an die alte Session gebundenen) Token verwerfen;
		// ein App-Token hat der Server mit dem Aufruf widerrufen (#2379).
		csrfToken = null;
		clearAppToken();
	},

	// Materialisiert die bis `until` (inklusive) fälligen Instanzen einer Serie als eigenständige Tasks.
	async generateSeriesInstances({
		id,
		seriesGenerateInput,
	}: {
		id: number;
		seriesGenerateInput: SeriesGenerateInput;
	}): Promise<Task[]> {
		const { data, error, response } = await client.POST('/series/{id}/generate', {
			params: { path: { id } },
			body: { until: seriesGenerateInput.until.toISOString() },
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data.map(reviveTask);
	},

	// --- Web-Push (#355) ---

	// Öffentlichen VAPID-Schlüssel abrufen (nötig für PushManager.subscribe). Wirft bei 503, wenn
	// Web-Push serverseitig nicht konfiguriert ist.
	async getVapidPublicKey(init: Init = {}): Promise<string> {
		const { data, error, response } = await client.GET('/push/vapid-public-key', { signal: init.signal });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data.publicKey;
	},

	// Browser-Subscription am Backend anmelden (idempotent auf dem endpoint).
	async subscribePush({ subscription }: { subscription: PushSubscriptionInput }): Promise<void> {
		const { error, response } = await client.POST('/push/subscribe', { body: subscription });
		if (!response.ok) {
			throw new ResponseError(response, error);
		}
	},

	// Browser-Subscription am Backend abmelden.
	async unsubscribePush({ endpoint }: { endpoint: string }): Promise<void> {
		const { error, response } = await client.POST('/push/unsubscribe', { body: { endpoint } });
		if (!response.ok) {
			throw new ResponseError(response, error);
		}
	},

	// FCM-Token der Android-App an- bzw. abmelden (#1679); der Server schickt Benachrichtigungen dann auch per FCM.
	async registerFcmToken(token: string): Promise<void> {
		const { error, response } = await client.POST('/push/fcm/register', { body: { token } });
		if (!response.ok) {
			throw new ResponseError(response, error);
		}
	},

	async unregisterFcmToken(token: string): Promise<void> {
		const { error, response } = await client.POST('/push/fcm/unregister', { body: { token } });
		if (!response.ok) {
			throw new ResponseError(response, error);
		}
	},

	// Test-Push mit einem zufälligen Zitat an alle eigenen Subscriptions auslösen (#386). Liefert die
	// Zahl der Zustellungen und das gewählte Zitat zurück.
	async sendTestPush(init: Init = {}): Promise<{ sent: number; quote: { text: string; author: string } }> {
		const { data, error, response } = await client.POST('/push/test', { signal: init.signal });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	// --- Provider-Verwaltung: Custom-Provider + fixe Built-ins (Mistral/OpenRouter aus ENV) ---

	// Alle Provider inkl. effektiver Aktiv-Markierung — Built-ins zuerst (ohne API-Keys, Write-Only).
	async listLlmProviders(init: Init = {}): Promise<LlmProvider[]> {
		const { data, error, response } = await client.GET('/llm-providers', { signal: init.signal });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	// Legt einen Custom-Provider an — inaktiv; Aktivierung und Modellwahl erfolgen danach.
	async createLlmProvider({ input }: { input: LlmProviderInput }): Promise<LlmProvider> {
		const { data, error, response } = await client.POST('/llm-providers', { body: input });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	// Aktualisiert einen Provider; apiKey nur bei Änderung (nicht-leerer String).
	async updateLlmProvider({ id, input }: { id: number; input: LlmProviderUpdate }): Promise<LlmProvider> {
		const { data, error, response } = await client.PUT('/llm-providers/{id}', {
			params: { path: { id } },
			body: input,
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	// Löscht einen Provider (204 → void).
	async deleteLlmProvider({ id }: { id: number }): Promise<void> {
		const { error, response } = await client.DELETE('/llm-providers/{id}', { params: { path: { id } } });
		if (!response.ok) {
			throw new ResponseError(response, error);
		}
	},

	// Setzt den Provider als einzigen aktiven Provider (Radio-Button-Logik) — für Custom- UND
	// Built-in-Provider. Ohne explizite Wahl bleibt der Built-in-Fallback (Mistral vor OpenRouter).
	async activateLlmProvider({ id }: { id: number }): Promise<LlmProvider> {
		const { data, error, response } = await client.POST('/llm-providers/{id}/activate', {
			params: { path: { id } },
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	// Test-Prompt über den Provider (Settings „KI-Provider"): meldet Erfolg inkl. Latenz und
	// Antwort-Auszug oder die konkrete Fehlerursache (Auth/Modell/Abo/Netzwerk) — unabhängig
	// davon, ob der Provider aktiv ist.
	async testLlmProvider({ id }: { id: number }): Promise<LlmProviderTestResult> {
		const { data, error, response } = await client.POST('/llm-providers/{id}/test', {
			params: { path: { id } },
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	// Verbindungstest eines Provider-ENTWURFS aus dem Anlege-/Bearbeiten-Dialog (#1577): prüft
	// die ungespeicherten Formulardaten (Key-Fallback über providerId im Bearbeiten-Modus),
	// ohne dass ein Provider angelegt oder verändert wird.
	async testLlmProviderDraft({
		endpoint,
		apiKey,
		model,
		providerId,
	}: LlmProviderTestDraft): Promise<LlmProviderTestResult> {
		const body: LlmProviderTestDraft = { endpoint, apiKey, model };
		if (providerId !== undefined) {
			body.providerId = providerId; // Nur im Bearbeiten-Modus — im Anlegen-Modus bleibt der Key weg.
		}
		const { data, error, response } = await client.POST('/llm-providers/test-dry', { body });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	// Verfügbare Modelle eines Providers — dynamisch aus dessen OpenAI-kompatibler
	// `GET /models`-Antwort (serverseitig kurz gecacht); Basis der Modell-Auswahl.
	async listLlmProviderModels({ id, signal }: { id: number } & Init): Promise<LlmModels> {
		const { data, error, response } = await client.GET('/llm-providers/{id}/models', {
			params: { path: { id } },
			signal,
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	// --- Reverse Geocoding (#866) ---

	// Reverse Geocoding: Koordinaten → Adresse (Nominatim).
	async reverseGeocode({ lat, lon, signal }: { lat: number; lon: number } & Init): Promise<{ address: string }> {
		const { data, error, response } = await client.GET('/reverse-geocode', {
			params: { query: { lat: String(lat), lon: String(lon) } },
			signal,
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	// --- Adresssuche / Forward Geocoding (Aufgaben-Ortsbezug) ---

	// Adresssuche: Suchtext → Vorschlagsliste (Nominatim).
	async geocodeSearch({ q, signal }: { q: string } & Init): Promise<GeocodeSearchResultDto[]> {
		const { data, error, response } = await client.GET('/geocode-search', {
			params: { query: { q } },
			signal,
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	// --- Aufgaben in der Nähe (#1066) ---

	// Offene Tasks mit Koordinaten, aufsteigend nach Distanz zur Position (max. 10, serverseitig sortiert).
	async listNearbyTasks({ lat, lon, signal }: { lat: number; lon: number } & Init): Promise<NearbyTask[]> {
		const { data, error, response } = await client.GET('/tasks/nearby', {
			params: { query: { lat, lon } },
			signal,
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data as NearbyTask[];
	},

	// --- Streak: Tage in Folge mit mindestens einer Erledigung (#1360) ---

	// `tz` ist die IANA-Zeitzone des Clients — sie bestimmt serverseitig die Kalendertagsgrenze.
	// Ohne oder mit unbekanntem Wert wertet der Server in seiner eigenen Zeitzone aus (kein Fehler).
	async getStreak({ tz, signal }: { tz?: string } & Init = {}): Promise<Streak> {
		const { data, error, response } = await client.GET('/scores/streak', { params: { query: { tz } }, signal });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	// --- Meilenstein-Badges: feste Streak-/Punkte-Stufen (#1362) ---

	async getMilestones({ tz, signal }: { tz?: string } & Init = {}): Promise<Milestone[]> {
		const { data, error, response } = await client.GET('/scores/milestones', {
			params: { query: { tz } },
			signal,
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	// --- Lebensbalance: Füllstand im Kadenz-Modell (#1638) — dieselbe Rechnung wie MCP `balance_status` ---

	async getBalanceStatus({ tz, signal }: { tz?: string } & Init = {}): Promise<BalanceStatus> {
		const { data, error, response } = await client.GET('/scores/balance', { params: { query: { tz } }, signal });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	// --- Wochenverlauf der Lebensbalance (#1424) — je Kalendertag des Intervalls ein Eintrag (#1968) ---

	// `von`/`bis` sind Kalendertage (YYYY-MM-DD), `tz` die IANA-Zeitzone des Clients — sie bestimmt
	// serverseitig die Kalendertagsgrenze (Muster `getStreak`).
	async getBalanceHistory({
		von,
		bis,
		tz,
		signal,
	}: { von: string; bis: string; tz?: string } & Init): Promise<BalanceHistoryEntry[]> {
		const { data, error, response } = await client.GET('/scores/balance/history', {
			params: { query: { von, bis, tz } },
			signal,
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	// --- Wochenkarten-Share-Ping (#1989): meldet das Teilen der Karte — je Kalenderwoche einmal,
	// ohne Karteninhalt. Die Card ruft ihn fire-and-forget nach dem System-Share auf.
	async postWochenkarteShare(init: Init = {}): Promise<void> {
		const { error, response } = await client.POST('/kpis/wochenkarte', { signal: init.signal });
		if (!response.ok || error) {
			throw new ResponseError(response, error);
		}
	},

	// --- Monatsrückblick (#1995): Säulen, Streak und Meilensteine des Vormonats in einer Antwort ---
	async getMonthlyRecap({ monat, tz, signal }: { monat: string; tz?: string } & Init): Promise<MonthlyRecap> {
		const { data, error, response } = await client.GET('/scores/monthly-recap', {
			params: { query: { monat, tz } },
			signal,
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	// --- Jahresrückblick (#1997): fünf Kennzahlen des Kalenderjahres in einer Antwort ---
	async getYearlyRecap({ jahr, tz, signal }: { jahr: number; tz?: string } & Init): Promise<YearlyRecap> {
		const { data, error, response } = await client.GET('/scores/yearly-recap', {
			params: { query: { jahr: String(jahr), tz } },
			signal,
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	// --- Fürsorge-Vorschläge gegen ein Balance-Defizit (#1791, Dashboard-Hinweis #1793) ---

	async getCareSuggestions({ sprache, signal }: { sprache?: string } & Init = {}): Promise<{
		vorschlaege: CareVorschlag[];
	}> {
		const { data, error, response } = await client.GET('/scores/care-suggestions', {
			params: { query: { sprache } },
			signal,
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	async dismissCareSuggestion({ templateKey }: { templateKey: string }): Promise<void> {
		const { error, response } = await client.POST('/scores/care-suggestions/dismissals', { body: { templateKey } });
		if (!response.ok) {
			throw new ResponseError(response, error);
		}
	},

	// "Nicht jetzt" mit Grund (#1977): der Bezug ist genau eins von taskId/templateKey.
	async rejectCareSuggestion({
		grund,
		taskId,
		templateKey,
	}: {
		grund: components['schemas']['CareSuggestionRejectionCreate']['grund'];
		taskId?: number;
		templateKey?: string;
	}): Promise<void> {
		const { error, response } = await client.POST('/scores/care-suggestions/rejections', {
			body: { grund, taskId, templateKey },
		});
		if (!response.ok) {
			throw new ResponseError(response, error);
		}
	},

	// --- Verpasste Aufgaben: vom Auto-Delete-Cron gelöschte Aufgaben (Bewertungssystem-Sichtbarkeit) ---

	async getMissedTasks(init: Init = {}): Promise<MissedTasksSummary> {
		const { data, error, response } = await client.GET('/scores/missed', { signal: init.signal });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	// --- Geo-Konfiguration pro User (#1098) ---

	// Anzeige-/Alarm-Entfernung + Aktualisierungsintervall (serverseitig gespeichert, mit Defaults).
	async getGeoConfig(init: Init = {}): Promise<GeoConfig> {
		const { data, error, response } = await client.GET('/geo-config', { signal: init.signal });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	// Speichert die Geo-Konfiguration; Schranken-Verstöße werden serverseitig mit 400 abgelehnt.
	async updateGeoConfig(config: GeoConfig, init: Init = {}): Promise<GeoConfig> {
		const { data, error, response } = await client.PUT('/geo-config', { body: config, signal: init.signal });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	// --- Dialog-Vorgaben für die MCP-KI (#1935) ---

	// Pro Nutzer gespeicherter Freitext, der im MCP-`initialize`-Handshake ausgeliefert wird.
	async getMcpInstructions(init: Init = {}): Promise<McpInstructions> {
		const { data, error, response } = await client.GET('/mcp-instructions', { signal: init.signal });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	// Speichert die Vorgaben getrimmt (leer löscht); zu lang oder kein String → 400.
	async updateMcpInstructions(instructions: string, init: Init = {}): Promise<McpInstructions> {
		const { data, error, response } = await client.PUT('/mcp-instructions', {
			body: { instructions },
			signal: init.signal,
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	// --- Freie Zeit (#1990) ---

	// Heutige Kalender-Lücken mit passenden Aufgaben; ohne Kalender eine leere Liste.
	async listFreeSlots(init: Init = {}): Promise<FreeSlot[]> {
		const { data, error, response } = await client.GET('/tasks/free-slots', { signal: init.signal });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	// Mindestdauer freier Lücken (serverseitig gespeichert, Default 30 Minuten).
	async getFreeSlotConfig(init: Init = {}): Promise<FreeSlotConfig> {
		const { data, error, response } = await client.GET('/free-slot-config', { signal: init.signal });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	// Speichert die Mindestdauer; Werte außerhalb 10–240 lehnt der Server mit 400 ab.
	async updateFreeSlotConfig(config: FreeSlotConfig): Promise<FreeSlotConfig> {
		const { data, error, response } = await client.PUT('/free-slot-config', { body: config });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	// --- Care-Konfiguration pro User (#1794) ---

	// Fürsorge-Push-Schalter + Nutzer-Zeitzone (serverseitig gespeichert, mit Defaults).
	async getCareConfig(init: Init = {}): Promise<CareConfig> {
		const { data, error, response } = await client.GET('/care-config', { signal: init.signal });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	// Speichert die Care-Konfiguration; ungültige Zeitzonen werden serverseitig mit 400 abgelehnt.
	async updateCareConfig(config: CareConfig, init: Init = {}): Promise<CareConfig> {
		const { data, error, response } = await client.PUT('/care-config', { body: config, signal: init.signal });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	// --- Aufteilen-Hinweis pro User (#1994) ---

	// Schalter „Hinweis zum Aufteilen großer Aufgaben“ (serverseitig gespeichert, Default ein).
	async getSplitHintConfig(init: Init = {}): Promise<SplitHintConfig> {
		const { data, error, response } = await client.GET('/split-hint-config', { signal: init.signal });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	// Speichert den Schalter; Nicht-Boolean lehnt der Server mit 400 ab.
	async updateSplitHintConfig(config: SplitHintConfig, init: Init = {}): Promise<SplitHintConfig> {
		const { data, error, response } = await client.PUT('/split-hint-config', { body: config, signal: init.signal });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	// Meldet die aktive App-Sprache für den Fürsorge-Push (#1879); unbekannte Codes lehnt der Server mit 400 ab.
	async updateCareSprache(sprache: string, init: Init = {}): Promise<void> {
		const { error, response } = await client.PUT('/care-config/sprache', { body: { sprache }, signal: init.signal });
		if (!response.ok) {
			throw new ResponseError(response, error);
		}
	},

	// --- Persönliche API-Tokens für externe Clients (#1352) ---

	// Eigene, nicht zurückgezogene Tokens — ausschließlich Metadaten, nie der Klartext.
	async listApiTokens(init: Init = {}): Promise<ApiToken[]> {
		const { data, error, response } = await client.GET('/api-tokens', { signal: init.signal });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	// Legt einen Token an; der Klartext steckt ausschließlich in dieser einen Antwort.
	async createApiToken({
		name,
		expiresInDays,
	}: {
		name: string;
		expiresInDays: 30 | 90 | 180 | 365;
	}): Promise<CreatedApiToken> {
		const { data, error, response } = await client.POST('/api-tokens', { body: { name, expiresInDays } });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	// Zieht einen eigenen Token zurück (Soft-Delete); danach wird er mit 401 abgewiesen.
	async deleteApiToken({ id }: { id: number }): Promise<void> {
		const { error, response } = await client.DELETE('/api-tokens/{id}', { params: { path: { id } } });
		if (!response.ok) {
			throw new ResponseError(response, error);
		}
	},

	// Schaltet die Rechtestufe eines eigenen Tokens um (#1356) — gilt sofort für denselben Token.
	async updateApiToken({ id, scope }: { id: number; scope: 'read' | 'readwrite' }): Promise<ApiToken> {
		const { data, error, response } = await client.PATCH('/api-tokens/{id}', {
			params: { path: { id } },
			body: { scope },
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	// --- Gespeicherte Orte („Standort-Favoriten", #1342) ---

	// Eigene gespeicherte Orte — Quelle der Favoritenliste im Adressfeld und in den Einstellungen.
	async listPlaceFavorites(init: Init = {}): Promise<PlaceFavoriteView[]> {
		const { data, error, response } = await client.GET('/place-favorites', { signal: init.signal });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data.map(toPlaceFavoriteView);
	},

	// Legt einen gespeicherten Ort an; Koordinaten sind optional (Freitext-Ort, AK4).
	async createPlaceFavorite(favorite: PlaceFavoriteInput): Promise<PlaceFavoriteView> {
		const { data, error, response } = await client.POST('/place-favorites', { body: favorite });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return toPlaceFavoriteView(data);
	},

	// Entfernt einen eigenen gespeicherten Ort endgültig.
	async deletePlaceFavorite({ id }: { id: number }): Promise<void> {
		const { error, response } = await client.DELETE('/place-favorites/{id}', { params: { path: { id } } });
		if (!response.ok) {
			throw new ResponseError(response, error);
		}
	},

	// --- Kalender (ICS, #2209/#2210) ---

	// Eigene Kalenderquellen (ohne ICS-Adresse).
	async listCalendarSources(init: Init = {}): Promise<CalendarSource[]> {
		const { data, error, response } = await client.GET('/calendar-sources', { signal: init.signal });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	// Verbindet eine Kalenderquelle; der Server ruft die Adresse sofort ab (400 bei Ablehnung, 403 bei Paketgrenze).
	async createCalendarSource(source: CalendarSourceInput): Promise<CalendarSource> {
		const { data, error, response } = await client.POST('/calendar-sources', { body: source });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	// Entfernt eine Kalenderquelle samt ihrer Termine.
	async deleteCalendarSource({ id }: { id: number }): Promise<void> {
		const { error, response } = await client.DELETE('/calendar-sources/{id}', { params: { path: { id } } });
		if (!response.ok) {
			throw new ResponseError(response, error);
		}
	},

	// Gespeicherte Termine aller eigenen Kalenderquellen, nach Start sortiert (`start`/`end` ISO-UTC).
	async listCalendarEvents(init: Init = {}): Promise<CalendarEvent[]> {
		const { data, error, response } = await client.GET('/calendar-events', { signal: init.signal });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	// --- Journal (#2212) ---

	// Eigene Journal-Einträge, neuestes Datum zuerst.
	async listJournalEntries(init: Init = {}): Promise<JournalEntry[]> {
		const { data, error, response } = await client.GET('/journal', { signal: init.signal });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	async createJournalEntry(entry: JournalEntryInput): Promise<JournalEntry> {
		const { data, error, response } = await client.POST('/journal', { body: entry });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	async updateJournalEntry(id: number, update: JournalEntryUpdate): Promise<JournalEntry> {
		const { data, error, response } = await client.PATCH('/journal/{id}', { params: { path: { id } }, body: update });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	async deleteJournalEntry({ id }: { id: number }): Promise<void> {
		const { error, response } = await client.DELETE('/journal/{id}', { params: { path: { id } } });
		if (!response.ok) {
			throw new ResponseError(response, error);
		}
	},

	async getJournalStats(query: { von: string; bis: string; granularitaet: 'tag' | 'woche' }): Promise<JournalStats> {
		const { data, error, response } = await client.GET('/journal/stats', { params: { query } });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	// Meldet die aktuelle Position (#1101): der Server prüft Aufgaben im Alarmabstand und pusht ggf.
	// Fire-and-forget — der Aufrufer erwartet keine Antwortdaten (204).
	async reportGeoPosition({ lat, lon, signal }: { lat: number; lon: number } & Init): Promise<void> {
		const { error, response } = await client.POST('/geo/position', { body: { lat, lon }, signal });
		if (!response.ok) {
			throw new ResponseError(response, error);
		}
	},

	// --- Profil (#1219) ---

	// Anzeigename, E-Mail und Avatar des Nutzers lesen.
	async getProfile(init: Init = {}): Promise<Profile> {
		const { data, error, response } = await client.GET('/profile', { signal: init.signal });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},

	// Speichert den Anzeigenamen; leer oder > 60 Zeichen werden serverseitig mit 400 abgelehnt.
	async updateProfile(profile: { displayName: string }, init: Init = {}): Promise<Profile> {
		const { data, error, response } = await client.PUT('/profile', { body: profile, signal: init.signal });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response, error);
		}
		return data;
	},
};

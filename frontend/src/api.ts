import { ResponseError } from 'client';
import type {
	components,
	DependencyInput,
	ParsedTask,
	paths,
	Pillar,
	PillarFeedbackInput,
	PillarSuggestion,
	PillarWeightsInput,
	Series,
	SeriesCreate,
	SeriesGenerateInput,
	SeriesUpdate,
	SuggestPillarsInput,
	Task,
	TaskCreate,
	TaskTreeNode,
	TaskUpdate,
} from 'client';
import createClient from 'openapi-fetch';

// Im Dev-Betrieb leitet der Vite-Proxy (siehe vite.config.ts) /api/v1/*-Anfragen an
// http://localhost:3000 weiter und streift das Präfix ab. In Prod übernimmt Caddy denselben
// Rewrite. Über VITE_API_BASE_URL lässt sich die Basis-URL bei Bedarf überschreiben.
const baseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';
const client = createClient<paths>({ baseUrl });

type RawTask = components['schemas']['Task'];
type RawSeries = components['schemas']['Series'];

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
 * Typsichere API-Fassade über `openapi-fetch`. Bildet die früheren Methoden des generierten
 * Clients nach (gleiche Signaturen, wirft `ResponseError` bei nicht-erfolgreichen Antworten),
 * damit die UI-Komponenten unverändert bleiben.
 */
export const api = {
	async listTasks(init: Init = {}): Promise<Task[]> {
		const { data, response } = await client.GET('/tasks', { signal: init.signal });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response);
		}
		return data.map(reviveTask);
	},

	async getForest(init: Init = {}): Promise<TaskTreeNode[]> {
		const { data, response } = await client.GET('/forest', { signal: init.signal });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response);
		}
		return data;
	},

	async getNextTask(init: Init = {}): Promise<Task | null> {
		const { data, response } = await client.GET('/next', { signal: init.signal });
		if (!response.ok) {
			throw new ResponseError(response);
		}
		return data == null ? null : reviveTask(data);
	},

	// „Was ist jetzt dran?"-Vorschlagsliste (`GET /suggestions`): nach Score sortiert, post-gefiltert.
	async getSuggestions(init: Init = {}): Promise<Task[]> {
		const { data, response } = await client.GET('/suggestions', { signal: init.signal });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response);
		}
		return data.map(reviveTask);
	},

	async createTask({ taskCreate }: { taskCreate: TaskCreate }): Promise<Task> {
		const { deadline, ...rest } = taskCreate;
		const { data, response } = await client.POST('/tasks', {
			body: { ...rest, deadline: toRawDeadline(deadline) },
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response);
		}
		return reviveTask(data);
	},

	// Schnellerfassung (#236): extrahiert aus frei formuliertem Text strukturierte Task-Felder
	// per LLM (`POST /tasks/parse-text`), die anschließend das Anlege-Formular vorausfüllen.
	async parseText({ text }: { text: string }): Promise<ParsedTask> {
		const { data, response } = await client.POST('/tasks/parse-text', { body: { text } });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response);
		}
		return data;
	},

	async updateTask({ id, taskUpdate }: { id: number; taskUpdate: TaskUpdate }): Promise<Task> {
		const { deadline, ...rest } = taskUpdate;
		const { data, response } = await client.PATCH('/tasks/{id}', {
			params: { path: { id } },
			body: { ...rest, deadline: toRawDeadline(deadline) },
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response);
		}
		return reviveTask(data);
	},

	async deleteTask({ id }: { id: number }): Promise<void> {
		const { response } = await client.DELETE('/tasks/{id}', { params: { path: { id } } });
		if (!response.ok) {
			throw new ResponseError(response);
		}
	},

	async addDependency({ id, dependencyInput }: { id: number; dependencyInput: DependencyInput }): Promise<Task> {
		const { data, response } = await client.POST('/tasks/{id}/dependencies', {
			params: { path: { id } },
			body: dependencyInput,
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response);
		}
		return reviveTask(data);
	},

	async removeDependency({ id, depId }: { id: number; depId: number }): Promise<void> {
		const { response } = await client.DELETE('/tasks/{id}/dependencies/{depId}', {
			params: { path: { id, depId } },
		});
		if (!response.ok) {
			throw new ResponseError(response);
		}
	},

	async listPillars(init: Init = {}): Promise<Pillar[]> {
		const { data, response } = await client.GET('/pillars', { signal: init.signal });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response);
		}
		return data;
	},

	async setPillarWeights({ pillarWeightsInput }: { pillarWeightsInput: PillarWeightsInput }): Promise<Pillar[]> {
		const { data, response } = await client.PUT('/pillars/weights', { body: pillarWeightsInput });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response);
		}
		return data;
	},

	async suggestPillars({
		suggestPillarsInput,
		signal,
	}: { suggestPillarsInput: SuggestPillarsInput } & Init): Promise<PillarSuggestion[]> {
		const { data, response } = await client.POST('/tasks/suggest-pillars', { body: suggestPillarsInput, signal });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response);
		}
		return data.suggestions;
	},

	// Speichert eine vom Nutzer bestätigte/korrigierte Säulen-Zuordnung als Lern-Sample für
	// nachfolgende Vorschläge (Feedback-Loop, #45). Best-Effort: Fehler werden vom Aufrufer
	// bewusst geschluckt, da das Feedback ein Nice-to-have ist und das Speichern nicht blockieren darf.
	async recordPillarFeedback({
		pillarFeedbackInput,
		signal,
	}: { pillarFeedbackInput: PillarFeedbackInput } & Init): Promise<void> {
		const { response } = await client.POST('/tasks/suggest-pillars/feedback', { body: pillarFeedbackInput, signal });
		if (!response.ok) {
			throw new ResponseError(response);
		}
	},

	// --- Serien-Templates (#120/#142) ---

	async listSeries(init: Init = {}): Promise<Series[]> {
		const { data, response } = await client.GET('/series', { signal: init.signal });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response);
		}
		return data.map(reviveSeries);
	},

	async getSeries({ id }: { id: number }): Promise<Series> {
		const { data, response } = await client.GET('/series/{id}', { params: { path: { id } } });
		if (!response.ok || data === undefined) {
			throw new ResponseError(response);
		}
		return reviveSeries(data);
	},

	async createSeries({ seriesCreate }: { seriesCreate: SeriesCreate }): Promise<Series> {
		const { startDate, ...rest } = seriesCreate;
		const { data, response } = await client.POST('/series', {
			body: { ...rest, startDate: startDate.toISOString() },
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response);
		}
		return reviveSeries(data);
	},

	async updateSeries({ id, seriesUpdate }: { id: number; seriesUpdate: SeriesUpdate }): Promise<Series> {
		const { startDate, ...rest } = seriesUpdate;
		const { data, response } = await client.PATCH('/series/{id}', {
			params: { path: { id } },
			body: startDate === undefined ? rest : { ...rest, startDate: startDate.toISOString() },
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response);
		}
		return reviveSeries(data);
	},

	async deleteSeries({ id }: { id: number }): Promise<void> {
		const { response } = await client.DELETE('/series/{id}', { params: { path: { id } } });
		if (!response.ok) {
			throw new ResponseError(response);
		}
	},

	// Zerstört die serverseitige Session. Die Frontend-Aufräumarbeit (localStorage, Redirect) erledigt
	// der Aufrufer. Eigener fetch statt openapi-fetch, da /auth/* nicht in der OpenAPI-Spec steht —
	// aber wie alle anderen Endpunkte unter dem proxied `/api/v1`-Präfix (s. checkAuth() in lib/auth.ts).
	async logout(): Promise<void> {
		const response = await fetch('/api/v1/auth/logout', { method: 'POST' });
		if (!response.ok) {
			throw new Error(`Logout fehlgeschlagen (${response.status})`);
		}
	},

	// Materialisiert die bis `until` (inklusive) fälligen Instanzen einer Serie als eigenständige Tasks.
	async generateSeriesInstances({
		id,
		seriesGenerateInput,
	}: {
		id: number;
		seriesGenerateInput: SeriesGenerateInput;
	}): Promise<Task[]> {
		const { data, response } = await client.POST('/series/{id}/generate', {
			params: { path: { id } },
			body: { until: seriesGenerateInput.until.toISOString() },
		});
		if (!response.ok || data === undefined) {
			throw new ResponseError(response);
		}
		return data.map(reviveTask);
	},
};

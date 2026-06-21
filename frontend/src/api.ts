import { ResponseError } from 'client';
import type {
	components,
	DependencyInput,
	paths,
	Pillar,
	PillarSuggestion,
	PillarWeightsInput,
	SuggestPillarsInput,
	Task,
	TaskCreate,
	TaskTreeNode,
	TaskUpdate,
} from 'client';
import createClient from 'openapi-fetch';

// Im Dev-Betrieb leitet der Vite-Proxy (siehe vite.config.ts) die API-Pfade an
// http://localhost:3000 weiter, daher als Basis-URL standardmäßig same-origin ('').
// Über VITE_API_BASE_URL lässt sich die API-URL bei Bedarf (z. B. für Builds) überschreiben.
const baseUrl = import.meta.env.VITE_API_BASE_URL ?? '';
const client = createClient<paths>({ baseUrl });

type RawTask = components['schemas']['Task'];

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
};

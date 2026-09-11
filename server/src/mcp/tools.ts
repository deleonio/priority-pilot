/**
 * Werkzeugkatalog v1 des MCP-Servers (#1353).
 *
 * Die Werkzeuge **spiegeln** die vorhandenen HTTP-Routen, statt deren Fachlogik ein zweites Mal zu
 * bauen: jeder Aufruf geht als Loopback-Request mit demselben `Authorization: Bearer …`-Header
 * gegen den eigenen Server. Damit gelten Validierung, Eigentümer-Filter (`ownerScope`),
 * Unteraufgaben-Guard, Score-Vergabe und Push-Versand unverändert — es gibt keinen zweiten
 * Fachlogik- oder Auth-Pfad (AK3, AK6). Der Katalog ist ab dem Merge eingefroren (AK8) und enthält
 * bewusst kein Admin-Werkzeug (AK7, Admin-Werkzeuge gehören nach #1338).
 */

/** Aufrufkontext eines Werkzeugs: Basis-URL des eigenen Servers + Bearer-Token des Aufrufers. */
export interface McpToolContext {
	/** z. B. `http://127.0.0.1:3000` — feste Loopback-Adresse mit dem Port, auf dem der Prozess lauscht. */
	baseUrl: string;
	/** Der `Authorization`-Header des MCP-Requests; wird unverändert weitergereicht. */
	authorization: string;
}

/** JSON-Schema eines Werkzeug-Eingangs (Teilmenge, die MCP-Clients auswerten). */
interface McpInputSchema {
	type: 'object';
	properties: Record<string, { type: string; description: string }>;
	required?: string[];
}

export interface McpTool {
	name: string;
	description: string;
	inputSchema: McpInputSchema;
	/**
	 * Gesetzt, wenn das Werkzeug Daten verändert (#1356). Der JSON-RPC-Rahmen weist einen solchen
	 * Aufruf mit einem Nur-lese-Token ab, bevor der Loopback überhaupt losgeht — so bekommt der
	 * Client einen lesbaren JSON-RPC-Fehler statt einer nackten HTTP-403 aus der Tiefe der Kette.
	 */
	write?: true;
	/** Führt das Werkzeug aus; wirft bei einem Fehler der gespiegelten Route. */
	run: (ctx: McpToolContext, args: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Loopback-Aufruf gegen die eigene HTTP-API. Ein Fehlerstatus der Route (404 bei fremder Aufgabe,
 * 400 bei ungültiger Eingabe …) wird zu einer Exception, die der JSON-RPC-Rahmen in ein
 * `error`-Objekt übersetzt — die gespiegelte Route bleibt die einzige Entscheidungsinstanz.
 */
const callApi = async (
	ctx: McpToolContext,
	path: string,
	init: { method?: string; body?: unknown } = {},
): Promise<unknown> => {
	const res = await fetch(`${ctx.baseUrl}${path}`, {
		method: init.method ?? 'GET',
		headers: {
			Authorization: ctx.authorization,
			...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
		},
		body: init.body === undefined ? undefined : JSON.stringify(init.body),
	});
	const text = await res.text();
	const payload: unknown = text === '' ? null : JSON.parse(text);
	if (!res.ok) {
		const message = (payload as { error?: string } | null)?.error ?? `Anfrage fehlgeschlagen (${res.status}).`;
		throw new Error(message);
	}
	return payload;
};

/** Ganzzahlige Pflicht-ID aus den Werkzeug-Argumenten. */
const requireId = (args: Record<string, unknown>): number => {
	const id = args.id;
	if (typeof id !== 'number' || !Number.isInteger(id)) {
		throw new Error('id muss eine Ganzzahl sein.');
	}
	return id;
};

/** Nur die gesetzten Felder übernehmen — die Route unterscheidet „fehlt" von „null". */
const pickTaskFields = (args: Record<string, unknown>): Record<string, unknown> => {
	const fields: Record<string, unknown> = {};
	for (const key of ['title', 'description', 'priority', 'estimatedEffort', 'deadline', 'categoryId', 'status']) {
		if (args[key] !== undefined) {
			fields[key] = args[key];
		}
	}
	return fields;
};

/**
 * Löst einen Aufgaben-Bezug zu einer ID auf. Die ID hat Vorrang; sonst wird der Titel gegen die
 * eigenen Aufgaben gematcht, erst wortgleich und dann als Teilstring. Bei keinem oder mehreren
 * Treffern bricht der Aufruf mit der Trefferliste ab, statt eine Aufgabe zu wählen: eine still
 * falsch gesetzte Kante fällt sonst erst auf, wenn der Graph längst schief steht.
 */
const resolveTaskRef = async (
	ctx: McpToolContext,
	args: Record<string, unknown>,
	idKey: string,
	titleKey: string,
): Promise<number> => {
	const id = args[idKey];
	if (id !== undefined) {
		if (typeof id !== 'number' || !Number.isInteger(id) || id < 1) {
			throw new Error(`${idKey} muss eine Ganzzahl >= 1 sein.`);
		}
		return id;
	}
	const title = args[titleKey];
	if (typeof title !== 'string' || title.trim() === '') {
		throw new Error(`Entweder ${idKey} oder ${titleKey} muss gesetzt sein.`);
	}
	const needle = title.trim().toLowerCase();
	const tasks = (await callApi(ctx, '/tasks')) as { id: number; title: string }[];
	const exact = tasks.filter((task) => task.title.toLowerCase() === needle);
	const matches = exact.length > 0 ? exact : tasks.filter((task) => task.title.toLowerCase().includes(needle));
	if (matches.length === 0) {
		throw new Error(`Keine Aufgabe mit dem Titel „${title}" gefunden.`);
	}
	if (matches.length > 1) {
		const list = matches.map((task) => `${task.id}: ${task.title}`).join(', ');
		throw new Error(`Mehrere Aufgaben passen auf „${title}" (${list}). Bitte die ID angeben.`);
	}
	return matches[0].id;
};

/** Kantengewicht aus den Argumenten; ohne Angabe der Standardwert der Route. */
const readWeight = (value: unknown): number => {
	if (value === undefined) {
		return 1;
	}
	if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
		throw new Error('weight muss eine endliche Zahl >= 0 sein.');
	}
	return value;
};

/** Beide Enden einer Verknüpfung, je über ID oder Titel angebbar. */
const linkProperties = {
	taskId: { type: 'integer', description: 'ID der übergeordneten Aufgabe (Alternative zu taskTitle).' },
	taskTitle: { type: 'string', description: 'Titel der übergeordneten Aufgabe (Alternative zu taskId).' },
	dependsOnId: { type: 'integer', description: 'ID der Vorgänger-Aufgabe (Alternative zu dependsOnTitle).' },
	dependsOnTitle: { type: 'string', description: 'Titel der Vorgänger-Aufgabe (Alternative zu dependsOnId).' },
} as const;

const taskFieldProperties = {
	title: { type: 'string', description: 'Titel der Aufgabe.' },
	description: { type: 'string', description: 'Beschreibung der Aufgabe.' },
	priority: { type: 'integer', description: 'Priorität (1–5).' },
	estimatedEffort: { type: 'integer', description: 'Geschätzter Aufwand in Stunden.' },
	deadline: { type: 'string', description: 'Fälligkeit als ISO-8601-Zeitpunkt.' },
	categoryId: { type: 'integer', description: 'ID einer eigenen Kategorie.' },
} as const;

/**
 * Der eingefrorene v1-Katalog. Reihenfolge = Reihenfolge in `tools/list`; der Snapshot-Test
 * (`tools.test.ts`, AK8) sortiert selbst.
 */
export const mcpTools: McpTool[] = [
	{
		name: 'task_list',
		description: 'Listet die Aufgaben des Token-Besitzers.',
		inputSchema: { type: 'object', properties: {} },
		run: (ctx) => callApi(ctx, '/tasks'),
	},
	{
		name: 'task_create',
		description: 'Legt eine neue Aufgabe für den Token-Besitzer an.',
		write: true,
		inputSchema: {
			type: 'object',
			properties: { ...taskFieldProperties },
			required: ['title'],
		},
		run: (ctx, args) => callApi(ctx, '/tasks', { method: 'POST', body: pickTaskFields(args) }),
	},
	{
		name: 'task_update',
		description: 'Ändert Felder einer eigenen Aufgabe.',
		write: true,
		inputSchema: {
			type: 'object',
			properties: {
				id: { type: 'integer', description: 'ID der zu ändernden Aufgabe.' },
				...taskFieldProperties,
			},
			required: ['id'],
		},
		run: (ctx, args) => callApi(ctx, `/tasks/${requireId(args)}`, { method: 'PATCH', body: pickTaskFields(args) }),
	},
	{
		name: 'task_complete',
		description: 'Setzt eine eigene Aufgabe auf erledigt.',
		write: true,
		inputSchema: {
			type: 'object',
			properties: { id: { type: 'integer', description: 'ID der zu erledigenden Aufgabe.' } },
			required: ['id'],
		},
		run: (ctx, args) => callApi(ctx, `/tasks/${requireId(args)}`, { method: 'PATCH', body: { status: 'Done' } }),
	},
	{
		name: 'task_link',
		description:
			'Verknüpft eine Aufgabe mit einer Vorgänger-Aufgabe (Unteraufgabe) und setzt das Gewicht der Kante. ' +
			'Besteht die Verknüpfung schon, ändert der Aufruf nur ihr Gewicht. Beide Enden sind über ID oder Titel angebbar.',
		write: true,
		inputSchema: {
			type: 'object',
			properties: {
				...linkProperties,
				weight: { type: 'number', description: 'Gewicht der Verknüpfung, Zahl >= 0. Ohne Angabe 1.' },
			},
		},
		run: async (ctx, args) => {
			// Gewicht vor der Auflösung prüfen: ein ungültiger Wert kostet sonst zwei Titel-Abfragen.
			const weight = readWeight(args.weight);
			const taskId = await resolveTaskRef(ctx, args, 'taskId', 'taskTitle');
			const dependsOnId = await resolveTaskRef(ctx, args, 'dependsOnId', 'dependsOnTitle');
			return callApi(ctx, `/tasks/${taskId}/dependencies`, {
				method: 'POST',
				body: { dependingTaskId: dependsOnId, weight },
			});
		},
	},
	{
		name: 'task_unlink',
		description:
			'Löst die Verknüpfung zwischen einer Aufgabe und einer ihrer Vorgänger-Aufgaben. ' +
			'Beide Enden sind über ID oder Titel angebbar.',
		write: true,
		inputSchema: { type: 'object', properties: { ...linkProperties } },
		run: async (ctx, args) => {
			const taskId = await resolveTaskRef(ctx, args, 'taskId', 'taskTitle');
			const dependsOnId = await resolveTaskRef(ctx, args, 'dependsOnId', 'dependsOnTitle');
			return callApi(ctx, `/tasks/${taskId}/dependencies/${dependsOnId}`, { method: 'DELETE' });
		},
	},
	{
		name: 'task_links',
		description:
			'Listet die Verknüpfungen einer Aufgabe: ihre Vorgänger (Unteraufgaben) und die Aufgaben, die auf ihr ' +
			'aufbauen, je mit Gewicht. Erledigte Aufgaben fehlen, weil der gespiegelte Graph nur offene Aufgaben führt.',
		inputSchema: {
			type: 'object',
			properties: { taskId: linkProperties.taskId, taskTitle: linkProperties.taskTitle },
		},
		run: async (ctx, args) => {
			const taskId = await resolveTaskRef(ctx, args, 'taskId', 'taskTitle');
			const graph = (await callApi(ctx, '/graph')) as {
				nodes: { id: number; title: string }[];
				edges: { from: number; to: number; weight: number }[];
			};
			const titleById = new Map(graph.nodes.map((node) => [node.id, node.title]));
			if (!titleById.has(taskId)) {
				throw new Error('Aufgabe nicht gefunden oder bereits erledigt.');
			}
			const neighbor = (id: number, weight: number) => ({ id, title: titleById.get(id), weight });
			return {
				id: taskId,
				title: titleById.get(taskId),
				// Kantenrichtung laut logics/graph.ts: `from` ist der Vorgänger, `to` die übergeordnete Aufgabe.
				dependsOn: graph.edges.filter((edge) => edge.to === taskId).map((edge) => neighbor(edge.from, edge.weight)),
				requiredBy: graph.edges.filter((edge) => edge.from === taskId).map((edge) => neighbor(edge.to, edge.weight)),
			};
		},
	},
	{
		name: 'next_task',
		description: 'Liefert die nächste wichtige Aufgabe des Token-Besitzers oder null.',
		inputSchema: { type: 'object', properties: {} },
		run: (ctx) => callApi(ctx, '/next'),
	},
	{
		name: 'pillar_list',
		description: 'Listet die Säulen des Token-Besitzers samt Gewichtung.',
		inputSchema: { type: 'object', properties: {} },
		run: (ctx) => callApi(ctx, '/pillars'),
	},
	{
		name: 'category_list',
		description: 'Listet die Kategorien des Token-Besitzers.',
		inputSchema: { type: 'object', properties: {} },
		run: (ctx) => callApi(ctx, '/categories'),
	},
];

export const findMcpTool = (name: unknown): McpTool | undefined => mcpTools.find((tool) => tool.name === name);

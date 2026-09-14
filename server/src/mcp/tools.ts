/**
 * Werkzeugkatalog des MCP-Servers (#1353) — seit #1381/#1396/#1400/#1423 vierzehn Werkzeuge.
 *
 * Die Werkzeuge **spiegeln** die vorhandenen HTTP-Routen, statt deren Fachlogik ein zweites Mal zu
 * bauen: jeder Aufruf geht als Loopback-Request mit demselben `Authorization: Bearer …`-Header
 * gegen den eigenen Server. Damit gelten Validierung, Eigentümer-Filter (`ownerScope`),
 * Unteraufgaben-Guard, Score-Vergabe und Push-Versand unverändert — es gibt keinen zweiten
 * Fachlogik- oder Auth-Pfad (AK3, AK6). Eingefroren (AK8) sind Namen + Schemas; der Katalog wurde
 * nach dem v1-Merge erweitert. Er enthält bewusst kein Admin-Werkzeug (AK7, Admin-Werkzeuge gehören
 * nach #1338). Tool-Descriptions und Fehlermeldungen sind seit #1370 englisch — die Sprache der
 * LLM-Clients, während die Weboberfläche und die durchgereichten Route-Fehlertexte deutsch bleiben.
 */

/** Aufrufkontext eines Werkzeugs: Basis-URL des eigenen Servers + Bearer-Token des Aufrufers. */
export interface McpToolContext {
	/** z. B. `http://127.0.0.1:3000` — feste Loopback-Adresse mit dem Port, auf dem der Prozess lauscht. */
	baseUrl: string;
	/** Der `Authorization`-Header des MCP-Requests; wird unverändert weitergereicht. */
	authorization: string;
}

/** JSON-Schema-Eigenschaft eines Werkzeug-Eingangs (Teilmenge, die MCP-Clients auswerten). */
interface McpPropertySchema {
	type: string;
	description: string;
	/** Nur bei `type: 'array'` gesetzt: Objektschema der Array-Einträge. */
	items?: { type: 'object'; properties: Record<string, { type: string; description: string }> };
}

/** JSON-Schema eines Werkzeug-Eingangs (Teilmenge, die MCP-Clients auswerten). */
interface McpInputSchema {
	type: 'object';
	properties: Record<string, McpPropertySchema>;
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
 * Antwortkörper der gespiegelten Route lesen. Ist er kein JSON, hat nicht die Route geantwortet,
 * sondern etwas davor (Reverse Proxy, Express-Default-Handler mit HTML-Fehlerseite) — dann sagt
 * der Anfang des Texts, wer es war. Ein durchschlagender `SyntaxError` meldete dem Client
 * stattdessen nur „Unexpected token <".
 */
const parseJsonBody = (text: string, status: number): unknown => {
	if (text === '') {
		return null;
	}
	try {
		return JSON.parse(text);
	} catch {
		throw new Error(`Unexpected response (HTTP ${status}): ${text.slice(0, 200)}`);
	}
};

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
	const payload = parseJsonBody(text, res.status);
	if (!res.ok) {
		// Der zentrale Fehlervertrag (express/http-error.ts) sendet `{ message }` — genau diesen Text
		// braucht der Client, um zu wissen, WELCHES Feld ihm um die Ohren flog. Der Statuscode reist
		// immer mit: er ordnet ein, ob die Eingabe (4xx) oder der Server (5xx) schuld ist. Der Text
		// selbst ist der der gespiegelten Route (deutsch, geteilt mit der Weboberfläche).
		const message = (payload as { message?: string } | null)?.message ?? 'Request failed.';
		throw new Error(`${message} (HTTP ${res.status})`);
	}
	return payload;
};

/**
 * Ganzzahlige Pflicht-ID aus den Werkzeug-Argumenten. Der Schlüsselname steht im Fehlertext, damit
 * ein Aufruf mit mehreren IDs (`task_link`) sagt, welche davon fehlt. Werkzeugunabhängig — der
 * Fehlertext nennt nur den Schlüssel, keine Herkunft (die IDs von `task_link`/`group_members_list`
 * kommen aus verschiedenen List-Werkzeugen).
 */
const requireIntegerId = (args: Record<string, unknown>, key: string): number => {
	const id = args[key];
	if (typeof id !== 'number' || !Number.isInteger(id) || id < 1) {
		throw new Error(`${key} must be an integer >= 1.`);
	}
	return id;
};

/**
 * Umrechnungsfaktor des Aufwandsfelds: `estimatedEffort` zählt in **Tagen** zu je 14 h regulärer
 * Wachzeit und läuft von 0.1 bis 1 (openapi.yml, Schema `Task.estimatedEffort`).
 */
const HOURS_PER_EFFORT_DAY = 14;
const MIN_EFFORT = 0.1;
const MAX_EFFORT = 1;

/**
 * Rechnet eine Stundenschätzung in das Tage-Feld der API um. Das Kappen an den Rändern ist kein
 * Informationsverlust, sondern die Auflösung der Skala selbst: das Feld beginnt bei 0.1 Tagen
 * (~1,4 h) und endet bei einem Tag. Auf zwei Nachkommastellen gerundet (≙ ~8 min), damit in der
 * Aufwands-Spalte der Oberfläche keine 17-stellige Division steht.
 */
const effortFromHours = (hours: unknown): number => {
	if (typeof hours !== 'number' || !Number.isFinite(hours) || hours <= 0) {
		throw new Error('estimatedEffortHours must be a finite number > 0.');
	}
	const days = Math.round((hours / HOURS_PER_EFFORT_DAY) * 100) / 100;
	return Math.min(MAX_EFFORT, Math.max(MIN_EFFORT, days));
};

/** Nur die gesetzten Felder übernehmen — die Route unterscheidet „fehlt" von „null". */
const pickTaskFields = (args: Record<string, unknown>): Record<string, unknown> => {
	const fields: Record<string, unknown> = {};
	for (const key of [
		'title',
		'description',
		'priority',
		'estimatedEffort',
		'deadline',
		'categoryId',
		'status',
		'pillars',
		'autoDeleteAfterDeadline',
	]) {
		if (args[key] !== undefined) {
			fields[key] = args[key];
		}
	}
	if (args.estimatedEffortHours !== undefined) {
		// Beide Angaben zusammen sind ein Widerspruch, kein Komfort: raten hieße, den Aufwand still
		// falsch zu speichern.
		if (args.estimatedEffort !== undefined) {
			throw new Error('estimatedEffort and estimatedEffortHours are mutually exclusive — provide only one.');
		}
		fields.estimatedEffort = effortFromHours(args.estimatedEffortHours);
	}
	return fields;
};

/** Kantengewicht aus den Argumenten; ohne Angabe der Standardwert der Route. */
const readWeight = (value: unknown): number => {
	if (value === undefined) {
		return 1;
	}
	if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
		throw new Error('weight must be a finite number >= 0.');
	}
	return value;
};

/**
 * Beide Enden einer Verknüpfung — ausschließlich über die numerische ID. Eine Auflösung über den
 * Titel gab es einmal; sie ist zurückgebaut, weil sie je Ende einen zusätzlichen Loopback-Aufruf
 * kostete und bei mehrdeutigen Titeln ohnehin abbrach. Die IDs holt sich der Client vorher über
 * `task_list`.
 */
const linkProperties = {
	taskId: { type: 'integer', description: 'ID of the parent task (from task_list).' },
	dependsOnId: { type: 'integer', description: 'ID of the predecessor task/subtask (from task_list).' },
} as const;

const taskFieldProperties = {
	title: { type: 'string', description: 'Title of the task.' },
	description: { type: 'string', description: 'Description of the task.' },
	priority: { type: 'integer', description: 'Priority: integer 1 (lowest) to 5 (highest), default 3.' },
	estimatedEffort: {
		type: 'number',
		description:
			'Estimated own effort in DAYS: number between 0.1 and 1, default 0.5 (one day equals 14 h of ' +
			'regular waking time). If you think in hours, use estimatedEffortHours instead.',
	},
	estimatedEffortHours: {
		type: 'number',
		description:
			'Estimated own effort in hours; converted to the days field (hours / 14) and clamped to 0.1-1 ' +
			'days at the edges of the scale. Alternative to estimatedEffort.',
	},
	deadline: { type: 'string', description: 'Due date as ISO-8601 timestamp.' },
	categoryId: { type: 'integer', description: 'ID of one of your own categories.' },
	pillars: {
		type: 'array',
		description:
			'Pillar assignment of the task: list of { pillarId, share, confidence? }. The share values of all ' +
			'entries must add up to 100, confidence is between 0 and 100 (default 100). On task_update this ' +
			'field fully replaces the existing assignment; pillars: [] removes it, if the field is missing ' +
			'the assignment stays unchanged. pillarId comes from pillar_list.',
		items: {
			type: 'object',
			properties: {
				pillarId: { type: 'integer', description: 'ID of one of your own pillars (from pillar_list).' },
				share: { type: 'number', description: 'Share in percent; the sum over all entries must be 100.' },
				confidence: { type: 'number', description: 'Confidence 0-100 in this contribution. Defaults to 100.' },
			},
		},
	},
	autoDeleteAfterDeadline: {
		type: 'boolean',
		description:
			'If true, the task is deleted automatically once its deadline has been overdue for 3 days. ' +
			'Requires a set deadline; without one the auto-delete job has nothing to act on.',
	},
} as const;

/**
 * Der Katalog. Reihenfolge = Reihenfolge in `tools/list`; der Snapshot-Test (`tools.test.ts`, AK8)
 * sortiert selbst.
 */
export const mcpTools: McpTool[] = [
	{
		name: 'task_list',
		description:
			"Lists the token owner's tasks including their IDs. These IDs identify a task in all other " +
			'tools (task_update, task_complete, task_link, task_unlink, task_links).',
		inputSchema: { type: 'object', properties: {} },
		run: (ctx) => callApi(ctx, '/tasks'),
	},
	{
		name: 'task_create',
		description: 'Creates a new task for the token owner.',
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
		description: 'Changes fields of one of your own tasks.',
		write: true,
		inputSchema: {
			type: 'object',
			properties: {
				id: { type: 'integer', description: 'ID of the task to change (from task_list).' },
				...taskFieldProperties,
				status: { type: 'string', description: 'Status: "Open", "In process" or "Done".' },
			},
			required: ['id'],
		},
		run: (ctx, args) =>
			callApi(ctx, `/tasks/${requireIntegerId(args, 'id')}`, { method: 'PATCH', body: pickTaskFields(args) }),
	},
	{
		name: 'task_complete',
		description: 'Marks one of your own tasks as done.',
		write: true,
		inputSchema: {
			type: 'object',
			properties: { id: { type: 'integer', description: 'ID of the task to complete (from task_list).' } },
			required: ['id'],
		},
		run: (ctx, args) =>
			callApi(ctx, `/tasks/${requireIntegerId(args, 'id')}`, { method: 'PATCH', body: { status: 'Done' } }),
	},
	{
		name: 'task_delete',
		description:
			'Permanently and irreversibly deletes one of your own tasks. Unlike task_complete the task is ' +
			'not kept afterwards — to just finish a task, use task_complete instead.',
		write: true,
		inputSchema: {
			type: 'object',
			properties: { id: { type: 'integer', description: 'ID of the task to delete (from task_list).' } },
			required: ['id'],
		},
		run: (ctx, args) => callApi(ctx, `/tasks/${requireIntegerId(args, 'id')}`, { method: 'DELETE' }),
	},
	{
		name: 'task_link',
		description:
			'Links a task to a predecessor task (subtask) and sets the weight of the edge. If the link ' +
			'already exists, the call only updates its weight. Both ends are given by their numeric ID — ' +
			'task_list provides the IDs, so look there first.',
		write: true,
		inputSchema: {
			type: 'object',
			properties: {
				...linkProperties,
				weight: { type: 'number', description: 'Weight of the link, number >= 0. Defaults to 1.' },
			},
			required: ['taskId', 'dependsOnId'],
		},
		run: (ctx, args) => {
			const weight = readWeight(args.weight);
			const taskId = requireIntegerId(args, 'taskId');
			const dependsOnId = requireIntegerId(args, 'dependsOnId');
			return callApi(ctx, `/tasks/${taskId}/dependencies`, {
				method: 'POST',
				body: { dependingTaskId: dependsOnId, weight },
			});
		},
	},
	{
		name: 'task_unlink',
		description:
			'Removes the link between a task and one of its predecessor tasks. ' +
			'Both ends are given by their numeric ID — task_list provides the IDs.',
		write: true,
		inputSchema: { type: 'object', properties: { ...linkProperties }, required: ['taskId', 'dependsOnId'] },
		run: (ctx, args) => {
			const taskId = requireIntegerId(args, 'taskId');
			const dependsOnId = requireIntegerId(args, 'dependsOnId');
			return callApi(ctx, `/tasks/${taskId}/dependencies/${dependsOnId}`, { method: 'DELETE' });
		},
	},
	{
		name: 'task_links',
		description:
			'Lists the links of a task: its predecessors (subtasks) and the tasks building on it, each with ' +
			'weight. The task is given by its numeric ID (from task_list). Done tasks are missing because ' +
			'the mirrored graph only tracks open tasks.',
		inputSchema: {
			type: 'object',
			properties: { taskId: linkProperties.taskId },
			required: ['taskId'],
		},
		run: async (ctx, args) => {
			const taskId = requireIntegerId(args, 'taskId');
			const graph = (await callApi(ctx, '/graph')) as {
				nodes: { id: number; title: string }[];
				edges: { from: number; to: number; weight: number }[];
			};
			const titleById = new Map(graph.nodes.map((node) => [node.id, node.title]));
			if (!titleById.has(taskId)) {
				throw new Error('Task not found or already done.');
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
		description: "Returns the token owner's next important task, or null.",
		inputSchema: { type: 'object', properties: {} },
		run: (ctx) => callApi(ctx, '/next'),
	},
	{
		name: 'pillar_list',
		description: "Lists the token owner's pillars including their weighting.",
		inputSchema: { type: 'object', properties: {} },
		run: (ctx) => callApi(ctx, '/pillars'),
	},
	{
		name: 'balance_status',
		description:
			"Returns the token owner's current life-balance status in one call: the overall fill level of " +
			'the dashboard heart in percent, each pillar with its score and weighting, the completion streak ' +
			'(current and best) and the milestones reached so far.',
		inputSchema: {
			type: 'object',
			properties: {
				timezone: {
					type: 'string',
					description:
						'IANA time zone (e.g. "Europe/Berlin") deciding where the calendar day of the streak ends. ' +
						'Omitted or unknown values fall back to the server time zone instead of failing.',
				},
			},
		},
		run: (ctx, args) => {
			const timezone = args.timezone;
			// Ungültige Werte reicht das Werkzeug durch: die Route behandelt sie wie „nicht angegeben"
			// (Fallback Serverzeit) — ein eigener Vorab-Check wäre ein zweiter Validierungspfad.
			const query = typeof timezone === 'string' && timezone !== '' ? `?tz=${encodeURIComponent(timezone)}` : '';
			return callApi(ctx, `/scores/balance${query}`);
		},
	},
	{
		name: 'category_list',
		description: "Lists the token owner's categories.",
		inputSchema: { type: 'object', properties: {} },
		run: (ctx) => callApi(ctx, '/categories'),
	},
	{
		name: 'group_list',
		description: 'Lists the groups the token owner is a member of, including role and member count.',
		inputSchema: { type: 'object', properties: {} },
		run: (ctx) => callApi(ctx, '/groups'),
	},
	{
		name: 'group_members_list',
		description: 'Lists the members of one of your own groups. Foreign groups return an error instead of data.',
		inputSchema: {
			type: 'object',
			properties: { groupId: { type: 'integer', description: 'ID of the group (from group_list).' } },
			required: ['groupId'],
		},
		run: (ctx, args) => callApi(ctx, `/groups/${requireIntegerId(args, 'groupId')}/members`),
	},
];

export const findMcpTool = (name: unknown): McpTool | undefined => mcpTools.find((tool) => tool.name === name);

import { Router, type Request, type Response } from 'express';
import { findMcpTool, mcpTools, type McpToolContext } from './tools.js';

/**
 * MCP-Endpunkt v1 (#1353): JSON-RPC 2.0 über HTTP unter `POST /mcp/v1`.
 *
 * Der Router wird HINTER `requireAuth` montiert (`express/index.ts`). Damit erledigt die
 * vorhandene Kette die Authentifizierung vollständig: `apiTokenAuth` (#1352) prüft
 * `Authorization: Bearer …` gegen `ApiToken` und befüllt die Session, `requireAuth` weist ohne
 * gültige Session mit 401 ab (AK2). Der Endpunkt selbst kennt keinen eigenen Auth-Pfad.
 *
 * Unterstützte Methoden: `initialize`, `tools/list`, `tools/call` (plus stille Quittung für
 * Notifications ohne `id`). Der Body ist bereits von `express.json()` geparst.
 */

/** Protokollversion, die der Server beim `initialize` meldet. */
const PROTOCOL_VERSION = '2025-06-18';

const JSONRPC_INVALID_REQUEST = -32600;
const JSONRPC_METHOD_NOT_FOUND = -32601;
const JSONRPC_INVALID_PARAMS = -32602;
const JSONRPC_INTERNAL_ERROR = -32603;

interface JsonRpcRequest {
	jsonrpc?: unknown;
	id?: string | number | null;
	method?: unknown;
	params?: unknown;
}

const sendResult = (res: Response, id: string | number | null, result: unknown): void => {
	res.json({ jsonrpc: '2.0', id, result });
};

const sendRpcError = (res: Response, id: string | number | null, code: number, message: string): void => {
	res.json({ jsonrpc: '2.0', id, error: { code, message } });
};

export const mcpRouter: Router = Router();

mcpRouter.post('/mcp/v1', async (req: Request, res: Response) => {
	const body = (req.body ?? {}) as JsonRpcRequest;
	const id = body.id ?? null;
	if (body.jsonrpc !== '2.0' || typeof body.method !== 'string') {
		sendRpcError(res, id, JSONRPC_INVALID_REQUEST, 'Ungültiger JSON-RPC-Request.');
		return;
	}
	// Notification (kein `id`): der Client erwartet keine Antwort — nur quittieren.
	if (body.id === undefined) {
		res.status(202).end();
		return;
	}

	if (body.method === 'initialize') {
		sendResult(res, id, {
			protocolVersion: PROTOCOL_VERSION,
			capabilities: { tools: {} },
			serverInfo: { name: 'priority-pilot-mcp-v1', version: '1' },
		});
		return;
	}

	if (body.method === 'tools/list') {
		sendResult(res, id, {
			tools: mcpTools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
		});
		return;
	}

	if (body.method !== 'tools/call') {
		sendRpcError(res, id, JSONRPC_METHOD_NOT_FOUND, `Unbekannte Methode: ${body.method}`);
		return;
	}

	const params = (body.params ?? {}) as { name?: unknown; arguments?: unknown };
	const tool = findMcpTool(params.name);
	if (!tool) {
		sendRpcError(res, id, JSONRPC_INVALID_PARAMS, `Unbekanntes Werkzeug: ${String(params.name)}`);
		return;
	}
	const args = (typeof params.arguments === 'object' && params.arguments !== null ? params.arguments : {}) as Record<
		string,
		unknown
	>;
	// Loopback-Ziel des Werkzeugs: derselbe Server, derselbe Bearer-Token (siehe tools.ts).
	const context: McpToolContext = {
		baseUrl: `${req.protocol}://${req.get('host') ?? 'localhost'}`,
		authorization: req.get('authorization') ?? '',
	};
	try {
		sendResult(res, id, await tool.run(context, args));
	} catch (error) {
		sendRpcError(
			res,
			id,
			JSONRPC_INTERNAL_ERROR,
			error instanceof Error ? error.message : 'Werkzeugaufruf fehlgeschlagen.',
		);
	}
});

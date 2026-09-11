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
 *
 * GET antwortet gemäß Streamable-HTTP-Spec mit 405 (`Allow: POST`), da es keinen SSE-Strom gibt;
 * DELETE bleibt unbedient, weil nie eine `Mcp-Session-Id` vergeben wird (kein Grund zu terminieren).
 */

/**
 * Pfad des Endpunkts — eine Konstante, weil der `apiTokenScopeGuard` (express/apiTokenAuth.ts)
 * denselben Pfad kennen muss, um die JSON-RPC-Transportroute nicht allein wegen ihrer
 * HTTP-Methode zu sperren. Route und Ausnahme können so nicht auseinanderlaufen.
 */
export const MCP_PATH = '/mcp/v1';

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

mcpRouter.post(MCP_PATH, async (req: Request, res: Response) => {
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
	// Rechtestufe (#1356) am Werkzeug prüfen, nicht erst am Loopback: die gespiegelte Route würde
	// denselben Aufruf zwar ebenfalls mit 403 abweisen, der Client bekäme die Ursache aber nur als
	// durchgereichten HTTP-Text. Hier entsteht stattdessen ein regulärer JSON-RPC-Fehler, der sagt,
	// was zu tun ist. Die Route bleibt die zweite Verteidigungslinie (Bearer ohne MCP).
	if (tool.write && req.apiTokenScope === 'read') {
		sendRpcError(
			res,
			id,
			JSONRPC_INVALID_PARAMS,
			`Das Werkzeug "${tool.name}" schreibt, dieser Token erlaubt nur lesenden Zugriff. ` +
				'In den Einstellungen unter „Zugriff" lässt sich der Token auf „Lesen und Schreiben" umschalten.',
		);
		return;
	}

	const args = (typeof params.arguments === 'object' && params.arguments !== null ? params.arguments : {}) as Record<
		string,
		unknown
	>;
	// Loopback-Ziel des Werkzeugs: derselbe Server, derselbe Bearer-Token (siehe tools.ts).
	// Das Ziel wird bewusst NICHT aus `req.protocol`/`Host` gebaut: beides ist Client-kontrolliert
	// (durch `trust proxy` zusätzlich über `X-Forwarded-Host`/`-Proto`), der Server würde damit auf
	// Zuruf beliebige Ziele anfragen — inklusive des mitgesendeten Bearer-Tokens (SSRF).
	// `req.socket.localPort` ist der Port, auf dem dieser Prozess tatsächlich lauscht (im Test der
	// zufällige Port aus `app.listen(0)`), und kommt vom Kernel, nicht vom Aufrufer.
	const localPort = req.socket.localPort ?? (Number(process.env.PORT) || 3000);
	const context: McpToolContext = {
		baseUrl: `http://127.0.0.1:${localPort}`,
		authorization: req.get('authorization') ?? '',
	};
	try {
		// CallToolResult per MCP-Spec: das Roh-Payload reist als JSON-Text im ersten Content-Block.
		// Konforme Clients (SDK, Claude-Connector) validieren den Envelope und lehnen nackte
		// Arrays/Objekte als `result` ab (mcp-handshake.test.ts).
		const payload = await tool.run(context, args);
		sendResult(res, id, { content: [{ type: 'text', text: JSON.stringify(payload) }] });
	} catch (error) {
		sendRpcError(
			res,
			id,
			JSONRPC_INTERNAL_ERROR,
			error instanceof Error ? error.message : 'Werkzeugaufruf fehlgeschlagen.',
		);
	}
});

mcpRouter.get(MCP_PATH, (_req: Request, res: Response) => {
	res.set('Allow', 'POST');
	res.status(405).end();
});

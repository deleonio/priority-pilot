import { describe, it, before, beforeEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
	resetDb,
	closeDb,
	startTestServer,
	applyTestAuthEnv,
	seedBillingAddress,
	type TestServer,
} from '../test/helpers.js';
import { Subscription, User } from '../models/index.js';
import { mcpAdminTools } from '../mcp/adminTools.js';

/**
 * Admin-MCP-Endpunkt `/mcp/admin/v1` (#1338): getrennter, nur lesender Katalog, nur für die
 * Systemrolle `admin`; Paket-Gate `mcp_read` gilt nicht.
 */

applyTestAuthEnv('mcp-admin-test');
process.env.GOOGLE_ALLOWED_EMAILS = 'admin@example.com,member@example.com,tester@example.com';

const ADMIN_TOOLS = [
	'admin_allowed_emails_list',
	'admin_care_wirkung',
	'admin_kpis',
	'admin_subscriptions_summary',
	'admin_user_subscriptions',
	'admin_users_list',
	'admin_waitlist_list',
];

let server: TestServer;

/** Login mit Rolle, Nur-Lese-Token anlegen; liefert Token und Nutzer-Id. */
const tokenFor = async (
	email: string,
	role: 'admin' | 'member' | 'tester',
): Promise<{ token: string; userId: number }> => {
	const cookie = await server.login(email, { role });
	const created = await server.json('/api-tokens', {
		method: 'POST',
		headers: { Cookie: cookie },
		body: JSON.stringify({ name: 'MCP-Admin', expiresInDays: 365 }),
	});
	assert.equal(created.status, 201);
	const { id, token } = (await created.json()) as { id: number; token: string };
	const scoped = await server.json(`/api-tokens/${id}`, {
		method: 'PATCH',
		headers: { Cookie: cookie },
		body: JSON.stringify({ scope: 'read' }),
	});
	assert.equal(scoped.status, 200);
	const user = (await User.findOne({ where: { email } }))!;
	return { token, userId: user.id };
};

const rpc = (
	token: string | undefined,
	method: string,
	params: unknown = {},
	path = '/mcp/admin/v1',
): Promise<Response> =>
	fetch(`${server.baseUrl}${path}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			...(token ? { Authorization: `Bearer ${token}` } : {}),
		},
		body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
	});

type RpcBody = { result?: { tools?: { name: string }[]; content?: { text: string }[] }; error?: { message: string } };

const call = async (token: string, name: string, args: Record<string, unknown> = {}): Promise<RpcBody> => {
	const res = await rpc(token, 'tools/call', { name, arguments: args });
	assert.equal(res.status, 200);
	return (await res.json()) as RpcBody;
};

const payloadOf = (body: RpcBody): unknown => {
	assert.equal(body.error, undefined, body.error?.message);
	return JSON.parse(body.result!.content![0].text);
};

const createSub = (userId: number, status: string, currentPeriodEnd: Date) =>
	Subscription.create({
		userId,
		provider: 'paypal',
		externalSubscriptionId: `I-SECRET-${userId}-${status}`,
		plan: 'plus',
		period: 'monthly',
		status,
		currentPeriodEnd,
		cancellationReason: 'Geheimer Kündigungsgrund',
		cancellationEmail: 'kuendigung-geheim@example.com',
	});

describe('Admin-MCP-Endpunkt /mcp/admin/v1 (#1338)', () => {
	before(async () => {
		server = await startTestServer();
	});
	beforeEach(async () => {
		await resetDb();
	});
	after(async () => {
		if (server) await server.close();
		await closeDb();
	});

	it('AK1: tools/list liefert genau die Admin-Werkzeuge, /mcp/v1 bleibt ohne Admin-Werkzeug', async () => {
		const { token } = await tokenFor('admin@example.com', 'admin');
		const admin = (await (await rpc(token, 'tools/list')).json()) as RpcBody;
		assert.deepEqual(admin.result!.tools!.map((tool) => tool.name).sort(), ADMIN_TOOLS);
		const member = (await (await rpc(token, 'tools/list', {}, '/mcp/v1')).json()) as RpcBody;
		assert.ok(member.result!.tools!.every((tool) => !tool.name.startsWith('admin_')));
	});

	it('AK2: Member und Tester bekommen 403 auf jede Methode, ohne/ungültiger Token 401', async () => {
		for (const [email, role] of [
			['member@example.com', 'member'],
			['tester@example.com', 'tester'],
		] as const) {
			const { token } = await tokenFor(email, role);
			for (const [method, params] of [
				['initialize', {}],
				['tools/list', {}],
				['tools/call', { name: 'admin_users_list', arguments: {} }],
			] as const) {
				const res = await rpc(token, method, params);
				assert.equal(res.status, 403, `${role} ${method}`);
				assert.equal(((await res.json()) as RpcBody).result, undefined);
			}
		}
		assert.equal((await rpc(undefined, 'tools/list')).status, 401);
		assert.equal((await rpc('pp_does-not-exist', 'tools/list')).status, 401);
	});

	it('AK3: nach der Rückstufung scheitert der nächste Request mit demselben Token', async () => {
		const { token, userId } = await tokenFor('admin@example.com', 'admin');
		assert.equal((await rpc(token, 'tools/list')).status, 200);
		await User.update({ role: 'member' }, { where: { id: userId } });
		assert.equal((await rpc(token, 'tools/list')).status, 403);
	});

	it('AK4/AK8/AK9: Admin mit Paket free und Nur-Lese-Token ruft jedes Werkzeug auf, nur per GET', async () => {
		const { token, userId } = await tokenFor('admin@example.com', 'admin');
		assert.equal((await User.findByPk(userId))!.plan, 'free');
		assert.ok(mcpAdminTools.every((tool) => tool.write === undefined));
		const methods: string[] = [];
		const realFetch = globalThis.fetch;
		// Paket-Gates scharf: ohne die Admin-Ausnahme scheiterte jeder Loopback an `mcp_read`.
		process.env.MONETIZATION_ENFORCED = 'true';
		const spy = mock.method(globalThis, 'fetch', (input: string | URL | Request, init?: RequestInit) => {
			if (String(input).includes('127.0.0.1')) methods.push(init?.method ?? 'GET');
			return realFetch(input, init);
		});
		try {
			for (const tool of mcpAdminTools) {
				const args =
					tool.name === 'admin_user_subscriptions'
						? { userId }
						: tool.name === 'admin_kpis'
							? { zeitraum: 'woche' }
							: {};
				payloadOf(await call(token, tool.name, args));
			}
		} finally {
			spy.mock.restore();
			delete process.env.MONETIZATION_ENFORCED;
		}
		assert.equal(methods.length, mcpAdminTools.length);
		assert.ok(methods.every((method) => method === 'GET'));
	});

	it('AK5/AK6/AK10: Daten wie in der Nutzerverwaltung, running je Abo, keine ausgeschlossenen Felder', async () => {
		const { token } = await tokenFor('admin@example.com', 'admin');
		await server.login('member@example.com', { role: 'member' });
		await seedBillingAddress('member@example.com');
		const member = (await User.findOne({ where: { email: 'member@example.com' } }))!;
		await createSub(member.id, 'cancelled', new Date(Date.now() + 5 * 86_400_000));

		const users = payloadOf(await call(token, 'admin_users_list')) as {
			email: string;
			displayName: string;
			role: string;
			plan: string;
			createdAt: string;
			subscriptionStatus: string | null;
		}[];
		const row = users.find((user) => user.email === 'member@example.com')!;
		assert.equal(row.role, 'member');
		assert.equal(row.subscriptionStatus, 'cancelled');
		assert.ok(row.displayName && row.plan && row.createdAt);

		const subsBody = await call(token, 'admin_user_subscriptions', { userId: member.id });
		const subs = payloadOf(subsBody) as { provider: string; running: boolean }[];
		assert.equal(subs[0].running, true);

		const unknown = await call(token, 'admin_user_subscriptions', { userId: 999_999 });
		assert.match(unknown.error!.message, /Nutzer nicht gefunden/);

		const everything = JSON.stringify([users, subsBody, payloadOf(await call(token, 'admin_subscriptions_summary'))]);
		for (const secret of ['Musterstraße', 'Geheimer Kündigungsgrund', 'kuendigung-geheim', 'I-SECRET', 'geolocation']) {
			assert.ok(!everything.includes(secret), `Antwort enthält ${secret}`);
		}
	});

	it('AK11: jeder Werkzeugaufruf schreibt eine Protokollzeile ohne Argumente', async () => {
		const { token, userId } = await tokenFor('admin@example.com', 'admin');
		const info = mock.method(console, 'info', () => {});
		try {
			await call(token, 'admin_kpis', { zeitraum: 'monat' });
			await call(token, 'admin_kpis', { zeitraum: 'jahr' });
		} finally {
			info.mock.restore();
		}
		const lines = info.mock.calls
			.filter((entry) => entry.arguments[0] === 'MCP-Admin')
			.map((entry) => entry.arguments[1]);
		assert.deepEqual(lines, [
			{ userId, tool: 'admin_kpis', ok: true },
			{ userId, tool: 'admin_kpis', ok: false },
		]);
	});
});

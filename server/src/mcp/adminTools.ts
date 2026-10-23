/**
 * Werkzeugkatalog des Admin-MCP-Endpunkts `/mcp/admin/v1` (#1338) — ausschließlich lesend.
 *
 * Jedes Werkzeug spiegelt per Loopback eine `GET /admin/*`-Route (Muster `tools.ts`): deren
 * `requireRole('admin')` bleibt die zweite Prüfung, die Daten entsprechen der Nutzerverwaltung.
 * Kein Werkzeug trägt `write` — Rollen, Abos und Warteliste ändert nur die Weboberfläche.
 */

import { MCP_PACING_HINT, callApi, requireIntegerId, type McpTool } from './tools.js';

const noInput = { type: 'object', properties: {} } as const;

const catalog: McpTool[] = [
	{
		name: 'admin_users_list',
		description:
			'Lists all user accounts with id, email, display name, system role, plan, creation date, AI requests this month ' +
			'and the status of the most recent subscription (null without subscription). The ids identify a user in ' +
			'admin_user_subscriptions.',
		inputSchema: noInput,
		run: (ctx) => callApi(ctx, '/admin/users'),
	},
	{
		name: 'admin_user_subscriptions',
		description:
			"Lists one user's subscription history, newest first: provider, plan, status, period end, creation date and " +
			'running (true while the subscription is paid or cancelled with remaining term).',
		inputSchema: {
			type: 'object',
			properties: { userId: { type: 'integer', description: 'User id from admin_users_list.' } },
			required: ['userId'],
		},
		run: (ctx, args) => callApi(ctx, `/admin/users/${requireIntegerId(args, 'userId')}/subscriptions`),
	},
	{
		name: 'admin_subscriptions_summary',
		description:
			'Counts all subscriptions without personal data: per plan and status, running per plan and billing period, ' +
			'overdue (past_due/suspended), cancelled with remaining term, and running subscriptions ending within 30 days. ' +
			'Running means active, past_due or suspended, or cancelled with the period end in the future; approval_pending ' +
			'does not count.',
		inputSchema: noInput,
		run: (ctx) => callApi(ctx, '/admin/subscriptions/summary'),
	},
	{
		name: 'admin_allowed_emails_list',
		description:
			'Lists the email addresses allowed to sign in, with their origin, including addresses without an account.',
		inputSchema: noInput,
		run: (ctx) => callApi(ctx, '/admin/allowed-emails'),
	},
	{
		name: 'admin_waitlist_list',
		description: 'Lists the waitlist in activation order with position, status, referral count and access mail status.',
		inputSchema: noInput,
		run: (ctx) => callApi(ctx, '/admin/waitlist'),
	},
	{
		name: 'admin_kpis',
		description:
			'Returns the launch KPIs (activation, day-7 return, share rate, invitations) per registration period as rates.',
		inputSchema: {
			type: 'object',
			properties: {
				zeitraum: { type: 'string', description: 'Registration period grouping: "woche" (week) or "monat" (month).' },
			},
			required: ['zeitraum'],
		},
		run: (ctx, args) => {
			if (args.zeitraum !== 'woche' && args.zeitraum !== 'monat') {
				throw new Error('zeitraum must be "woche" or "monat".');
			}
			return callApi(ctx, `/admin/kpis?zeitraum=${args.zeitraum}`);
		},
	},
	{
		name: 'admin_care_wirkung',
		description:
			'Returns the effect of care suggestions and care pushes: weekly counts and 4-/12-week retention per push group, ' +
			'totals only.',
		inputSchema: noInput,
		run: (ctx) => callApi(ctx, '/admin/care-wirkung'),
	},
];

export const mcpAdminTools: McpTool[] = catalog.map((tool) => ({
	...tool,
	description: `${tool.description} ${MCP_PACING_HINT}`,
}));

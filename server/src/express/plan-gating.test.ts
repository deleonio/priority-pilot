/**
 * Rote Spec-Tests für Issue #1457 (Spec docs/spec/issue-1457.md, T2) — serverseitiges
 * Feature-Gating. Rot, bis `requirePlanFeature()` (server/src/express/planGuard.ts, existiert
 * noch nicht) an den betroffenen Routen hängt.
 *
 * Deckt AK2–AK5 je an einer repräsentativen Route pro Feature-Gruppe ab (Muster:
 * api-auth-protection.test.ts). Die vollständige Routen-Enumeration ist AK8
 * (plan-gating-coverage.test.ts).
 */
import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import { User } from '../models/index.js';
import sequelize from '../database.js';
import type { Plan } from '../logics/plans.js';

applyTestAuthEnv('plan-gating-test');

let server: TestServer;

/** Setzt den Plan eines per E-Mail bekannten Nutzers direkt in der DB (Test-Only-Shortcut). */
const setPlan = async (email: string, plan: Plan): Promise<void> => {
	await User.update({ plan }, { where: { email } });
};

type GatedCase = {
	label: string;
	feature: string;
	requiredPlan: Plan;
	request: (baseUrl: string, cookie: string) => Promise<Response>;
};

const GATED_CASES: GatedCase[] = [
	{
		label: 'POST /groups',
		feature: 'groups',
		requiredPlan: 'pro',
		request: (baseUrl, cookie) =>
			fetch(`${baseUrl}/groups`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', cookie },
				body: JSON.stringify({ name: 'Testgruppe' }),
			}),
	},
	{
		label: 'PUT /geo-config',
		feature: 'location_reminders',
		requiredPlan: 'max',
		request: (baseUrl, cookie) =>
			fetch(`${baseUrl}/geo-config`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json', cookie },
				body: JSON.stringify({ displayDistanceKm: 5, alarmDistanceKm: 1, intervalMinutes: 5 }),
			}),
	},
];

describe('Serverseitiges Feature-Gating (#1457)', () => {
	before(async () => {
		server = await startTestServer();
	});
	beforeEach(async () => {
		await resetDb();
		delete process.env.MONETIZATION_ENFORCED;
	});
	after(async () => {
		delete process.env.MONETIZATION_ENFORCED;
		if (server) await server.close();
		await closeDb();
	});

	describe('AK2 — MONETIZATION_ENFORCED=true blockt free-Nutzer mit plan_required', () => {
		for (const gatedCase of GATED_CASES) {
			it(`${gatedCase.label}: free-Nutzer → 403 plan_required`, async () => {
				process.env.MONETIZATION_ENFORCED = 'true';
				const cookie = await server.register(`free-${gatedCase.feature}@example.com`);
				await setPlan(`free-${gatedCase.feature}@example.com`, 'free');

				const res = await gatedCase.request(server.baseUrl, cookie);
				assert.equal(res.status, 403, `${gatedCase.label} muss für free 403 liefern`);
				const body = (await res.json()) as {
					message: string;
					code?: string;
					feature?: string;
					requiredPlan?: string;
				};
				assert.equal(body.code, 'plan_required');
				assert.equal(body.feature, gatedCase.feature);
				assert.equal(body.requiredPlan, gatedCase.requiredPlan);
				assert.ok(body.message?.trim().length > 0, 'Body braucht eine lesbare message');
			});
		}

		it('POST /groups: max-Nutzer (ausreichendes Paket) bleibt unverändert erfolgreich', async () => {
			process.env.MONETIZATION_ENFORCED = 'true';
			const email = 'max-groups@example.com';
			const cookie = await server.register(email);
			await setPlan(email, 'max');

			const res = await fetch(`${server.baseUrl}/groups`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', cookie },
				body: JSON.stringify({ name: 'Testgruppe' }),
			});
			assert.equal(res.status, 201, 'Nutzer mit ausreichendem Paket darf weiterhin Gruppen anlegen');
		});
	});

	describe('AK3 — MONETIZATION_ENFORCED aus: unverändertes Verhalten für free-Nutzer', () => {
		for (const gatedCase of GATED_CASES) {
			it(`${gatedCase.label}: free-Nutzer ohne Rollout → kein 403`, async () => {
				// Rollout bleibt bewusst aus (kein MONETIZATION_ENFORCED gesetzt, Default laut plans.ts).
				const email = `free-off-${gatedCase.feature}@example.com`;
				const cookie = await server.register(email);
				await setPlan(email, 'free');

				const res = await gatedCase.request(server.baseUrl, cookie);
				assert.notEqual(res.status, 403, `${gatedCase.label} darf bei ausgeschaltetem Rollout nicht 403 liefern`);
			});
		}
	});

	describe('AK4 — Lesende Endpunkte bleiben bei eingeschaltetem Rollout für free-Nutzer erreichbar', () => {
		const READ_PATHS = ['/graph', '/forest', '/next', '/groups', '/place-favorites', '/geo-config'];

		for (const path of READ_PATHS) {
			it(`GET ${path}: free-Nutzer → 200 trotz MONETIZATION_ENFORCED=true`, async () => {
				process.env.MONETIZATION_ENFORCED = 'true';
				const email = `free-read-${path.replace(/\W+/g, '')}@example.com`;
				const cookie = await server.register(email);
				await setPlan(email, 'free');

				const res = await fetch(`${server.baseUrl}${path}`, { headers: { cookie } });
				assert.equal(res.status, 200, `GET ${path} muss für free-Nutzer 200 bleiben (simuliertes Downgrade)`);
			});
		}
	});

	describe('AK5 — Freitext-Adresse in Tasks bleibt für free-Nutzer speicherbar', () => {
		it('POST /tasks mit Adressfeld → 201 trotz MONETIZATION_ENFORCED=true', async () => {
			process.env.MONETIZATION_ENFORCED = 'true';
			const email = 'free-task-address@example.com';
			const cookie = await server.register(email);
			await setPlan(email, 'free');

			const res = await fetch(`${server.baseUrl}/tasks`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', cookie },
				body: JSON.stringify({ title: 'Mit Adresse', priority: 3, estimatedEffort: 0.5, address: 'Musterstr. 1' }),
			});
			assert.equal(res.status, 201, 'POST /tasks mit Adressfeld darf für free nicht am Paket scheitern');
		});

		it('PATCH /tasks/:id mit Adressfeld → kein 403 trotz MONETIZATION_ENFORCED=true', async () => {
			process.env.MONETIZATION_ENFORCED = 'true';
			const email = 'free-task-address-patch@example.com';
			const cookie = await server.register(email);
			await setPlan(email, 'free');

			const created = await fetch(`${server.baseUrl}/tasks`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', cookie },
				body: JSON.stringify({ title: 'Ohne Adresse', priority: 3, estimatedEffort: 0.5 }),
			});
			assert.equal(created.status, 201);
			const task = (await created.json()) as { id: number };

			const res = await fetch(`${server.baseUrl}/tasks/${task.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json', cookie },
				body: JSON.stringify({ address: 'Neue Str. 2' }),
			});
			assert.notEqual(res.status, 403, 'PATCH /tasks/:id mit Adressfeld darf für free nicht am Paket scheitern');
		});
	});

	describe('AK9 — Free-Nutzer erreicht den KI-Kontingentzähler nicht (#1459)', () => {
		const AI_ROUTES: { label: string; request: (baseUrl: string, cookie: string) => Promise<Response> }[] = [
			{
				label: 'POST /tasks/parse-text',
				request: (baseUrl, cookie) =>
					fetch(`${baseUrl}/tasks/parse-text`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json', cookie },
						body: JSON.stringify({ text: 'Text' }),
					}),
			},
			{
				label: 'POST /lektorat',
				request: (baseUrl, cookie) =>
					fetch(`${baseUrl}/lektorat`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json', cookie },
						body: JSON.stringify({ text: 'Text' }),
					}),
			},
		];

		for (const aiRoute of AI_ROUTES) {
			it(`${aiRoute.label}: free-Nutzer → 403 plan_required statt Kontingent-Prüfung`, async () => {
				process.env.MONETIZATION_ENFORCED = 'true';
				const email = `ak9-${aiRoute.label.replace(/\W+/g, '')}@example.com`;
				const cookie = await server.register(email);
				await setPlan(email, 'free');

				const res = await aiRoute.request(server.baseUrl, cookie);
				assert.equal(res.status, 403, `${aiRoute.label} muss für free 403 liefern, bevor das Kontingent geprüft wird`);
				const body = (await res.json()) as { code?: string; feature?: string };
				assert.equal(body.code, 'plan_required');
				assert.equal(body.feature, 'ai_assist');
			});
		}

		it('POST /tasks/parse-text: free-Nutzer legt keine ai_usage-Zeile an', async () => {
			process.env.MONETIZATION_ENFORCED = 'true';
			const email = 'ak9-no-row@example.com';
			const cookie = await server.register(email);
			await setPlan(email, 'free');
			const user = await User.findOne({ where: { email } });

			await AI_ROUTES[0].request(server.baseUrl, cookie);

			// Rohes SQL statt Modell-Import: `server/src/models/aiUsage.ts` existiert noch nicht — ein
			// `import { AiUsage } ...` würde den knip-Gate (unresolved imports) schon beim Commit
			// blocken UND die ganze (bestehende, grüne) Datei crashen. Die Abfrage wirft aktuell
			// `SQLITE_ERROR: no such table: ai_usage` — legitimer Erstzustand für die neue Tabelle.
			const [rows] = await sequelize.query('SELECT * FROM ai_usage WHERE userId = ?', {
				replacements: [user!.id],
			});
			assert.equal((rows as unknown[]).length, 0, 'free-Nutzer darf keinen ai_usage-Eintrag erzeugen');
		});
	});
});

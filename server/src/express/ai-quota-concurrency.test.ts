/**
 * Rote Spec-Tests für Issue #1459 (Spec docs/spec/issue-1459.md, T4), AK3 — die Buchung muss ein
 * einziges bedingtes `UPDATE` sein (kein Read-Modify-Write), damit gleichzeitige Requests das
 * Kontingent nicht überziehen. Rot, bis `server/src/models/aiUsage.ts` existiert.
 */
import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import { User } from '../models/index.js';
import sequelize from '../database.js';
import { AI_ASSIST_MONTHLY_QUOTA } from '../logics/plans.js';
import type { ParseTaskParser } from '../llm/llm.js';

applyTestAuthEnv('ai-quota-concurrency-test');

let server: TestServer;
const parseTextImpl: ParseTaskParser = async () => ({ title: 'Task' });

const currentYearMonth = (): string => new Date().toISOString().slice(0, 7);

describe('KI-Kontingent-Metering — Nebenläufigkeit (#1459, AK3)', () => {
	before(async () => {
		server = await startTestServer({
			taskTextParser: (text, provider, categories) => parseTextImpl(text, provider, categories),
		});
	});
	beforeEach(async () => {
		await resetDb();
		process.env.MONETIZATION_ENFORCED = 'true';
	});
	after(async () => {
		delete process.env.MONETIZATION_ENFORCED;
		if (server) await server.close();
		await closeDb();
	});

	it('zehn gleichzeitige Requests mit Restkontingent 1 ergeben genau 1x 2xx und 9x 429', async () => {
		const email = 'ak3-concurrency@example.com';
		const cookie = await server.register(email);
		await User.update({ plan: 'pro' }, { where: { email } });
		const user = await User.findOne({ where: { email } });
		// Rohes SQL statt Modell-Import (`server/src/models/aiUsage.ts` existiert noch nicht — ein
		// `import { AiUsage } ...` würde den knip-Gate schon beim Commit blocken). Wirft aktuell
		// `SQLITE_ERROR: no such table: ai_usage` — legitimer Erstzustand für die neue Tabelle.
		await sequelize.query(
			"INSERT INTO ai_usage (userId, yearMonth, count, createdAt, updatedAt) VALUES (?, ?, ?, datetime('now'), datetime('now'))",
			{ replacements: [user!.id, currentYearMonth(), AI_ASSIST_MONTHLY_QUOTA.pro - 1] },
		);

		const requests = Array.from({ length: 10 }, () =>
			fetch(`${server.baseUrl}/tasks/parse-text`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', cookie },
				body: JSON.stringify({ text: 'Parallele Anfrage' }),
			}),
		);
		const responses = await Promise.all(requests);
		const statuses = responses.map((res) => res.status);
		const successCount = statuses.filter((status) => status < 300).length;
		const rejectedCount = statuses.filter((status) => status === 429).length;

		assert.equal(successCount, 1, `genau ein Request darf erfolgreich sein, Status: ${statuses.join(',')}`);
		assert.equal(rejectedCount, 9, `neun Requests müssen 429 liefern, Status: ${statuses.join(',')}`);

		const [rows] = await sequelize.query('SELECT count FROM ai_usage WHERE userId = ? AND yearMonth = ?', {
			replacements: [user!.id, currentYearMonth()],
		});
		assert.equal(
			(rows as { count: number }[])[0]?.count,
			AI_ASSIST_MONTHLY_QUOTA.pro,
			'Zähler muss exakt auf dem Kontingent stehen',
		);
	});
});

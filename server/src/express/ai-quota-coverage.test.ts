/**
 * Abdeckungstest für Issue #1459 (Spec docs/spec/issue-1459.md, T4), AK5 — die Zähler-Middleware
 * muss an allen fünf LLM-Routen hängen und eine Marker-Eigenschaft am Handler tragen (Muster:
 * `plan-gating-coverage.test.ts`, `PlanFeatureHandler.planFeature`). Rot, bis
 * `server/src/express/aiQuotaMeter.ts` existiert.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Router } from 'express';
import { createParseTasksRouter } from './routes/parseTasks.js';
import { createSuggestPillarsRouter } from './routes/suggestPillars.js';
import { createPillarAdvisorRouter } from './routes/pillarAdvisor.js';
import { lektoratRouter } from './routes/lektorat.js';
import { createReassignPillarsRouter } from './routes/reassignPillars.js';

/** Minimale Sicht auf den Express-Router-Stack (Express 5) — nur was der Test liest. */
interface RouteLayer {
	route?: {
		path: string | string[];
		methods?: Record<string, boolean>;
		stack: { handle: { aiQuotaMetered?: boolean }; method?: string }[];
	};
}

/** Liest je Route eines Routers `METHOD /pfad` → ob die Zähler-Middleware angehängt ist. */
const meteringOf = (router: Router): Record<string, boolean> => {
	const result: Record<string, boolean> = {};
	for (const layer of (router as unknown as { stack: RouteLayer[] }).stack) {
		if (!layer.route) continue;
		const path = Array.isArray(layer.route.path) ? layer.route.path[0] : layer.route.path;
		const metered = layer.route.stack.some((entry) => entry.handle.aiQuotaMetered === true);
		for (const [method, active] of Object.entries(layer.route.methods ?? {})) {
			if (!active || method === '_all') continue;
			result[`${method.toUpperCase()} ${path}`] = metered;
		}
	}
	return result;
};

/**
 * Erwartete Zuordnung Route → Zähler-Middleware. `POST /tasks/suggest-pillars/feedback` speichert
 * nur Korrektur-Samples (kein Provider-Call) und bleibt bewusst ungezählt (`false`) — sonst wären
 * es sechs statt der fünf im Analyse-Block genannten LLM-Routen.
 */
const EXPECTED: Record<string, boolean> = {
	'POST /tasks/parse-text': true,
	'POST /tasks/parse-search': true,
	'POST /tasks/suggest-pillars': true,
	'POST /tasks/suggest-pillars/feedback': false,
	'POST /pillars/advisor': true,
	'POST /lektorat': true,
	// #1614: bucht je klassifizierter Aufgabe selbst statt einmal je Request (ein Lauf löst N
	// Provider-Aufrufe aus) und markiert dafür den eigenen Handler — gezählt wird sie trotzdem.
	'POST /tasks/reassign-pillars': true,
	// Liest nur den Stand des letzten Laufs — kein Provider-Aufruf, daher ungezählt.
	'GET /tasks/reassign-pillars/status': false,
};

describe('KI-Kontingent-Metering: Abdeckung aller fünf LLM-Routen (#1459, AK5)', () => {
	const actual = {
		...meteringOf(createParseTasksRouter()),
		...meteringOf(createSuggestPillarsRouter()),
		...meteringOf(createPillarAdvisorRouter()),
		...meteringOf(lektoratRouter()),
		...meteringOf(createReassignPillarsRouter()),
	};

	it('jede Route der vier LLM-Routendateien trägt (oder trägt bewusst nicht) die Zähler-Middleware', () => {
		assert.deepEqual(
			actual,
			EXPECTED,
			'Abweichung Route → Metering: eine neue oder umgehängte Route muss in EXPECTED eingetragen werden.',
		);
	});
});

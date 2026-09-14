/**
 * Abdeckungstest für das serverseitige Feature-Gating (Issue #1457, AK7/AK8) — Muster:
 * `api-auth-protection.test.ts`.
 *
 * Der Test enumeriert den Express-Router-Stack der betroffenen Routendateien und vergleicht ihn
 * gegen die verbindliche Zuordnung Route → Feature aus `docs/spec/issue-1457.md`. Eine neu
 * hinzugefügte Route in einer dieser Dateien taucht dadurch zwangsläufig als unbekannter Eintrag
 * auf und färbt den Test rot, bis sie entweder einen Guard bekommt oder bewusst als ungegatet
 * eingetragen wird. Zusätzlich prüft er, dass jede gegatete Route in `openapi.yml` eine
 * 403-Antwort führt.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Router } from 'express';
import { groupsRouter } from './routes/groups.js';
import { inviteLinksPublicRouter } from './routes/inviteLinks.js';
import { geoConfigRouter } from './routes/geoConfig.js';
import { placeFavoritesRouter } from './routes/placeFavorites.js';
import { geocodeSearchRouter } from './routes/geocodeSearch.js';
import { reverseGeocodeRouter } from './routes/reverseGeocode.js';
import { createTasksRouter } from './routes/tasks.js';
import type { FeatureId } from '../logics/plans.js';

/** Minimale Sicht auf den Express-Router-Stack (Express 5) — nur was der Test liest. */
interface RouteLayer {
	route?: {
		path: string | string[];
		methods?: Record<string, boolean>;
		stack: { handle: { planFeature?: FeatureId }; method?: string }[];
	};
}

/**
 * Liest je Route eines Routers `METHOD /pfad` → Feature des angehängten Plan-Guards (`null`, wenn
 * keiner hängt). `mountPath` bildet den Mount aus `express/index.ts` ab, damit Router mit
 * `'/'`-Routen (Geocoding) unter ihrem echten Pfad erscheinen.
 */
const gatingOf = (router: Router, mountPath = ''): Record<string, FeatureId | null> => {
	const result: Record<string, FeatureId | null> = {};
	for (const layer of (router as unknown as { stack: RouteLayer[] }).stack) {
		if (!layer.route) continue;
		const path = Array.isArray(layer.route.path) ? layer.route.path[0] : layer.route.path;
		const feature = layer.route.stack.find((entry) => entry.handle.planFeature)?.handle.planFeature ?? null;
		for (const [method, active] of Object.entries(layer.route.methods ?? {})) {
			if (!active || method === '_all') continue;
			result[`${method.toUpperCase()} ${mountPath}${path === '/' ? '' : path}`] = feature;
		}
	}
	return result;
};

/**
 * Erwartete Zuordnung Route → Feature (`null` = bewusst ungegatet). Verbindlich aus dem
 * KI-ANALYSE-Block von #1457 bzw. `docs/spec/issue-1457.md`:
 * Lesen bleibt offen, `POST /invitations/:id/decline` bleibt offen (Ablehnen darf nie am Paket
 * scheitern), `POST`/`PATCH /tasks` bleiben offen (Freitext-Adresse ohne Max, AK5).
 */
const EXPECTED: Record<string, FeatureId | null> = {
	// groups.ts
	'POST /groups': 'groups',
	'GET /groups': null,
	'GET /groups/:id': null,
	'PATCH /groups/:id': 'groups',
	'DELETE /groups/:id': 'groups',
	'GET /groups/:id/members': null,
	'GET /groups/:id/invitations': null,
	'POST /groups/:id/invitations': 'groups',
	'GET /invitations': null,
	'POST /invitations/:id/accept': 'groups',
	'POST /invitations/:id/decline': null,
	'PATCH /groups/:id/members/:userId': 'groups',
	'DELETE /groups/:id/members/:userId': 'groups',
	'GET /groups/:id/tasks': null,
	'GET /groups/:id/series': null,
	'POST /groups/:id/invite-links': 'groups',
	'DELETE /invite-links/:id': 'groups',
	// inviteLinks.ts
	'GET /invite-links/:token': null,
	'POST /invite-links/:token/redeem': 'groups',
	// geoConfig.ts
	'GET /geo-config': null,
	'PUT /geo-config': 'location_reminders',
	'POST /geo/position': 'location_reminders',
	// placeFavorites.ts
	'GET /place-favorites': null,
	'POST /place-favorites': 'location_reminders',
	'PATCH /place-favorites/:id': 'location_reminders',
	'DELETE /place-favorites/:id': 'location_reminders',
	// geocodeSearch.ts / reverseGeocode.ts (Mount siehe express/index.ts)
	'GET /geocode-search': 'location_reminders',
	'GET /reverse-geocode': 'location_reminders',
	// tasks.ts
	'GET /tasks': null,
	'GET /tasks/nearby': 'location_reminders',
	'POST /tasks': null,
	'GET /tasks/:id': null,
	'PATCH /tasks/:id': null,
	'DELETE /tasks/:id': null,
	'POST /tasks/:id/dependencies': 'graph_write',
	'DELETE /tasks/:id/dependencies/:depId': 'graph_write',
};

/** Express-Pfad → OpenAPI-Pfad (`:id` → `{id}`). */
const openapiPathOf = (route: string): string =>
	route
		.slice(route.indexOf(' ') + 1)
		.replace(/:(\w+)/g, '{$1}')
		.replace('{depId}', '{depId}');

const openapiYml = readFileSync(fileURLToPath(new URL('../../../openapi.yml', import.meta.url)), 'utf8');

describe('Plan-Gating: Abdeckung aller betroffenen Routen (#1457)', () => {
	const actual = {
		...gatingOf(groupsRouter),
		...gatingOf(inviteLinksPublicRouter),
		...gatingOf(geoConfigRouter),
		...gatingOf(placeFavoritesRouter),
		...gatingOf(geocodeSearchRouter, '/geocode-search'),
		...gatingOf(reverseGeocodeRouter, '/reverse-geocode'),
		...gatingOf(createTasksRouter()),
	};

	it('AK8 — jede Route der betroffenen Dateien trägt genau das vorgesehene Feature', () => {
		assert.deepEqual(
			actual,
			EXPECTED,
			'Abweichung Route → Feature: eine neue oder umgehängte Route muss in EXPECTED eingetragen ' +
				'werden (mit Guard) oder bewusst als `null` dokumentiert sein.',
		);
	});

	it('AK7 — jede gegatete Route führt in openapi.yml eine 403-Antwort', () => {
		const gated = Object.entries(EXPECTED).filter(([, feature]) => feature !== null);
		assert.ok(gated.length > 0, 'Testtabelle darf nicht leer sein');
		for (const [route] of gated) {
			const path = openapiPathOf(route);
			const method = route.slice(0, route.indexOf(' ')).toLowerCase();
			const pathBlock = openapiYml.split(`\n  ${path}:\n`)[1];
			assert.ok(pathBlock, `openapi.yml kennt den Pfad ${path} nicht`);
			// führendes `\n`, damit die erste Methode direkt hinter dem Pfad ebenfalls greift
			const opBlock = `\n${pathBlock}`.split(`\n    ${method}:\n`)[1]?.split('\n  /')[0];
			assert.ok(opBlock, `openapi.yml kennt ${method.toUpperCase()} ${path} nicht`);
			const operation = opBlock.split(/\n {4}(?:get|post|put|patch|delete):/)[0];
			assert.match(operation, /\n {8}'403':/, `${route} braucht in openapi.yml eine 403-Antwort`);
		}
	});
});

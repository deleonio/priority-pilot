import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Rote Spec-Tests für #1505 AK8 (Spec docs/spec/issue-1505.md) — validiert, dass openapi.yml die
 * vier Abo-Routen (POST /billing/subscriptions, POST /billing/subscriptions/cancel,
 * POST /billing/subscriptions/change, GET /billing/invoices, GET /billing/invoices/{id}) sowie das
 * erweiterte `subscription`-Schema in `/auth/me` beschreibt.
 *
 * Rot, bis die Impl-Phase openapi.yml ergänzt. String-Matching im YAML-Rohformat (Muster
 * `openapi-pillar-crud.test.ts`, #438) — kein zusätzliches YAML-Package nötig. KEIN Produktivcode.
 */
describe('#1505 OpenAPI: Abo-Routen + /auth/me-Erweiterung (AK8)', () => {
	const ymlPath = join(import.meta.dirname, '..', '..', '..', 'openapi.yml');
	const yml = readFileSync(ymlPath, 'utf-8');

	/** Extrahiert den YAML-Block ab einem Top-Level-Pfad bis zum nächsten Top-Level-Pfad. */
	const extractPathBlock = (path: string): string => {
		const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const start = yml.search(new RegExp(`\\n {2}${escaped}:\\s*\\n`));
		if (start === -1) return '';
		const nextPath = yml.indexOf('\n  /', start + 1);
		return yml.slice(start, nextPath === -1 ? undefined : nextPath);
	};

	const subscriptionsBlock = extractPathBlock('/billing/subscriptions');
	const cancelBlock = extractPathBlock('/billing/subscriptions/cancel');
	const changeBlock = extractPathBlock('/billing/subscriptions/change');
	const invoicesBlock = extractPathBlock('/billing/invoices');
	const invoiceByIdBlock = extractPathBlock('/billing/invoices/{id}');
	const authMeBlock = extractPathBlock('/auth/me');

	it('definiert POST /billing/subscriptions (AK1/AK2)', () => {
		assert.ok(subscriptionsBlock.length > 0, '/billing/subscriptions muss im Vertrag existieren');
		assert.match(subscriptionsBlock, /\n {4}post:/, '/billing/subscriptions muss eine POST-Methode definieren');
		assert.match(subscriptionsBlock, /'201':/, 'POST /billing/subscriptions muss 201 definieren (AK1)');
		assert.match(subscriptionsBlock, /'409':/, 'POST /billing/subscriptions muss 409 definieren (AK2)');
	});

	it('definiert POST /billing/subscriptions/cancel (AK3)', () => {
		assert.ok(cancelBlock.length > 0, '/billing/subscriptions/cancel muss im Vertrag existieren');
		assert.match(cancelBlock, /\n {4}post:/, '/billing/subscriptions/cancel muss eine POST-Methode definieren');
	});

	it('definiert POST /billing/subscriptions/change (AK4)', () => {
		assert.ok(changeBlock.length > 0, '/billing/subscriptions/change muss im Vertrag existieren');
		assert.match(changeBlock, /\n {4}post:/, '/billing/subscriptions/change muss eine POST-Methode definieren');
	});

	it('definiert GET /billing/invoices (AK5)', () => {
		assert.ok(invoicesBlock.length > 0, '/billing/invoices muss im Vertrag existieren');
		assert.match(invoicesBlock, /\n {4}get:/, '/billing/invoices muss eine GET-Methode definieren');
	});

	it('definiert GET /billing/invoices/{id} mit 404 bei fremder Rechnung (AK5)', () => {
		assert.ok(invoiceByIdBlock.length > 0, '/billing/invoices/{id} muss im Vertrag existieren');
		assert.match(invoiceByIdBlock, /\n {4}get:/, '/billing/invoices/{id} muss eine GET-Methode definieren');
		assert.match(invoiceByIdBlock, /'404':/, '/billing/invoices/{id} muss 404 definieren (AK5)');
	});

	it('alle vier Abo-Routen tragen requireAuth (kein "security: []", Session-Pflicht, AK7)', () => {
		for (const [name, block] of [
			['/billing/subscriptions', subscriptionsBlock],
			['/billing/subscriptions/cancel', cancelBlock],
			['/billing/subscriptions/change', changeBlock],
			['/billing/invoices', invoicesBlock],
		] as const) {
			assert.doesNotMatch(block, /security:\s*\[\]/, `${name} darf nicht als öffentlich (security: []) markiert sein`);
		}
	});

	it('/auth/me ist im Vertrag beschrieben und das subscription-Schema trägt pendingPlan/pendingPlanEffectiveAt/graceUntil (AK6)', () => {
		assert.ok(authMeBlock.length > 0, '/auth/me muss im Vertrag existieren');
		for (const field of ['pendingPlan', 'pendingPlanEffectiveAt', 'graceUntil']) {
			assert.ok(yml.includes(`${field}:`), `Das subscription-Schema muss "${field}" tragen`);
		}
	});
});

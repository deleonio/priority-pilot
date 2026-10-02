import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * OpenAPI-Pfad-Assertions zu den Admin-Rechnungs-Routen (#1958, Spec docs/spec/issue-1958.md —
 * Fixup Finding 2): openapi.yml beschreibt beide neuen Admin-Pfadblöcke
 * (/admin/users/{id}/invoices, /admin/users/{id}/invoices/{invoiceId}/pdf) mit GET und den
 * Antwortcodes 200/400/403/404 wie implementiert.
 *
 * String-Matching im YAML-Rohformat (Muster `openapi-billing-subscriptions.test.ts`, #1505) —
 * kein zusätzliches YAML-Package nötig. KEIN Produktivcode.
 */
describe('#1958 OpenAPI: Admin-Rechnungs-Routen', () => {
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

	const invoicesBlock = extractPathBlock('/admin/users/{id}/invoices');
	const pdfBlock = extractPathBlock('/admin/users/{id}/invoices/{invoiceId}/pdf');

	it('definiert GET /admin/users/{id}/invoices mit 200/400/403', () => {
		assert.ok(invoicesBlock.length > 0, '/admin/users/{id}/invoices muss im Vertrag existieren');
		assert.match(invoicesBlock, /\n {4}get:/, '/admin/users/{id}/invoices muss eine GET-Methode definieren');
		assert.match(invoicesBlock, /'200':/, '/admin/users/{id}/invoices muss 200 definieren');
		assert.match(invoicesBlock, /'400':/, '/admin/users/{id}/invoices muss 400 definieren');
		assert.match(invoicesBlock, /'403':/, '/admin/users/{id}/invoices muss 403 definieren');
	});

	it('definiert GET /admin/users/{id}/invoices/{invoiceId}/pdf mit 200/400/403/404', () => {
		assert.ok(pdfBlock.length > 0, '/admin/users/{id}/invoices/{invoiceId}/pdf muss im Vertrag existieren');
		assert.match(pdfBlock, /\n {4}get:/, '/admin/users/{id}/invoices/{invoiceId}/pdf muss eine GET-Methode definieren');
		assert.match(pdfBlock, /'200':/, '/admin/users/{id}/invoices/{invoiceId}/pdf muss 200 definieren');
		assert.match(pdfBlock, /'400':/, '/admin/users/{id}/invoices/{invoiceId}/pdf muss 400 definieren');
		assert.match(pdfBlock, /'403':/, '/admin/users/{id}/invoices/{invoiceId}/pdf muss 403 definieren');
		assert.match(pdfBlock, /'404':/, '/admin/users/{id}/invoices/{invoiceId}/pdf muss 404 definieren');
	});

	it('beide Admin-Rechnungs-Routen tragen requireRole (kein "security: []", Session-Pflicht)', () => {
		for (const [name, block] of [
			['/admin/users/{id}/invoices', invoicesBlock],
			['/admin/users/{id}/invoices/{invoiceId}/pdf', pdfBlock],
		] as const) {
			assert.doesNotMatch(block, /security:\s*\[\]/, `${name} darf nicht als öffentlich (security: []) markiert sein`);
		}
	});
});

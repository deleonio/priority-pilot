import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Rote Spec-Tests für #438: Validiert, dass openapi.yml die drei Pillar-CRUD-Pfade
 * (POST /pillars, PATCH /pillars/:id, DELETE /pillars/:id) definiert.
 *
 * Diese Tests schlagen aktuell fehl (ROT), weil die Pfade im OpenAPI-Vertrag noch
 * nicht definiert sind. Sie werden grün, sobald die Umsetzung (Implementierung) die
 * Pfade im openapi.yml ergänzt hat.
 *
 * Die Validierung erfolgt über String-Matching im YAML-Rohformat, um keine
 * zusätzliche Abhängigkeit zu benötigen (bewusst kein 'yaml'-Package-Import).
 */
describe('#438 OpenAPI: Pillar-CRUD-Pfade (AK1)', () => {
	const ymlPath = join(import.meta.dirname, '..', '..', '..', 'openapi.yml');
	const yml = readFileSync(ymlPath, 'utf-8');

	it('definiert POST /pillars zum Anlegen einer neuen Säule', () => {
		const hasPostPillars = /^  \/pillars:\s*$/m.test(yml) && /\n    post:/m.test(yml);
		assert.ok(hasPostPillars, '/pillars muss im OpenAPI-Vertrag eine POST-Methode definieren');
	});

	it('POST /pillars hat operationId createPillar', () => {
		// operationId muss innerhalb des POST-Blocks unter /pillars definiert sein.
		const hasCreatePillarOp = /operationId:\s*createPillar/m.test(yml);
		assert.ok(hasCreatePillarOp, 'POST /pillars muss operationId "createPillar" haben');
	});

	it('POST /pillars erwartet einen Request-Body', () => {
		const hasRequestBody = /requestBody:/m.test(yml);
		assert.ok(hasRequestBody, 'POST /pillars braucht einen requestBody (true)');
	});

	it('POST /pillars antwortet mit 201 und 409', () => {
		// 201 (Created) und 409 (Conflict) muessen als Responses definiert sein.
		const has201 = /'201':/m.test(yml);
		const has409 = /'409':/m.test(yml);
		assert.ok(has201, 'POST /pillars muss die Status-Code-Antwort 201 definieren');
		assert.ok(has409, 'POST /pillars muss die Status-Code-Antwort 409 (Namenskonflikt) definieren');
	});

	it('definiert PATCH /pillars/{id} zum Aktualisieren einer Säule', () => {
		const hasPatchPillarsId = /^  \/pillars\/\{id\}:\s*$/m.test(yml) && /\n    patch:/m.test(yml);
		assert.ok(hasPatchPillarsId, '/pillars/{id} muss im OpenAPI-Vertrag eine PATCH-Methode definieren');
	});

	it('PATCH /pillars/{id} hat operationId updatePillar', () => {
		const hasUpdatePillarOp = /operationId:\s*updatePillar/m.test(yml);
		assert.ok(hasUpdatePillarOp, 'PATCH /pillars/{id} muss operationId "updatePillar" haben');
	});

	it('PATCH /pillars/{id} antwortet mit 200, 404 und 409', () => {
		const has200 = /'200':/m.test(yml);
		const has404 = /'404':/m.test(yml);
		assert.ok(has200, 'PATCH /pillars/{id} muss 200 (Erfolg) definieren');
		assert.ok(has404, 'PATCH /pillars/{id} muss 404 (nicht gefunden) definieren');
		// 409 muss explizit für PATCH definiert sein (nicht nur POST)
		const has409count = (yml.match(/'409':/g) ?? []).length;
		assert.ok(
			has409count >= 2,
			'PATCH /pillars/{id} muss 409 (Namenskonflikt) definieren (mind. 2x 409 im gesamten Spec)',
		);
	});

	it('definiert DELETE /pillars/{id} zum Löschen einer Säule', () => {
		const hasDeletePillarsId = /^  \/pillars\/\{id\}:\s*$/m.test(yml) && /\n    delete:/m.test(yml);
		assert.ok(hasDeletePillarsId, '/pillars/{id} muss im OpenAPI-Vertrag eine DELETE-Methode definieren');
	});

	it('DELETE /pillars/{id} hat operationId deletePillar', () => {
		const hasDeletePillarOp = /operationId:\s*deletePillar/m.test(yml);
		assert.ok(hasDeletePillarOp, 'DELETE /pillars/{id} muss operationId "deletePillar" haben');
	});

	it('DELETE /pillars/{id} antwortet mit 204 (No Content) bei Erfolg', () => {
		const has204 = /'204':/m.test(yml);
		assert.ok(has204, 'DELETE /pillars/{id} muss 204 (No Content) bei Erfolg definieren');
	});

	it('DELETE /pillars/{id} antwortet mit 404 bei nicht gefundener Säule', () => {
		const has404 = /'404':/m.test(yml);
		assert.ok(has404, 'DELETE /pillars/{id} muss 404 (nicht gefunden) definieren');
	});
});

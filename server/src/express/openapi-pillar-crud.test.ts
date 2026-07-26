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

	/**
	 * Extrahiert den YAML-Block ab einem Top-Level-Pfad bis zum naechsten
	 * Top-Level-Pfad. So matchen Status-Code-Regexes nur innerhalb des
	 * /pillars:-Abschnitts und nicht global ueber die gesamte Spec.
	 */
	const extractPathBlock = (path: string): string => {
		const start = yml.indexOf(`\n  ${path}:`);
		if (start === -1) return '';
		const nextPath = yml.indexOf('\n  /', start + 1);
		return yml.slice(start, nextPath === -1 ? undefined : nextPath);
	};

	const pillarsBlock = extractPathBlock('/pillars');
	const pillarsIdBlock = extractPathBlock('/pillars/{id}');

	it('definiert POST /pillars zum Anlegen einer neuen Säule', () => {
		const hasPostPillars = /^ {2}\/pillars:\s*$/m.test(yml) && /\n {4}post:/m.test(yml);
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
		// 201 (Created) und 409 (Conflict) muessen innerhalb des /pillars-Blocks definiert sein.
		const has201 = /'201':/m.test(pillarsBlock);
		const has409 = /'409':/m.test(pillarsBlock);
		assert.ok(has201, 'POST /pillars muss die Status-Code-Antwort 201 definieren');
		assert.ok(has409, 'POST /pillars muss die Status-Code-Antwort 409 (Namenskonflikt) definieren');
	});

	it('definiert PATCH /pillars/{id} zum Aktualisieren einer Säule', () => {
		const hasPatchPillarsId = /^ {2}\/pillars\/\{id\}:\s*$/m.test(yml) && /\n {4}patch:/m.test(yml);
		assert.ok(hasPatchPillarsId, '/pillars/{id} muss im OpenAPI-Vertrag eine PATCH-Methode definieren');
	});

	it('PATCH /pillars/{id} hat operationId updatePillar', () => {
		const hasUpdatePillarOp = /operationId:\s*updatePillar/m.test(yml);
		assert.ok(hasUpdatePillarOp, 'PATCH /pillars/{id} muss operationId "updatePillar" haben');
	});

	it('PATCH /pillars/{id} antwortet mit 200, 404 und 409', () => {
		const has200 = /'200':/m.test(pillarsIdBlock);
		const has404 = /'404':/m.test(pillarsIdBlock);
		assert.ok(has200, 'PATCH /pillars/{id} muss 200 (Erfolg) definieren');
		assert.ok(has404, 'PATCH /pillars/{id} muss 404 (nicht gefunden) definieren');
		// 409 muss explizit für PATCH definiert sein (nicht nur POST)
		const has409count = (pillarsIdBlock.match(/'409':/g) ?? []).length;
		assert.ok(has409count >= 1, 'PATCH /pillars/{id} muss 409 (Namenskonflikt) definieren');
	});

	it('definiert DELETE /pillars/{id} zum Löschen einer Säule', () => {
		const hasDeletePillarsId = /^ {2}\/pillars\/\{id\}:\s*$/m.test(yml) && /\n {4}delete:/m.test(yml);
		assert.ok(hasDeletePillarsId, '/pillars/{id} muss im OpenAPI-Vertrag eine DELETE-Methode definieren');
	});

	it('DELETE /pillars/{id} hat operationId deletePillar', () => {
		const hasDeletePillarOp = /operationId:\s*deletePillar/m.test(yml);
		assert.ok(hasDeletePillarOp, 'DELETE /pillars/{id} muss operationId "deletePillar" haben');
	});

	it('DELETE /pillars/{id} antwortet mit 204 (No Content) bei Erfolg', () => {
		const has204 = /'204':/m.test(pillarsIdBlock);
		assert.ok(has204, 'DELETE /pillars/{id} muss 204 (No Content) bei Erfolg definieren');
	});

	it('DELETE /pillars/{id} antwortet mit 404 bei nicht gefundener Säule', () => {
		const has404 = /'404':/m.test(pillarsIdBlock);
		assert.ok(has404, 'DELETE /pillars/{id} muss 404 (nicht gefunden) definieren');
	});
});

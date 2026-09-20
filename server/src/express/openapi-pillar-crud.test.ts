import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * OpenAPI-Vertrag der Pillar-CRUD-Pfade (#438 → gesperrt seit #1573): Validiert, dass
 * openapi.yml die drei Pfade (POST /pillars, PATCH /pillars/{id}, DELETE /pillars/{id})
 * als gesperrte Operationen dokumentiert — antwortet immer 403 (PillarsLocked), keine
 * Erfolgs-Statuscodes mehr. Die Operationen bleiben im Vertrag, weil die Routen
 * existieren und die Sperre bewusst 403 (nicht 404/405) liefert.
 *
 * Die Validierung erfolgt über String-Matching im YAML-Rohformat, um keine
 * zusätzliche Abhängigkeit zu benötigen (bewusst kein 'yaml'-Package-Import).
 */
describe('#1573 OpenAPI: Pillar-CRUD-Pfade gesperrt (403)', () => {
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

	it('definiert POST /pillars als gesperrte Operation', () => {
		const hasPostPillars = /^ {2}\/pillars:\s*$/m.test(yml) && /\n {4}post:/m.test(pillarsBlock);
		assert.ok(hasPostPillars, '/pillars muss im OpenAPI-Vertrag eine POST-Methode definieren');
	});

	it('POST /pillars hat operationId createPillar', () => {
		const hasCreatePillarOp = /operationId:\s*createPillar/m.test(pillarsBlock);
		assert.ok(hasCreatePillarOp, 'POST /pillars muss operationId "createPillar" haben');
	});

	it('POST /pillars dokumentiert nur 403 (PillarsLocked), keinen Erfolgs-Status', () => {
		assert.ok(/'403':/m.test(pillarsBlock), 'POST /pillars muss die 403-Sperre definieren');
		assert.ok(
			/PillarsLocked/m.test(pillarsBlock),
			'POST /pillars muss auf die Response-Komponente PillarsLocked verweisen',
		);
		assert.ok(!/'201':/.test(pillarsBlock), 'POST /pillars darf 201 (Anlegen) nicht mehr dokumentieren');
		assert.ok(!/'409':/.test(pillarsBlock), 'POST /pillars darf 409 (Namenskonflikt) nicht mehr dokumentieren');
	});

	it('definiert PATCH /pillars/{id} als gesperrte Operation', () => {
		const hasPatchPillarsId = /^ {2}\/pillars\/\{id\}:\s*$/m.test(yml) && /\n {4}patch:/m.test(pillarsIdBlock);
		assert.ok(hasPatchPillarsId, '/pillars/{id} muss im OpenAPI-Vertrag eine PATCH-Methode definieren');
	});

	it('PATCH /pillars/{id} hat operationId updatePillar', () => {
		const hasUpdatePillarOp = /operationId:\s*updatePillar/m.test(pillarsIdBlock);
		assert.ok(hasUpdatePillarOp, 'PATCH /pillars/{id} muss operationId "updatePillar" haben');
	});

	it('PATCH /pillars/{id} dokumentiert nur 403, keinen Erfolgs-Status', () => {
		assert.ok(/'403':/m.test(pillarsIdBlock), 'PATCH /pillars/{id} muss die 403-Sperre definieren');
		assert.ok(!/'200':/.test(pillarsIdBlock), 'PATCH /pillars/{id} darf 200 (Erfolg) nicht mehr dokumentieren');
		assert.ok(!/'404':/.test(pillarsIdBlock), 'PATCH /pillars/{id} darf 404 (nicht gefunden) nicht mehr dokumentieren');
		assert.ok(!/'409':/.test(pillarsIdBlock), 'PATCH /pillars/{id} darf 409 (Namenskonflikt) nicht mehr dokumentieren');
	});

	it('definiert DELETE /pillars/{id} als gesperrte Operation', () => {
		const hasDeletePillarsId = /^ {2}\/pillars\/\{id\}:\s*$/m.test(yml) && /\n {4}delete:/m.test(pillarsIdBlock);
		assert.ok(hasDeletePillarsId, '/pillars/{id} muss im OpenAPI-Vertrag eine DELETE-Methode definieren');
	});

	it('DELETE /pillars/{id} hat operationId deletePillar', () => {
		const hasDeletePillarOp = /operationId:\s*deletePillar/m.test(pillarsIdBlock);
		assert.ok(hasDeletePillarOp, 'DELETE /pillars/{id} muss operationId "deletePillar" haben');
	});

	it('DELETE /pillars/{id} dokumentiert nur 403, keinen Erfolgs-Status', () => {
		assert.ok(/'403':/m.test(pillarsIdBlock), 'DELETE /pillars/{id} muss die 403-Sperre definieren');
		assert.ok(!/'204':/.test(pillarsIdBlock), 'DELETE /pillars/{id} darf 204 (No Content) nicht mehr dokumentieren');
		assert.ok(
			!/'404':/.test(pillarsIdBlock),
			'DELETE /pillars/{id} darf 404 (nicht gefunden) nicht mehr dokumentieren',
		);
	});

	it('dokumentiert die Sperre als Response-Komponente PillarsLocked mit Hinweistext', () => {
		assert.ok(/PillarsLocked:/.test(yml), 'Response-Komponente PillarsLocked muss definiert sein');
		assert.ok(
			/Gesperrt \(#1573\)/.test(yml),
			'Die PillarsLocked-Komponente muss die Sperre (#1573) im Beschreibungstext nennen',
		);
	});
});

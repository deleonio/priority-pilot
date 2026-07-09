import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Vertrag-Tests — Selektives Cross-Phase Session-Resume (Session-Cross-Phase-Resume-Plan).
//
// Diese Tests sichern die Cross-Phase-Fallback-Logik:
// - session-restore action hat den neuen Input fallback-phase
// - Two-Try-Logik (eigene Phase zuerst, dann Fallback)
// - Korrekte Verdrahtung in spec.yml (fallback: analyse) und implement.yml (fallback: spec)
// - Kein Fallback in triage.yml, pr-review.yml, pr-fixup.yml (Kreuzverhör-Unabhängigkeit)
// - Save-Isolation bleibt erhalten
//
// Testebene: statische YAML-Datei-Checks (node:test via tsx, ci.yml Z. ~103).

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..');

const readWorkflow = (name: string): string => readFileSync(join(REPO_ROOT, '.github', 'workflows', name), 'utf8');
const readAction = (name: string): string => readFileSync(join(REPO_ROOT, '.github', 'actions', name), 'utf8');

// Hilfsfunktion: extrahiert den with:-Block eines bestimmten Steps
const extractWithBlock = (yml: string, stepName: string): string | null => {
	const escapedName = stepName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const stepRegex = new RegExp(`- name:\\s*${escapedName}[\\s\\S]*?with:\\s*([\\s\\S]*?)(?=\\n\\s*- name:|\\n\\s*$)`);
	const match = yml.match(stepRegex);
	return match ? match[1] : null;
};

describe('Session Fallback — session-restore action.yml deklariert neue Properties', () => {
	const actionYml = readAction('session-restore/action.yml');

	it('session-restore/action.yml deklariert fallback-phase Input', () => {
		assert.match(
			actionYml,
			/fallback-phase:/,
			'session-restore muss den Input fallback-phase deklarieren (Cross-Phase-Fallback)',
		);
	});

	it('session-restore/action.yml deklariert restored-from Output', () => {
		assert.match(actionYml, /restored-from:/, 'session-restore muss den Output restored-from deklarieren');
	});

	it('session-restore/action.yml enthaelt FALLBACK_PHASE in env', () => {
		assert.match(actionYml, /FALLBACK_PHASE:/, 'session-restore muss FALLBACK_PHASE Environment Variable deklarieren');
	});
});

describe('Session Fallback — Zwei-Versuch-Logik in session-restore', () => {
	const actionYml = readAction('session-restore/action.yml');

	it('session-restore enthaelt try_phase Hilfsfunktion', () => {
		assert.match(
			actionYml,
			/try_phase\(\)/,
			'session-restore muss try_phase-Funktion für die Zwei-Versuch-Logik enthalten',
		);
	});

	it('try_phase versucht die eigene Phase ($PHASE)', () => {
		assert.match(actionYml, /try_phase/, 'session-restore muss try_phase aufrufen');
	});

	it('miss Funktion mit exit 0 existiert (fail-open)', () => {
		assert.match(actionYml, /miss\(\)/, 'session-restore muss miss-Funktion enthalten');
		assert.match(actionYml, /exit 0/, 'session-restore muss exit 0 in miss verwenden (fail-open)');
	});

	it('UUID-Validierung in try_phase', () => {
		assert.match(actionYml, /0-9a-fA-F/, 'session-restore: try_phase muss UUID-Validierung durchführen');
	});

	it('non-empty Guard in try_phase', () => {
		assert.match(actionYml, /\[ -s/, 'session-restore: try_phase muss non-empty Check durchführen');
	});
});

describe('Session Fallback — Mapping in Workflows', () => {
	it('claude-spec.yml Restore-Step hat phase: spec UND fallback-phase: analyse', () => {
		const yml = readWorkflow('claude-spec.yml');
		const restoreBlock = extractWithBlock(yml, 'Session-Archiv wiederherstellen (Phase spec)');
		assert.ok(restoreBlock, 'claude-spec.yml: Session-Archiv wiederherstellen (Phase spec) Step nicht gefunden');

		assert.match(restoreBlock, /phase:/, 'claude-spec.yml: Restore-Step muss phase haben');
		assert.match(
			restoreBlock,
			/fallback-phase:/,
			'claude-spec.yml: Restore-Step muss fallback-phase haben (Cross-Phase-Fallback)',
		);
		assert.match(restoreBlock, /analyse/, 'claude-spec.yml: Restore-Step muss fallback-phase: analyse enthalten');
	});

	it('claude-implement.yml Restore-Step hat phase: impl UND fallback-phase: spec', () => {
		const yml = readWorkflow('claude-implement.yml');
		const restoreBlock = extractWithBlock(yml, 'Session-Archiv wiederherstellen (Phase impl)');
		assert.ok(restoreBlock, 'claude-implement.yml: Session-Archiv wiederherstellen (Phase impl) Step nicht gefunden');

		assert.match(restoreBlock, /phase:/, 'claude-implement.yml: Restore-Step muss phase haben');
		assert.match(
			restoreBlock,
			/fallback-phase:/,
			'claude-implement.yml: Restore-Step muss fallback-phase haben (Cross-Phase-Fallback)',
		);
		assert.match(restoreBlock, /spec/, 'claude-implement.yml: Restore-Step muss fallback-phase: spec enthalten');
	});
});

describe('Session Fallback — Negativ-Kontrollen', () => {
	it('claude-triage.yml Restore-Step enthält KEIN fallback-phase', () => {
		const yml = readWorkflow('claude-triage.yml');
		const restoreBlock = extractWithBlock(yml, 'Session-Archiv wiederherstellen (Phase analyse)');
		assert.ok(restoreBlock, 'claude-triage.yml: Session-Archiv wiederherstellen (Phase analyse) Step nicht gefunden');

		assert.doesNotMatch(
			restoreBlock,
			/fallback-phase:/,
			'claude-triage.yml: Restore-Step darf KEIN fallback-phase haben (Triage bleibt unabhängig)',
		);
	});

	it('claude-pr-review.yml Restore-Step enthält KEIN fallback-phase', () => {
		const yml = readWorkflow('claude-pr-review.yml');
		const restoreBlock = extractWithBlock(yml, 'Session-Archiv wiederherstellen (Phase review)');
		assert.ok(restoreBlock, 'claude-pr-review.yml: Session-Archiv wiederherstellen (Phase review) Step nicht gefunden');
		assert.doesNotMatch(
			restoreBlock,
			/fallback-phase:/,
			'claude-pr-review.yml: Restore-Step darf KEIN fallback-phase haben (Kreuzverhör-Unabhängigkeit)',
		);
	});

	it('claude-pr-fixup.yml Restore-Step enthält KEIN fallback-phase', () => {
		const yml = readWorkflow('claude-pr-fixup.yml');
		const restoreBlock = extractWithBlock(yml, 'Session-Archiv wiederherstellen (Phase fix)');
		assert.ok(restoreBlock, 'claude-pr-fixup.yml: Session-Archiv wiederherstellen (Phase fix) Step nicht gefunden');
		assert.doesNotMatch(
			restoreBlock,
			/fallback-phase:/,
			'claude-pr-fixup.yml: Restore-Step darf KEIN fallback-phase haben (Kreuzverhör-Unabhängigkeit)',
		);
	});
});

describe('Session Fallback — Save-Isolation-Invariante', () => {
	it('session-save/action.yml schreibt weiterhin nur den eigenen Phasen-Key', () => {
		const saveActionYml = readAction('session-save/action.yml');

		assert.match(saveActionYml, /\$phase/, 'session-save muss den eigenen Phasen-Key ($phase) schreiben');

		assert.doesNotMatch(
			saveActionYml,
			/fallback/,
			'session-save darf KEINE fallback-Variablen referenzieren (Isolation-Invariante)',
		);

		assert.match(saveActionYml, /session_id/, 'session-save muss session_id schreiben');
	});
});

#!/usr/bin/env tsx
/**
 * Schema-Validierung aller GitHub-Workflows und Composite-Actions des Repos.
 *
 * WARUM als Skript und nicht direkt `action-validator <datei>`: Das CLI aus
 * `@action-validator/cli` nimmt GENAU EINE Datei pro Aufruf entgegen (keine Globs, keine
 * Flags) und gibt im Fehlerfall rohes JSON aus. Für die Pipeline bräuchte es sonst eine
 * Shell-Schleife mit 29 Node-Starts und unlesbarer Ausgabe. Dieses Skript nutzt stattdessen
 * direkt die JS-API von `@action-validator/core` (ein WASM-Modul, dasselbe wie im CLI),
 * sammelt alle Befunde über alle Dateien und meldet sie am Stück.
 *
 * Nutzung:
 *   pnpm lint:actions                 # entdeckt alle Ziele selbst
 *   pnpm lint:actions <datei> [...]   # nur die genannten Dateien (lefthook: staged files)
 *
 * Exit-Code 1, sobald mindestens ein echter Befund übrig bleibt — ansonsten 0.
 *
 * Stil-Spiegel von cost-record.ts: Node-Eintritt, ESM, exportierte reine Funktionen.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAction, validateWorkflow, type ValidationError, type ValidationState } from '@action-validator/core';

const HERE = dirname(fileURLToPath(import.meta.url));
/** Repo-Root, falls kein rootDir übergeben wird (zwei Ebenen über .github/scripts). */
const REPO_ROOT = join(HERE, '..', '..');

/** Workflows liegen flach, Composite-Actions je in einem Unterordner als `action.yml`. */
const WORKFLOW_DIR = join('.github', 'workflows');
const ACTION_DIR = join('.github', 'actions');

const isYaml = (file: string): boolean => file.endsWith('.yml') || file.endsWith('.yaml');

/**
 * Dieselbe Heuristik wie im offiziellen CLI: Der Dateiname entscheidet, gegen welches Schema
 * geprüft wird. `action.yml`/`action.yaml` -> Action-Schema, alles andere -> Workflow-Schema.
 * Wird sie geändert, prüfen Composite-Actions gegen das falsche Schema (und umgekehrt).
 */
export const classifyTarget = (path: string): 'action' | 'workflow' =>
	path.endsWith('action.yml') || path.endsWith('action.yaml') ? 'action' : 'workflow';

/** Alle YAML-Dateien unterhalb von `dir` (rekursiv), als repo-relative Pfade. */
const listYamlFiles = (rootDir: string, dir: string): string[] => {
	const abs = join(rootDir, dir);
	let entries;
	try {
		entries = readdirSync(abs, { withFileTypes: true, recursive: true });
	} catch {
		return []; // Verzeichnis existiert (noch) nicht — kein Fehler, nur nichts zu prüfen.
	}
	return entries
		.filter((entry) => entry.isFile() && isYaml(entry.name))
		.map((entry) => relative(rootDir, join(entry.parentPath, entry.name)))
		.sort();
};

/**
 * Prüfziele: alle Workflows plus alle Composite-Actions. Sortiert, damit die Ausgabe
 * zwischen Läufen stabil bleibt.
 */
export function collectTargets(rootDir: string = REPO_ROOT): string[] {
	const actions = listYamlFiles(rootDir, ACTION_DIR).filter((file) => classifyTarget(file) === 'action');
	return [...listYamlFiles(rootDir, WORKFLOW_DIR), ...actions];
}

/**
 * BEKANNTE SCHEMA-LÜCKE (einzige Ausnahme, bewusst eng gefasst).
 *
 * `concurrency.queue: max` ist eine echte, von GitHub akzeptierte Einstellung und in den
 * Phasen-Workflows (01–07, gate-sweep, guide-sync) tragende Logik: ohne sie hält GitHub pro
 * Gruppe nur EINEN pending-Run und verwirft gestapelte Läufe still. Das im WASM-Modul
 * mitgelieferte Schema von @action-validator 0.6.0 kennt den Key noch nicht und meldet
 * `Additional property 'queue' is not allowed`.
 *
 * Der Filter greift NUR, wenn der gesamte `/concurrency`-Befund aus genau diesem Rauschen
 * besteht (Zweig „string" scheitert am Typ, Zweig „objekt" allein am `queue`). Jede weitere
 * Abweichung im selben Block — Tippfehler, fehlendes `group`, unbekannter Key — lässt den
 * Befund stehen und die Prüfung rot werden.
 *
 * ENTFERNEN, sobald @action-validator ein Schema mit `concurrency.queue` ausliefert: dann
 * meldet dieses Skript die Ausnahme als „unbenutzt" (siehe Report unten).
 */
const isConcurrencyQueueNoise = (error: ValidationError): boolean => {
	const path = 'path' in error ? error.path : undefined;
	if (path !== '/concurrency') return false;
	if (error.code === 'wrong_type') return true; // Zweig „concurrency ist ein String"
	return error.code === 'properties' && error.detail === "Additional property 'queue' is not allowed";
};

export const isKnownSchemaGap = (error: ValidationError): boolean =>
	error.code === 'one_of' &&
	'path' in error &&
	error.path === '/concurrency' &&
	Array.isArray(error.states) &&
	error.states.length > 0 &&
	error.states.every((state) => state.errors.length > 0 && state.errors.every(isConcurrencyQueueNoise));

export type FileReport = {
	file: string;
	actionType: ValidationState['actionType'];
	errors: ValidationError[];
	/** Wie viele Befunde die dokumentierte Schema-Lücke oben geschluckt hat. */
	suppressed: number;
};

/** Validiert einen einzelnen YAML-Inhalt und trennt echte Befunde von der bekannten Lücke. */
export function validateSource(file: string, contents: string): FileReport {
	const result = classifyTarget(file) === 'action' ? validateAction(contents) : validateWorkflow(contents);
	const errors = result.errors.filter((error) => !isKnownSchemaGap(error));
	return {
		file,
		actionType: result.actionType,
		errors,
		suppressed: result.errors.length - errors.length,
	};
}

/**
 * Ein Befund als Textblock. Bei `one_of` trägt die oberste Zeile nur „OneOf conditions are not
 * met" — der eigentliche Grund (unbekannter Key, falscher Typ) steckt in den `states`, je einer
 * pro gescheiterter Schema-Alternative. Die werden eingerückt mitgerendert, sonst ist ein roter
 * CI-Lauf nicht debuggbar.
 */
const formatError = (error: ValidationError, indent = '    '): string[] => {
	const path = 'path' in error && error.path ? error.path : '(dokument)';
	const location = 'location' in error && error.location ? ` (Zeile ${error.location.line})` : '';
	const detail = error.detail ? `: ${error.detail}` : '';
	const lines = [`${indent}${path}${location} — ${error.title}${detail} [${error.code}]`];

	const states = 'states' in error ? error.states : undefined;
	states?.forEach((state, index) => {
		lines.push(`${indent}  Alternative ${index + 1}:`);
		for (const nested of state.errors) lines.push(...formatError(nested, `${indent}    `));
	});
	return lines;
};

/** Menschenlesbarer Report. Gibt zurück, ob die Prüfung bestanden ist. */
export function formatReport(reports: FileReport[]): { ok: boolean; lines: string[] } {
	const failed = reports.filter((report) => report.errors.length > 0);
	const suppressed = reports.reduce((sum, report) => sum + report.suppressed, 0);
	const lines: string[] = [];

	for (const report of failed) {
		lines.push(`  ✖ ${report.file} (${report.actionType}, ${report.errors.length} Befund(e))`);
		for (const error of report.errors) lines.push(...formatError(error));
	}

	if (failed.length === 0) {
		lines.push(`  ✔ ${reports.length} Datei(en) valide.`);
	}
	// Transparenz statt stiller Unterdrückung: die Ausnahme wird immer beziffert. Steht hier 0,
	// ist sie überflüssig geworden und gehört samt isKnownSchemaGap entfernt.
	lines.push(`  ℹ Bekannte Schema-Lücke (concurrency.queue) unterdrückt: ${suppressed} Befund(e).`);

	return { ok: failed.length === 0, lines };
}

/** Prüft die übergebenen Dateien (oder alle Ziele) und liefert die Reports. */
export function validateFiles(files: string[], rootDir: string = REPO_ROOT): FileReport[] {
	return files.map((file) => validateSource(file, readFileSync(join(rootDir, file), 'utf8')));
}

/**
 * Nur Ziele unterhalb von .github/workflows bzw. .github/actions durchlassen — lefthook
 * reicht bei einem Commit über mehrere Ordner auch fremde YAML-Dateien (z. B. openapi.yml)
 * herein, die gegen kein Actions-Schema passen.
 */
export const isValidationTarget = (file: string): boolean => {
	const normalized = file.split(/[\\/]/).join(sep);
	if (!isYaml(normalized)) return false;
	if (normalized.startsWith(`${WORKFLOW_DIR}${sep}`)) return true;
	return normalized.startsWith(`${ACTION_DIR}${sep}`) && classifyTarget(normalized) === 'action';
};

const main = (argv: string[]): number => {
	const explicit = argv.filter(isValidationTarget);
	// Argumente ohne Prüfziel (z. B. lefthook übergibt nur geänderte Frontend-YAMLs) sind kein
	// Fehler — dann gibt es schlicht nichts zu tun. Ganz ohne Argumente wird alles entdeckt.
	if (argv.length > 0 && explicit.length === 0) {
		console.log('action-validator: keine Workflow-/Action-Dateien in der Auswahl — übersprungen.');
		return 0;
	}
	const files = explicit.length > 0 ? explicit : collectTargets();
	const { ok, lines } = formatReport(validateFiles(files));
	console.log(`action-validator: ${files.length} Datei(en) geprüft`);
	console.log(lines.join('\n'));
	return ok ? 0 : 1;
};

// Nur ausführen, wenn direkt gestartet (Import in Tests bleibt nebenwirkungsfrei).
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
	process.exit(main(process.argv.slice(2)));
}

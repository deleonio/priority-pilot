/**
 * Rote Spec-Tests — Issue #253: "Triage-Workflow bei Entfernen von ai:to-big-issue auslösen"
 * --------------------------------------------------------------------------------------------
 * Aktuell feuert claude-triage.yml nur bei `opened` und bei Entfernen von `ai:analyzed`.
 * Nach dem Aufteilen eines zu-großen Issues setzt der Mensch `ai:to-big-issue` manuell und
 * entfernt es wieder — bisher passiert dann nichts. Gefordert ist ein dritter Trigger:
 * Entfernen von `ai:to-big-issue` startet die Triage neu, unabhängig davon, ob `ai:analyzed`
 * noch gesetzt ist.
 *
 * Diese Tests prüfen die Struktur von `.github/workflows/claude-triage.yml` sowie die
 * Dokumentation in `AGENTS.md`. Sie sind heute ROT (der Trigger fehlt) und werden GRÜN,
 * sobald die Umsetzung die YAML-Bedingung und die Kommentare entsprechend anpasst.
 *
 * Quelle: KI-Analyse-Block Issue #253, Akzeptanzkriterien AK-1 bis AK-4.
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');

const workflowPath = resolve(repoRoot, '.github/workflows/claude-triage.yml');
const agentsPath = resolve(repoRoot, 'AGENTS.md');

let workflowContent: string;
let agentsContent: string;

before(() => {
	workflowContent = readFileSync(workflowPath, 'utf-8');
	agentsContent = readFileSync(agentsPath, 'utf-8');
});

describe('AK-1: Entfernen von ai:to-big-issue löst den Triage-Workflow aus', () => {
	it('die if:-Bedingung enthält einen Zweig für unlabeled + ai:to-big-issue', () => {
		// Der neue Trigger: action == 'unlabeled' AND label.name == 'ai:to-big-issue'
		assert.match(
			workflowContent,
			/github\.event\.label\.name\s*==\s*['"]ai:to-big-issue['"]/,
			'claude-triage.yml if:-Bedingung muss "github.event.label.name == \'ai:to-big-issue\'" enthalten',
		);
	});

	it('der ai:to-big-issue-Zweig ist mit dem unlabeled-Action-Check verknüpft', () => {
		// Der Trigger muss explizit prüfen, dass eine unlabeled-Action stattfand,
		// und dann das Label ai:to-big-issue matchen.
		const unlabeledWithTooBig =
			/github\.event\.action\s*==\s*['"]unlabeled['"]\s*&&\s*github\.event\.label\.name\s*==\s*['"]ai:to-big-issue['"]/s;
		assert.match(
			workflowContent,
			unlabeledWithTooBig,
			'Der ai:to-big-issue-Trigger muss action == "unlabeled" && label.name == "ai:to-big-issue" kombinieren',
		);
	});
});

describe('AK-2: Trigger funktioniert auch wenn ai:analyzed noch gesetzt ist', () => {
	it('!contains(ai:analyzed) ist NICHT mehr als globale Top-Level-Bedingung über allen Zweigen', () => {
		// Laut Analyse muss !contains(ai:analyzed) aus dem gemeinsamen Prädikat in den
		// opened-Zweig verschoben werden, damit der ai:to-big-issue-Trigger auch dann greift,
		// wenn ai:analyzed noch vorhanden ist.
		//
		// Wir prüfen, dass die globale if:-Bedingung NICHT die Kombination
		// "state == 'open' && !contains(ai:analyzed) && (...)" enthält — d. h. das
		// !contains darf nicht mehr auf der gleichen Ebene wie state == 'open' stehen,
		// OHNE dass danach ein OR-Zweig folgt, der ai:to-big-issue abdeckt.
		//
		// Einfacher Proxy-Test: Die !contains-Prüfung muss innerhalb des opened-Zweigs stehen,
		// nicht als eigenständige Zeile VOR dem OR-Block.
		const globalContainsPattern =
			/github\.event\.issue\.state\s*==\s*['"]open['"]\s*&&\s*!contains\(github\.event\.issue\.labels\.\*\.name,\s*['"]ai:analyzed['"]\)\s*&&\s*\(/s;
		assert.doesNotMatch(
			workflowContent,
			globalContainsPattern,
			'!contains(ai:analyzed) darf nicht mehr als globale Bedingung vor dem gesamten OR-Block stehen — ' +
				'es muss in den opened-Zweig verschoben worden sein, damit ai:to-big-issue-Removal auch mit ai:analyzed greift',
		);
	});

	it('der opened-Zweig behält die !contains(ai:analyzed)-Prüfung', () => {
		// Die Schutz-Bedingung für opened bleibt erhalten — nur innerhalb des opened-Zweigs.
		// Wir prüfen, dass !contains(ai:analyzed) noch irgendwo im opened-Kontext vorkommt.
		assert.match(
			workflowContent,
			/!contains\(github\.event\.issue\.labels\.\*\.name,\s*['"]ai:analyzed['"]\)/,
			'!contains(ai:analyzed) muss im opened-Zweig erhalten bleiben',
		);
	});
});

describe('AK-3: Vorhandene Trigger bleiben unverändert funktionsfähig (Regression)', () => {
	it('opened-Trigger ist noch vorhanden', () => {
		assert.match(
			workflowContent,
			/github\.event\.action\s*==\s*['"]opened['"]/,
			'Der opened-Trigger muss weiterhin vorhanden sein',
		);
	});

	it('ai:analyzed-Removal-Trigger ist noch vorhanden', () => {
		assert.match(
			workflowContent,
			/github\.event\.label\.name\s*==\s*['"]ai:analyzed['"]/,
			'Der ai:analyzed-Removal-Trigger muss weiterhin vorhanden sein',
		);
	});

	it('der workflow on.issues.types enthält weiterhin unlabeled', () => {
		assert.match(
			workflowContent,
			/types:\s*\[.*unlabeled.*\]/s,
			'Der Workflow-Event-Trigger types muss unlabeled enthalten',
		);
	});
});

describe('AK-4: Dokumentation nennt den neuen Trigger', () => {
	it('Workflow-Header-Kommentar erwähnt ai:to-big-issue als Auslöser', () => {
		// Der Header-Kommentar (Zeilen 3–15) soll den neuen Trigger benennen.
		assert.match(
			workflowContent,
			/ai:to-big-issue/,
			'claude-triage.yml Kommentar-Block muss "ai:to-big-issue" als Auslöser erwähnen',
		);
	});

	it('AGENTS.md erwähnt ai:to-big-issue als Triage-Trigger', () => {
		assert.match(agentsContent, /ai:to-big-issue/, 'AGENTS.md muss "ai:to-big-issue" als Triage-Auslöser aufführen');
	});

	it('AGENTS.md Triage-Beschreibung nennt Entfernen von ai:to-big-issue', () => {
		// Der Abschnitt über den Triage-Workflow in AGENTS.md soll den neuen Trigger dokumentieren.
		assert.match(
			agentsContent,
			/ai:to-big-issue.*entfernt|entfernt.*ai:to-big-issue/is,
			'AGENTS.md muss erklären, dass Entfernen von ai:to-big-issue die Triage auslöst',
		);
	});
});

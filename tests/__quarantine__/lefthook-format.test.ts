import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Vertrag-Tests für Issue #417 — Git-Hook soll gestagte Dateien automatisch formatieren.
//
// AK1: lefthook.yml enthält im pre-commit einen Prettier-Command im Write-Modus
// über {staged_files} mit stage_fixed: true und keinen reinen --check mehr für
// den Staged-Format-Schritt.
//
// AK2/AK3: Integrations- und Scope-Verifikation (manuell, da kein git-Hook-Testrahmen
// auf der Backend/Frontend/e2e-Ebene verfügbar ist — analog "reines Styling → visuell").
//
// AK4: CI-Parität (bestehend, pnpm exec prettier --check . in ci.yml).

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..');
const LEFTHOOK_PATH = join(REPO_ROOT, 'lefthook.yml');

const readLefthook = (): string => readFileSync(LEFTHOOK_PATH, 'utf8');

describe('AK1 — lefthook.yml: Prettier im Write-Modus für gestagte Dateien (Issue #417)', () => {
	it('enthält --write für den Prettier-Format-Schritt (kein reines --check für staged files)', () => {
		const content = readLefthook();
		assert.match(
			content,
			/prettier[^\n]*--write|--write[^\n]*prettier/,
			'lefthook.yml muss Prettier mit --write (nicht nur --check) für den Format-Hook enthalten',
		);
	});

	it('nutzt {staged_files} als Datei-Selektor (nur gestagte Dateien formatieren)', () => {
		const content = readLefthook();
		assert.match(
			content,
			/\{staged_files\}/,
			'lefthook.yml muss {staged_files} verwenden, um nur gestagte Dateien zu formatieren',
		);
	});

	it('setzt stage_fixed: true, damit formatierte Dateien re-staged und im Commit landen', () => {
		const content = readLefthook();
		assert.match(
			content,
			/stage_fixed:\s*true/,
			'lefthook.yml muss stage_fixed: true enthalten, damit --write-Änderungen re-gestaged werden',
		);
	});

	it('kombiniert --write + {staged_files} + stage_fixed im selben pre-commit-Command', () => {
		const content = readLefthook();
		// Prüft, dass alle drei Elemente innerhalb des pre-commit-Blocks zusammen auftreten
		// (nicht in unzusammenhängenden Abschnitten).
		const preCommitBlock = content.split(/^[a-z]/m).find((block) => block.includes('staged_files'));
		assert.ok(
			preCommitBlock !== undefined,
			'Kein Block mit {staged_files} gefunden; lefthook.yml muss staged_files im pre-commit verwenden',
		);
		assert.match(preCommitBlock, /--write/, 'Der Block mit {staged_files} muss auch --write enthalten');
		assert.match(
			preCommitBlock,
			/stage_fixed:\s*true/,
			'Der Block mit {staged_files} muss auch stage_fixed: true enthalten',
		);
	});

	it('enthält keinen reinen --check-Command mehr für die gestagten Dateien', () => {
		const content = readLefthook();
		// Die alten format/format-root --check Commands dürfen nicht mehr für staged files existieren.
		// Nach dem Umbau ersetzt ein einziger --write-Command die bisherigen --check-Commands.
		// Wir prüfen: wenn {staged_files} vorkommt, ist dort kein --check (nur --write).
		const lines = content.split('\n');
		const stagedFilesLineIdx = lines.findIndex((l) => l.includes('{staged_files}'));
		assert.ok(stagedFilesLineIdx >= 0, '{staged_files} muss in lefthook.yml vorkommen (AK1)');
		// Die run-Zeile für staged_files darf --check nicht enthalten
		const runLine = lines[stagedFilesLineIdx];
		assert.doesNotMatch(
			runLine,
			/--check/,
			'Die run-Zeile mit {staged_files} darf kein --check enthalten — nur --write',
		);
	});
});

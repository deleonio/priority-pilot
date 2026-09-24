import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { writeMemoryFile } from './pi-memory-write.ts';

/**
 * Vertrag für das `memory_write`-Custom-Tool der restricted-pi-Extension (Issue #1193, AK3):
 * pi hat kein `bash`, also keinen freien Schreibzugriff — dieses Tool ist der einzige
 * Schreibpfad und muss auf `<repo-root>/.ai-memory/` eingezäunt bleiben, auch gegen
 * `../`-Ausbrüche, absolute Fremdpfade und Symlinks, die aus `.ai-memory/` heraus nach
 * außen zeigen. Jeder Fixture-Repo-Root ist ein frisches tmp-Verzeichnis mit eigenem
 * `.ai-memory/`-Unterordner — kein Zugriff auf das echte Repo.
 */

const withRepo = (run: (repoRoot: string) => void): void => {
	const repoRoot = mkdtempSync(join(tmpdir(), 'pi-memory-write-'));
	mkdirSync(join(repoRoot, '.ai-memory'), { recursive: true });
	try {
		run(repoRoot);
	} finally {
		rmSync(repoRoot, { recursive: true, force: true });
	}
};

describe('writeMemoryFile — AK3 gültige Pfade', () => {
	it('schreibt eine Datei direkt unter .ai-memory/', () => {
		withRepo((repoRoot) => {
			writeMemoryFile(repoRoot, 'issue-1193-spec.md', 'inhalt');
			const written = readFileSync(join(repoRoot, '.ai-memory', 'issue-1193-spec.md'), 'utf8');
			assert.equal(written, 'inhalt');
		});
	});

	it('schreibt eine Datei in einem Unterordner von .ai-memory/', () => {
		withRepo((repoRoot) => {
			writeMemoryFile(repoRoot, 'sub/notiz.md', 'inhalt2');
			const written = readFileSync(join(repoRoot, '.ai-memory', 'sub', 'notiz.md'), 'utf8');
			assert.equal(written, 'inhalt2');
		});
	});
});

describe('writeMemoryFile — AK3 abgelehnte Pfade (keine Datei entsteht)', () => {
	it('lehnt einen ../-Ausbruch ab', () => {
		withRepo((repoRoot) => {
			assert.throws(() => writeMemoryFile(repoRoot, '../outside.md', 'x'));
			assert.equal(existsSync(join(repoRoot, 'outside.md')), false);
		});
	});

	it('lehnt einen absoluten Fremdpfad ab', () => {
		withRepo((repoRoot) => {
			const outside = join(tmpdir(), 'pi-memory-write-outside.md');
			assert.throws(() => writeMemoryFile(repoRoot, outside, 'x'));
			assert.equal(existsSync(outside), false);
		});
	});

	it('lehnt einen Symlink ab, der aus .ai-memory/ nach außen zeigt', () => {
		withRepo((repoRoot) => {
			const outsideDir = mkdtempSync(join(tmpdir(), 'pi-memory-write-target-'));
			const linkPath = join(repoRoot, '.ai-memory', 'ausbruch.md');
			try {
				symlinkSync(join(outsideDir, 'ziel.md'), linkPath);
				assert.throws(() => writeMemoryFile(repoRoot, 'ausbruch.md', 'x'));
				assert.equal(existsSync(join(outsideDir, 'ziel.md')), false);
			} finally {
				rmSync(outsideDir, { recursive: true, force: true });
			}
		});
	});
});

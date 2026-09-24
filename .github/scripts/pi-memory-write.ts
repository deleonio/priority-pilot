import { existsSync, lstatSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

/**
 * Einziger Schreibpfad des pi-Tiers `restricted` (#1193): schreibt nur unter
 * `<repoRoot>/.ai-memory/`. Relative Pfade gelten ab `.ai-memory/` (Präfix `.ai-memory/` ist
 * erlaubt); `..`, Fremdpfade und Symlinks nach außen werfen, ohne dass eine Datei entsteht.
 */

const MEMORY_DIR = '.ai-memory';

const isInside = (root: string, path: string): boolean => {
	const rel = relative(root, path);
	return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
};

export const writeMemoryFile = (repoRoot: string, requestedPath: string, content: string): void => {
	const memoryDir = resolve(repoRoot, MEMORY_DIR);
	const base = isAbsolute(requestedPath) || requestedPath.startsWith(`${MEMORY_DIR}/`) ? repoRoot : memoryDir;
	const target = resolve(base, requestedPath);
	const reject = (reason: string): never => {
		throw new Error(`memory_write abgelehnt: ${requestedPath} ${reason} (erlaubt ist nur ${MEMORY_DIR}/)`);
	};
	if (!isInside(memoryDir, target)) reject('liegt außerhalb');
	if (lstatSync(target, { throwIfNoEntry: false })?.isSymbolicLink()) reject('ist ein Symlink');
	let existing = dirname(target);
	while (!existsSync(existing)) existing = dirname(existing);
	const realMemoryDir = realpathSync(memoryDir);
	const realExisting = realpathSync(existing);
	if (realExisting !== realMemoryDir && !isInside(realMemoryDir, realExisting))
		reject('führt über einen Symlink hinaus');
	mkdirSync(dirname(target), { recursive: true });
	writeFileSync(target, content);
};

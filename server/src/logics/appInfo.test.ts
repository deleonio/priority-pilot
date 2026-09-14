import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readAppVersion, readGitSha } from './appInfo.js';

/**
 * Auflösungslogik der Build-Info: je Feld (`version`/`gitSha`) gewinnt die nächstgelegene
 * `package.json`, die das Feld trägt; Ebenen ohne Datei oder ohne das Feld werden übersprungen;
 * jenseits von vier Ebenen gilt „unbekannt". Der Suchanker wird je Aufruf injiziert (Produktiv-
 * code: Modulverzeichnis, siehe appInfo.ts) — so lässt sich die Logik in einem Temp-Baum prüfen.
 */

const tmpRoot = mkdtempSync(join(tmpdir(), 'appinfo-'));
after(() => rmSync(tmpRoot, { recursive: true, force: true }));

let treeCount = 0;

/**
 * Baut `<tmp>/baum<N>/l1/l2/l3/l4` und schreibt `files[rel]` als `package.json` in `<root>/rel`
 * (rel wie `'l1/l2'`, `''` = Baum-Basis). Liefert den tiefsten Pfad als Suchanker.
 */
const buildTree = (files: Record<string, object>): string => {
	treeCount += 1;
	const root = join(tmpRoot, `baum${treeCount}`);
	mkdirSync(join(root, 'l1', 'l2', 'l3', 'l4'), { recursive: true });
	for (const [rel, content] of Object.entries(files)) {
		const dir = join(root, rel);
		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, 'package.json'), JSON.stringify(content));
	}
	return join(root, 'l1', 'l2', 'l3', 'l4');
};

describe('logics/appInfo — Build-Info-Auflösung', () => {
	it('liest beide Felder aus der nächstgelegenen package.json', () => {
		const from = buildTree({ 'l1/l2/l3': { version: '9.9.9', gitSha: 'rootsha' } });

		assert.equal(readAppVersion(from), '9.9.9');
		assert.equal(readGitSha(from), 'rootsha');
	});

	it('sucht je Feld unabhängig weiter nach oben, wenn die nächste Datei nur eines trägt', () => {
		const from = buildTree({ 'l1/l2': { gitSha: 'nearsha' }, l1: { version: '0.9.0' } });

		assert.equal(readGitSha(from), 'nearsha');
		assert.equal(readAppVersion(from), '0.9.0');
	});

	it('überspringt Ebenen ohne package.json — jenseits von vier Ebenen „unbekannt"', () => {
		// Datei nur auf der Baum-Basis: fünf Ebenen über dem Anker, das Vier-Ebenen-Budget reicht nicht.
		const from = buildTree({ '': { version: '1.0.0', gitSha: 'basesha' } });

		assert.equal(readAppVersion(from), 'unbekannt');
		assert.equal(readGitSha(from), 'unbekannt');
	});
});

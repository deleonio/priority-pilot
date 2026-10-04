import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv } from './csv.js';

// Rote Spec-Tests für #1969 (Spec `docs/spec/issue-1969.md`, AK2/Datenvertrag): Der RFC-4180-Parser
// (eigene Logik, keine Fremd-Dependency) muss Quotes, Kommas in Feldern, CRLF/LF, BOM und
// Leerzeilen beherrschen — Todoist-Exporte nutzen genau diese Mischung.
describe('parseCsv (RFC-4180, Spec #1969)', () => {
	it('trennt Zeilen (LF) und Kommas in einfache Felder', () => {
		assert.deepEqual(parseCsv('a,b,c\nd,e,f'), [
			['a', 'b', 'c'],
			['d', 'e', 'f'],
		]);
	});

	it('liest quoted fields: Komma im Feld und ""-Escape', () => {
		assert.deepEqual(parseCsv('"Wocheneinkauf, auch Drogerie","a ""b"""'), [['Wocheneinkauf, auch Drogerie', 'a "b"']]);
	});

	it('erkennt CRLF wie LF als Zeilentrenner', () => {
		assert.deepEqual(parseCsv('a,b\r\nc,d'), [
			['a', 'b'],
			['c', 'd'],
		]);
	});

	it('entfernt BOM und überspringt Leerzeilen', () => {
		assert.deepEqual(parseCsv('\uFEFFTYPE,CONTENT\r\n\r\ntask,x\r\n'), [
			['TYPE', 'CONTENT'],
			['task', 'x'],
		]);
	});
});

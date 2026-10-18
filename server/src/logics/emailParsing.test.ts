// Vertrag für den geteilten E-Mail-Helfer (#2693): normalize und parseEmails existieren genau
// einmal (logics/emailParsing.ts) und werden von adminEmails.ts und allowedEmails.ts genutzt.
// Spiegel der bisherigen Doppel-Implementierung — Verhalten bleibt byte-identisch (#2693, AK1/AK2).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, parseEmails } from './emailParsing.js';

describe('emailParsing · normalize', () => {
	it('trimmt und wandelt in Kleinbuchstaben', () => {
		assert.equal(normalize('  Foo@BAR.com '), 'foo@bar.com');
	});
});

describe('emailParsing · parseEmails', () => {
	it('liefert für leeren Roh-Wert eine leere Liste', () => {
		assert.deepEqual(parseEmails(''), []);
		assert.deepEqual(parseEmails('   '), []);
	});

	it('parst CSV, normalisiert und verwirft leere Einträge', () => {
		assert.deepEqual(parseEmails(' A@B.com ,, c@d.com '), ['a@b.com', 'c@d.com']);
	});

	it('parst ein JSON-Array und verwirft leere Einträge', () => {
		assert.deepEqual(parseEmails('[" A@B.com ", "", "c@d.com"]'), ['a@b.com', 'c@d.com']);
	});

	it('koerziert Nicht-String-Einträge eines JSON-Arrays zu Strings', () => {
		assert.deepEqual(parseEmails('[42]'), ['42']);
	});

	it('fällt bei ungültigem JSON auf CSV zurück', () => {
		assert.deepEqual(parseEmails('[a@b.com,c@d.com]'), ['a@b.com', 'c@d.com']);
	});

	it('fällt bei JSON ohne Array auf CSV zurück', () => {
		assert.deepEqual(parseEmails('["a@b.com"'), ['"a@b.com"']);
		assert.deepEqual(parseEmails('{"a":1}'), ['{"a":1}']);
	});
});

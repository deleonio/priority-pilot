import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	validateAddress,
	validateCoordinates,
	validateDescription,
	validateEstimatedEffort,
	validateIsoDate,
	validatePriority,
	validateRequestBody,
	validateTitle,
} from './requestValidation.js';

/**
 * Spezifikation #2691: Die gemeinsamen Request-Feldprüfungen (tasks/series/push/pillars) leben
 * genau einmal in `requestValidation.ts` — Vertrag inkl. wortgleicher Meldungen und
 * Normalisierungen (docs/spec/issue-2691.md). TF2 ist der statische Dedup-Spiegel.
 */

/** Rückgabeform der Feld-Helfer (Spezifikation). */
type Check<T> = { ok: true; value: T } | { ok: false; message: string };

/** Fordert den Fehler-Kanal und liefert die wortgleiche Meldung. */
const errOf = <T>(result: Check<T>): string => {
	assert.equal(result.ok, false, `erwartete Ablehnung, erhalten: ${JSON.stringify(result)}`);
	return (result as { message: string }).message;
};

/** Fordert den Erfolgs-Kanal und liefert den normierten Wert. */
const valOf = <T>(result: Check<T>): T => {
	assert.equal(result.ok, true, `erwartete Annahme, erhalten: ${JSON.stringify(result)}`);
	return (result as { value: T }).value;
};

describe('validateRequestBody (Body-Objekt-Guard)', () => {
	it('lehnt Nicht-Objekte mit der wortgleichen Meldung ab', () => {
		assert.equal(errOf(validateRequestBody(null)), 'Request-Body muss ein Objekt sein.');
		assert.equal(errOf(validateRequestBody('x')), 'Request-Body muss ein Objekt sein.');
		assert.equal(errOf(validateRequestBody(42)), 'Request-Body muss ein Objekt sein.');
	});

	it('liefert bei Objekt-Body das Eingabe-Record', () => {
		assert.deepEqual(valOf(validateRequestBody({ a: 1 })), { a: 1 });
	});
});

describe('validateTitle', () => {
	it('trimmt und lehnt nicht-leere-String-Verstöße (auch nur Whitespace) wortgleich ab', () => {
		assert.equal(errOf(validateTitle('   ', false)), 'title muss ein nicht-leerer String sein.');
		assert.equal(errOf(validateTitle(5, false)), 'title muss ein nicht-leerer String sein.');
		assert.equal(valOf(validateTitle('  Einkaufen  ', false)), 'Einkaufen');
	});

	it('erzwingt den Titel im Pflicht-Modus mit wortgleicher Meldung, optional sonst', () => {
		assert.equal(errOf(validateTitle(undefined, true)), 'title ist erforderlich.');
		assert.equal(valOf(validateTitle(undefined, false)), undefined);
	});
});

describe('validatePriority', () => {
	it('akzeptiert die Grenzwerte 1 und 5', () => {
		assert.equal(valOf(validatePriority(1)), 1);
		assert.equal(valOf(validatePriority(5)), 5);
	});

	it('lehnt außerhalb der Grenzen und Nicht-Ganzzahlen wortgleich ab', () => {
		const message = 'priority muss eine Ganzzahl zwischen 1 und 5 sein.';
		assert.equal(errOf(validatePriority(0)), message);
		assert.equal(errOf(validatePriority(6)), message);
		assert.equal(errOf(validatePriority(2.5)), message);
		assert.equal(errOf(validatePriority('3')), message);
	});
});

describe('validateEstimatedEffort', () => {
	it('akzeptiert die Grenzwerte 0.1 und 1', () => {
		assert.equal(valOf(validateEstimatedEffort(0.1)), 0.1);
		assert.equal(valOf(validateEstimatedEffort(1)), 1);
	});

	it('lehnt außerhalb der Grenzen und Nicht-Zahlen wortgleich ab', () => {
		const message = 'estimatedEffort muss eine Zahl zwischen 0.1 und 1 sein.';
		assert.equal(errOf(validateEstimatedEffort(0.05)), message);
		assert.equal(errOf(validateEstimatedEffort(1.1)), message);
		assert.equal(errOf(validateEstimatedEffort(Number.NaN)), message);
	});
});

describe('validateDescription', () => {
	it('akzeptiert String und null, lehnt andere Typen wortgleich ab', () => {
		assert.equal(valOf(validateDescription(null)), null);
		assert.equal(valOf(validateDescription('Notiz')), 'Notiz');
		assert.equal(errOf(validateDescription(7)), 'description muss ein String oder null sein.');
	});
});

describe('validateAddress', () => {
	it('trimmt und normiert Leer/Whitespace zu null', () => {
		assert.equal(valOf(validateAddress('  Bäckerstraße 4  ')), 'Bäckerstraße 4');
		assert.equal(valOf(validateAddress('')), null);
		assert.equal(valOf(validateAddress('   ')), null);
		assert.equal(valOf(validateAddress(null)), null);
	});

	it('lehnt Strings über 255 Zeichen und andere Typen wortgleich ab', () => {
		const message = 'address muss ein String (max. 255 Zeichen) oder null sein.';
		assert.equal(errOf(validateAddress('x'.repeat(256))), message);
		assert.equal(errOf(validateAddress(42)), message);
	});
});

describe('validateCoordinates', () => {
	it('nimmt das Paar an den Grenzen an', () => {
		assert.deepEqual(valOf(validateCoordinates({ latitude: -90, longitude: -180 })), {
			latitude: -90,
			longitude: -180,
		});
		assert.deepEqual(valOf(validateCoordinates({ latitude: 90, longitude: 180 })), {
			latitude: 90,
			longitude: 180,
		});
	});

	it('lehnt Überschreitungen mit wortgleicher Meldung der betroffenen Seite ab', () => {
		assert.equal(
			errOf(validateCoordinates({ latitude: 90.1 })),
			'latitude muss eine Zahl zwischen -90 und 90 oder null sein.',
		);
		assert.equal(
			errOf(validateCoordinates({ longitude: -180.1 })),
			'longitude muss eine Zahl zwischen -180 und 180 oder null sein.',
		);
	});

	it('normalisiert eine Einzel-Koordinate paarweise zu null', () => {
		assert.deepEqual(valOf(validateCoordinates({ latitude: 52.5 })), { latitude: null, longitude: null });
		assert.deepEqual(valOf(validateCoordinates({ longitude: 13.4 })), { latitude: null, longitude: null });
		assert.deepEqual(valOf(validateCoordinates({ latitude: 52.5, longitude: null })), {
			latitude: null,
			longitude: null,
		});
	});
});

describe('validateIsoDate', () => {
	it('deadline-Variante erlaubt null (Meldung wortgleich)', () => {
		assert.equal(valOf(validateIsoDate(null, 'deadline', true)), null);
		assert.deepEqual(
			valOf(validateIsoDate('2026-03-01T10:00:00.000Z', 'deadline', true)),
			new Date('2026-03-01T10:00:00.000Z'),
		);
		assert.equal(
			errOf(validateIsoDate('morgen', 'deadline', true)),
			'deadline muss ein gültiges ISO-Datum oder null sein.',
		);
		assert.equal(errOf(validateIsoDate(5, 'deadline', true)), 'deadline muss ein gültiges ISO-Datum oder null sein.');
	});

	it('startDate-Variante lehnt null ab (Meldung wortgleich)', () => {
		assert.deepEqual(valOf(validateIsoDate('2026-03-01', 'startDate', false)), new Date('2026-03-01'));
		assert.equal(errOf(validateIsoDate(null, 'startDate', false)), 'startDate muss ein gültiges ISO-Datum sein.');
	});
});

describe('Dedup-Spiegel (#2691 AK1/AK2)', () => {
	const SRC_DIR = join(import.meta.dirname, '..');
	const MODULE_PATH = join(SRC_DIR, 'logics', 'requestValidation.ts');
	const ROUTES = ['tasks.ts', 'series.ts', 'push.ts', 'pillars.ts'];
	/** Gemeinsame Meldungen — je Prüfung genau ein Vorkommen, und zwar im Modul. */
	const SHARED_MESSAGES = [
		'Request-Body muss ein Objekt sein.',
		'title muss ein nicht-leerer String sein.',
		'title ist erforderlich.',
		'priority muss eine Ganzzahl zwischen 1 und 5 sein.',
		'estimatedEffort muss eine Zahl zwischen 0.1 und 1 sein.',
		'description muss ein String oder null sein.',
		'address muss ein String (max. 255 Zeichen) oder null sein.',
		'latitude muss eine Zahl zwischen -90 und 90 oder null sein.',
		'longitude muss eine Zahl zwischen -180 und 180 oder null sein.',
		'deadline muss ein gültiges ISO-Datum oder null sein.',
		'startDate muss ein gültiges ISO-Datum sein.',
	];

	/** Alle Production-TS-Dateien unter server/src (ohne Tests und generierte .d.ts). */
	const productionTsFiles = (dir: string = SRC_DIR): string[] =>
		readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
			const path = join(dir, entry.name);
			if (entry.isDirectory()) {
				return productionTsFiles(path);
			}
			return entry.isFile() &&
				entry.name.endsWith('.ts') &&
				!entry.name.endsWith('.test.ts') &&
				!entry.name.endsWith('.d.ts')
				? [path]
				: [];
		});

	it('ValidationResult und jede gemeinsame Meldung existieren nur im neuen Modul', () => {
		const files = productionTsFiles();
		const offenders = (needle: string): string[] => files.filter((path) => readFileSync(path, 'utf8').includes(needle));
		assert.deepEqual(offenders('type ValidationResult'), [MODULE_PATH]);
		for (const needle of SHARED_MESSAGES) {
			assert.deepEqual(offenders(needle), [MODULE_PATH], `Meldung auch außerhalb des Moduls: ${needle}`);
		}
	});

	it('die vier Routen-Dateien importieren die Validierung aus requestValidation', () => {
		for (const route of ROUTES) {
			const content = readFileSync(join(SRC_DIR, 'express', 'routes', route), 'utf8');
			assert.match(content, /from '\.\.\/\.\.\/logics\/requestValidation\.js'/, route);
		}
	});
});

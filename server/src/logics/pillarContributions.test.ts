import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Pillar, User } from '../models/index.js';
import { resetDb, closeDb } from '../test/helpers.js';
// ROTER Spec-Test (#302 / A3.2): Das geteilte Pillar-Validierungsmodul existiert noch nicht. Der
// Import schlägt fehl, bis `server/src/logics/pillarContributions.ts` die hier eingeklagte
// Schnittstelle bereitstellt. Ziel ist EINE Validierung, die sich Series-Vorlage und Task-Beiträge
// teilen (keine Duplizierung). KEIN Produktivcode.
import { validatePillars, arePillarsExistent } from './pillarContributions.js';

/**
 * Vertrag für `validatePillars(pillars)` — die reine (DB-freie) Formvalidierung eines Beitrags-
 * Arrays `{ pillarId, share, confidence? }`:
 *  - Summe der `share` muss exakt 100 ergeben (Ausnahme: leere Liste ist erlaubt).
 *  - `pillarId` muss eine Ganzzahl ≥ 1 sein und darf nicht doppelt vorkommen.
 *  - `share` und `confidence` liegen im Bereich 0–100 (Grenzwerte inklusive).
 *  - fehlt `confidence`, defaultet es auf 100.
 *
 * Der Erfolgs-/Fehler-Kanal ist als Rückgabe modelliert: `{ ok: true, pillars }` bei gültiger
 * Eingabe (mit aufgefülltem confidence-Default) bzw. `{ ok: false }` bei Verletzung. Die Tests
 * fixieren nur diese Invariante über `.ok`, nicht die konkrete Fehlermeldung.
 */
describe('validatePillars', () => {
	it('gültige Liste mit einem Beitrag (Summe = 100) → ok', () => {
		const result = validatePillars([{ pillarId: 1, share: 100 }]);
		assert.equal(result.ok, true);
	});

	it('gültige Liste mit mehreren Beiträgen (Summe = 100) → ok', () => {
		const result = validatePillars([
			{ pillarId: 1, share: 60, confidence: 80 },
			{ pillarId: 2, share: 40 },
		]);
		assert.equal(result.ok, true);
	});

	it('leere Liste ist gültig (pillars: [])', () => {
		const result = validatePillars([]);
		assert.equal(result.ok, true);
	});

	it('Summe share ≠ 100 → Fehler', () => {
		const result = validatePillars([
			{ pillarId: 1, share: 30 },
			{ pillarId: 2, share: 30 },
		]);
		assert.equal(result.ok, false);
	});

	it('doppelte pillarId → Fehler', () => {
		const result = validatePillars([
			{ pillarId: 1, share: 50 },
			{ pillarId: 1, share: 50 },
		]);
		assert.equal(result.ok, false);
	});

	it('confidence defaultet auf 100, wenn nicht angegeben', () => {
		const result = validatePillars([{ pillarId: 1, share: 100 }]);
		assert.equal(result.ok, true);
		assert.ok(result.ok, 'Typ-Narrowing: gültiges Ergebnis trägt die normalisierten pillars');
		assert.deepEqual(result.pillars, [{ pillarId: 1, share: 100, confidence: 100 }]);
	});

	it('pillarId keine Ganzzahl (1.5) → Fehler', () => {
		const result = validatePillars([{ pillarId: 1.5, share: 100 }]);
		assert.equal(result.ok, false);
	});

	it('pillarId < 1 (0) → Fehler', () => {
		const result = validatePillars([{ pillarId: 0, share: 100 }]);
		assert.equal(result.ok, false);
	});

	it('share außerhalb 0–100 (150) → Fehler', () => {
		const result = validatePillars([{ pillarId: 1, share: 150 }]);
		assert.equal(result.ok, false);
	});

	it('share = 0 ist ein gültiger Grenzwert', () => {
		// Summe muss weiterhin 100 ergeben; ein 0-Anteil ist zulässig, der andere trägt 100.
		const result = validatePillars([
			{ pillarId: 1, share: 0 },
			{ pillarId: 2, share: 100 },
		]);
		assert.equal(result.ok, true);
	});

	it('confidence außerhalb 0–100 (120) → Fehler', () => {
		const result = validatePillars([{ pillarId: 1, share: 100, confidence: 120 }]);
		assert.equal(result.ok, false);
	});

	it('confidence = 0 und confidence = 100 sind gültige Grenzwerte', () => {
		const untergrenze = validatePillars([{ pillarId: 1, share: 100, confidence: 0 }]);
		assert.equal(untergrenze.ok, true);
		const obergrenze = validatePillars([{ pillarId: 1, share: 100, confidence: 100 }]);
		assert.equal(obergrenze.ok, true);
	});

	it('confidence unter 0 (-1) → Fehler', () => {
		const result = validatePillars([{ pillarId: 1, share: 100, confidence: -1 }]);
		assert.equal(result.ok, false);
	});
});

/**
 * Vertrag für `arePillarsExistent(pillarIds, userId)` (#1249, AK5) — die DB-gestützte Prüfung, ob
 * alle referenzierten Säulen für das genannte KONTO existieren. Der Kontobezug ist Pflichtparameter
 * (kein optionaler globaler Fallback): ein Aufruf ohne Konto ist nicht mehr kompilierbar — abgesichert
 * über `tsc --noEmit` in den Gates, weshalb JEDER Aufruf hier das Konto übergibt. Liefert `true`,
 * wenn jede `pillarId` einer Zeile in `pillars` mit genau dieser `userId` entspricht (leere Liste ⇒
 * trivial `true`), sonst `false`.
 */
describe('arePillarsExistent', () => {
	beforeEach(async () => {
		await resetDb();
	});

	after(async () => {
		await closeDb();
	});

	/** Zwei nutzer-eigene Säulen (gleicher Name wie bei Fremd-Konto in einem Test, Unique-Index erlaubt das). */
	const seedTwoPillars = async (): Promise<{ userId: number; ids: [number, number] }> => {
		const owner = await User.create({ email: 'owner@example.com', passwordHash: '__test__', displayName: 'Owner' });
		const koerper = await Pillar.create({ name: 'Körper', weight: 20, userId: owner.id });
		const sinn = await Pillar.create({ name: 'Sinn', weight: 20, userId: owner.id });
		return { userId: owner.id, ids: [koerper.id, sinn.id] };
	};

	it('leere Liste → true', async () => {
		const { userId } = await seedTwoPillars();
		assert.equal(await arePillarsExistent([], userId), true);
	});

	it('alle pillarIds existieren im Konto → true', async () => {
		const { userId, ids } = await seedTwoPillars();
		assert.equal(await arePillarsExistent(ids, userId), true);
	});

	it('unbekannte pillarId → false', async () => {
		const { userId } = await seedTwoPillars();
		assert.equal(await arePillarsExistent([99999], userId), false);
	});

	it('teils unbekannte pillarId → false', async () => {
		const { userId, ids } = await seedTwoPillars();
		assert.equal(await arePillarsExistent([ids[0], 99999], userId), false);
	});

	it('Säule eines FREMDEN Kontos zählt nicht (gleicher Name, andere userId) → false (#1249)', async () => {
		const { userId, ids } = await seedTwoPillars();
		const fremd = await User.create({ email: 'fremd@example.com', passwordHash: '__test__', displayName: 'Fremd' });
		const fremdPillar = await Pillar.create({ name: 'Körper', weight: 20, userId: fremd.id });
		assert.equal(await arePillarsExistent([ids[0], fremdPillar.id], userId), false);
	});
});

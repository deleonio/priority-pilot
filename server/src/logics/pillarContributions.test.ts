import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Pillar, User } from '../models/index.js';
import { resetDb, closeDb } from '../test/helpers.js';
// ROTER Spec-Test (#302 / A3.2): Das geteilte Pillar-Validierungsmodul existiert noch nicht. Der
// Import schlägt fehl, bis `server/src/logics/pillarContributions.ts` die hier eingeklagte
// Schnittstelle bereitstellt. Ziel ist EINE Validierung, die sich Series-Vorlage und Task-Beiträge
// teilen (keine Duplizierung). KEIN Produktivcode.
import { validatePillars, arePillarsExistent, buildHandoverRows } from './pillarContributions.js';

/**
 * Vertrag für `validatePillars(pillars)` — die reine (DB-freie) Formvalidierung eines Beitrags-
 * Arrays `{ pillarId, share, confidence? }` (#2077):
 *  - Summe der `share` muss exakt 100 ergeben (Ausnahme: leere Liste ist erlaubt).
 *  - `pillarId` muss eine Ganzzahl ≥ 1 sein und darf nicht doppelt vorkommen.
 *  - jeder `share` liegt zwischen 5 und 80 (Grenzwerte inklusive), `confidence` zwischen 0 und 100.
 *  - fehlt `confidence`, defaultet es auf 100.
 *
 * Der Erfolgs-/Fehler-Kanal ist als Rückgabe modelliert: `{ ok: true, pillars }` bei gültiger
 * Eingabe (mit aufgefülltem confidence-Default) bzw. `{ ok: false }` bei Verletzung. Die Tests
 * fixieren nur diese Invariante über `.ok`, nicht die konkrete Fehlermeldung.
 */
describe('validatePillars', () => {
	it('gültige Liste an den Anteils-Grenzen (80 und je 5) → ok', () => {
		const result = validatePillars([
			{ pillarId: 1, share: 80 },
			{ pillarId: 2, share: 5 },
			{ pillarId: 3, share: 5 },
			{ pillarId: 4, share: 5 },
			{ pillarId: 5, share: 5 },
		]);
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
		const result = validatePillars([
			{ pillarId: 1, share: 60 },
			{ pillarId: 2, share: 40 },
		]);
		assert.equal(result.ok, true);
		assert.ok(result.ok, 'Typ-Narrowing: gültiges Ergebnis trägt die normalisierten pillars');
		assert.deepEqual(result.pillars, [
			{ pillarId: 1, share: 60, confidence: 100 },
			{ pillarId: 2, share: 40, confidence: 100 },
		]);
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

	it('share = 0 ist kein gültiger Anteil mehr (untere Grenze 5) → Fehler', () => {
		// #2077: die Anteils-Untergrenze liegt bei 5 — ein 0-Anteil ist nicht mehr zulässig.
		const result = validatePillars([
			{ pillarId: 1, share: 0 },
			{ pillarId: 2, share: 100 },
		]);
		assert.equal(result.ok, false);
	});

	it('confidence außerhalb 0–100 (120) → Fehler', () => {
		const result = validatePillars([{ pillarId: 1, share: 100, confidence: 120 }]);
		assert.equal(result.ok, false);
	});

	it('confidence = 0 und confidence = 100 sind gültige Grenzwerte', () => {
		const untergrenze = validatePillars([
			{ pillarId: 1, share: 60, confidence: 0 },
			{ pillarId: 2, share: 40 },
		]);
		assert.equal(untergrenze.ok, true);
		const obergrenze = validatePillars([
			{ pillarId: 1, share: 60, confidence: 100 },
			{ pillarId: 2, share: 40 },
		]);
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

	// Pass-Through (#1596): Ohne Konto am Request liefert `GET /pillars` über `ownerScope(undefined)`
	// jede Säule — die Existenz-Prüfung muss dann genauso weit sein, sonst bietet die Liste Säulen an,
	// die das Anlegen anschließend mit 400 ablehnt (E2E-Shard lief genau darauf auf).
	it('ohne Konto (null) zählt jede existierende Säule → true', async () => {
		const { ids } = await seedTwoPillars();
		assert.equal(await arePillarsExistent(ids, null), true);
	});

	it('ohne Konto (null) bleibt eine unbekannte pillarId → false', async () => {
		const { ids } = await seedTwoPillars();
		assert.equal(await arePillarsExistent([ids[0], 99999], null), false);
	});
});

/**
 * Vertrag für `buildHandoverRows(pillars, remapped, buildRow, distribute?)` (#2152 AK2/AK3) — der
 * gemeinsame Handover-Auffüll-Helfer für Task- und Series-Übergabe: Basisanteile aus `remapped`
 * (fehlend → 0), Auffüllung zur Vollverteilung über die Empfänger-Säulen (Default:
 * `distributeWithMinimum`, als Parameter injizierbar — genau dieser Seam macht den Kürzungsfall
 * testbar). Der Zeilenaufbau bleibt via `buildRow` bei der Route (TaskPillar vs. SeriesPillar).
 * Ist die gelieferte Verteilung KÜRZER als die Empfänger-Säulen, wirft der Helfer einen lautenden
 * Fehler, statt stille Zeilen mit Anteil 0 zu schreiben (früher `shares[index] ?? 0`). Wie bei
 * `validatePillars` wird nur die Invariante fixiert, nicht der exakte Fehlertext.
 */
describe('buildHandoverRows', () => {
	it('gekürzte Verteilung → wirft laut, statt still share-0-Zeilen zu schreiben (#2152, AK2)', () => {
		const rows: unknown[] = [];
		assert.throws(() =>
			buildHandoverRows(
				[{ id: 11 }, { id: 22 }, { id: 33 }],
				new Map(),
				(pillarId, share) => {
					rows.push({ pillarId, share });
					return { pillarId, share };
				},
				() => [100],
			),
		);
		assert.equal(rows.length, 0, 'vor dem Fehler darf keine Zeile gebaut worden sein');
	});

	it('füllt zur Vollverteilung auf: kein 0-Anteil, confidence-Default 100 (#2152, AK2)', () => {
		// Test-Pflege #2152: `distributeWithMinimum` skaliert die Remap-Vorgaben proportional auf den
		// freien Pool und setzt Säulen ohne Vorgabe auf den Mindestanteil (etablierter #2077-AK4-
		// Vertrag, den AK3 unverändert lässt) — aus [80, 0] wird [95, 5], nicht [80, 20]. Fixiert
		// bleibt die Invariante „kein 0-Anteil“.
		const rows = buildHandoverRows(
			[{ id: 11 }, { id: 22 }],
			new Map([[11, { share: 80, confidence: 70 }]]),
			(pillarId, share, confidence) => ({ pillarId, share, confidence }),
		);
		assert.deepEqual(rows, [
			{ pillarId: 11, share: 95, confidence: 70 },
			{ pillarId: 22, share: 5, confidence: 100 },
		]);
	});
});

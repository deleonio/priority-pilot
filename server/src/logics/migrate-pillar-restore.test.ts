import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import sequelize from '../database.js';
import { Pillar, Task, TaskPillar, User } from '../models/index.js';
// ROT (#1573): `migratePillarRestore` existiert noch nicht — der Import macht diese Spec-Datei
// bewusst rot, bis `server/src/logics/migrate.ts` die Funktion exportiert und die Registry in
// `server/src/index.ts` sie vor `sync()` aufruft. Neue Funktionalität → fehlender Export ist das
// legitime erste Rot.
import { migratePillarRestore } from './migrate.js';
import { SEED_PILLARS } from '../models/pillarData.js';
import { resetDb, closeDb } from '../test/helpers.js';

// ── Rote Spec-Tests für #1573 — „Säulen-CRUD sperren + Restore-Migration" (AK4/AK5) ───────────
//
// Vertrag (Spec: docs/spec/issue-1573.md): `migratePillarRestore(sequelize)` führt jeden
// Bestandsnutzer auf EXAKT die 5 Standard-Säulen (SEED_PILLARS) zurück:
//   - umbenannte Standard-Säulen: Name wird zurückgesetzt, id UND alle id-basierten Beiträge
//     (task_pillars/series_pillars) bleiben unverändert erhalten;
//   - fehlende Standard-Säulen: werden angelegt (Gewicht nach AK5);
//   - zusätzliche Säulen: werden mitsamt ihrer Beiträge entfernt;
//   - idempotent: ein zweiter Lauf ändert nichts.
//
// Anders als `migrate-pillar-per-user.test.ts` (Legacy-Schema per Raw-SQL) laufen diese Tests
// gegen das AKTUELLE Schema (`resetDb()` = `sync({ force: true })`): die Restore-Migration
// operiert auf dem heutigen per-User-Stand.

/** Standard-Namen als Set — Vergleichsmaterial für „exakt die 5 Standard-Säulen". */
const SEED_NAMES = SEED_PILLARS.map((p) => p.name);

/** Alle Säulen eines Nutzers, nach id sortiert (wie GET /pillars liefert). */
const pillarsOf = async (userId: number): Promise<Pillar[]> =>
	Pillar.findAll({ where: { userId }, order: [['id', 'ASC']] });

/** Der (einzige) Task-Beitrag eines Tasks — inkl. nachgeladener Säule. */
const contributionOf = async (taskId: number): Promise<TaskPillar | undefined> => {
	const rows = await TaskPillar.findAll({ where: { taskId } });
	return rows[0];
};

/** Legt Nutzer + Task + vollen Beitrag (share 100) auf die angegebene Säule an. */
const taskContributingTo = async (userId: number, pillarId: number, title: string): Promise<number> => {
	const task = await Task.create({ title, status: 'Open', priority: 3, estimatedEffort: 1, userId });
	await TaskPillar.create({ taskId: task.id, pillarId, share: 100, confidence: 100 });
	return task.id;
};

/** Float-Vergleich mit Toleranz (Renormierung produziert Nichtterminierende Dezimalen). */
const closeTo = (actual: number, expected: number): boolean => Math.abs(actual - expected) < 1e-6;

beforeEach(async () => {
	await resetDb();
});

after(closeDb);

// ── AK4: Struktur der Wiederherstellung ───────────────────────────────────────────────────────

describe('migratePillarRestore — AK4: exakt die 5 Standard-Säulen je Bestandsnutzer', () => {
	it('setzt umbenannte Standard-Säule zurück, erhält ihre Beiträge, entfernt zusätzliche samt Beiträgen', async () => {
		const user = await User.create({ email: 'restore@example.com', passwordHash: '__x__' });

		// 4 Standard-Säulen mit korrektem Namen …
		for (const name of ['Mentale Gesundheit', 'Beziehungen', 'Wirksamkeit', 'Sinn']) {
			await Pillar.create({ name, description: '', weight: 25, userId: user.id });
		}
		// … eine umbenannte (id bleibt, „Körper" → „Fitness") …
		const renamed = await Pillar.create({ name: 'Fitness', description: '', weight: 20, userId: user.id });
		// … und eine zusätzliche (nicht in SEED_PILLARS).
		const extra = await Pillar.create({ name: 'Extra-Säule', description: '', weight: 5, userId: user.id });

		// Beiträge: Task 1 zahlt auf die umbenannte id, Task 2 auf die zusätzliche Säule.
		const task1 = await taskContributingTo(user.id, renamed.id, 'Task auf umbenannter Säule');
		const task2 = await taskContributingTo(user.id, extra.id, 'Task auf zusätzlicher Säule');

		await migratePillarRestore(sequelize);

		// Exakt die 5 Standard-Säulen mit Standard-Namen.
		const pillars = await pillarsOf(user.id);
		assert.equal(pillars.length, 5, 'nach der Migration existieren genau 5 Säulen');
		assert.deepEqual(
			pillars.map((p) => p.name).sort(),
			[...SEED_NAMES].sort(),
			'die Namen sind exakt die Standard-Namen',
		);

		// Die umbenannte Säule wurde auf demselben Datensatz zurückgesetzt (id unverändert).
		const restored = await Pillar.findByPk(renamed.id);
		assert.equal(restored?.name, 'Körper', 'umbenannte Säule trägt wieder den Standard-Namen');

		// Beitrag der umbenannten id bleibt erhalten (AK4: „Beiträge der betroffenen id bleiben
		// erhalten" — id-basiert, nichts geht verloren).
		const keptContribution = await contributionOf(task1);
		assert.equal(keptContribution?.pillarId, renamed.id, 'Beitragszeile zeigt unverändert auf dieselbe id');
		assert.equal(keptContribution?.share, 100, 'Share des erhaltenen Beitrags ist unverändert');

		// Zusätzliche Säule mitsamt Beitrag entfernt.
		assert.equal(await Pillar.count({ where: { id: extra.id } }), 0, 'zusätzliche Säule ist entfernt');
		assert.equal(
			await TaskPillar.count({ where: { taskId: task2 } }),
			0,
			'Beitrag auf zusätzlicher Säule ist entfernt',
		);
		assert.equal(await Pillar.count({ where: { userId: user.id } }), 5, 'keine Restzeilen außer den 5 Standard-Säulen');
	});

	it('legt fehlende Standard-Säulen an (Nutzer mit 2 Säulen → 5)', async () => {
		const user = await User.create({ email: 'sparse@example.com', passwordHash: '__x__' });
		await Pillar.create({ name: 'Körper', description: '', weight: 60, userId: user.id });
		await Pillar.create({ name: 'Sinn', description: '', weight: 40, userId: user.id });

		await migratePillarRestore(sequelize);

		const pillars = await pillarsOf(user.id);
		assert.equal(pillars.length, 5, 'alle 5 Standard-Säulen existieren');
		assert.deepEqual(
			pillars.map((p) => p.name).sort(),
			[...SEED_NAMES].sort(),
			'exakt die Standard-Namen, keine zusätzlichen',
		);
	});

	it('lässt einen bereits standardgemäßen Bestand unberührt und ist idempotent', async () => {
		const user = await User.create({ email: 'clean@example.com', passwordHash: '__x__' });
		const original = await Pillar.bulkCreate(
			SEED_PILLARS.map(({ name, description }, index) => ({
				name,
				description,
				weight: [10, 20, 30, 20, 20][index]!,
				userId: user.id,
			})),
		);

		await migratePillarRestore(sequelize);
		// Idempotenz: zweiter Lauf ändert nichts.
		await migratePillarRestore(sequelize);

		const pillars = await pillarsOf(user.id);
		assert.equal(pillars.length, 5);
		assert.deepEqual(
			pillars.map((p) => p.id).sort(),
			original.map((p) => p.id).sort(),
			'keine neuen Zeilen, keine Dubletten — ids bleiben stabil',
		);
		assert.deepEqual(
			pillars.map((p) => p.weight),
			[10, 20, 30, 20, 20],
			'Gewichte unberührter Standard-Säulen bleiben exakt',
		);
	});
});

// ── AK5: Gewichtsregeln ──────────────────────────────────────────────────────────────────────

describe('migratePillarRestore — AK5: Gewichte erhalten / auf Summe 100 aufgefüllt', () => {
	it('behält vorhandene Gewichte exakt und füllt die neue Säule auf Summe 100 auf', async () => {
		const user = await User.create({ email: 'weights@example.com', passwordHash: '__x__' });
		// 4 Standard-Säulen, „Sinn" fehlt; Summe der vorhandenen = 90 → Sinn erhält 10.
		const kept: Record<string, number> = {
			Körper: 30,
			'Mentale Gesundheit': 25,
			Beziehungen: 20,
			Wirksamkeit: 15,
		};
		for (const [name, weight] of Object.entries(kept)) {
			await Pillar.create({ name, description: '', weight, userId: user.id });
		}

		await migratePillarRestore(sequelize);

		const pillars = await pillarsOf(user.id);
		assert.equal(pillars.length, 5);
		for (const pillar of pillars) {
			if (pillar.name === 'Sinn') {
				assert.equal(pillar.weight, 10, 'neue Säule füllt den Rest bis 100 auf (100 − 90)');
			} else {
				assert.equal(pillar.weight, kept[pillar.name], `Gewicht „${pillar.name}" bleibt exakt unverändert`);
			}
		}
		const sum = pillars.reduce((acc, p) => acc + p.weight, 0);
		assert.ok(closeTo(sum, 100), `Summe aller 5 Gewichte ist 100 (ist ${sum})`);
	});

	it('renormiert proportional, wenn die vorhandene Summe über 100 liegt', async () => {
		const user = await User.create({ email: 'overfull@example.com', passwordHash: '__x__' });
		// 4 Standard-Säulen mit Summe 105, „Sinn" fehlt → Rest wäre −5 → proportionale Renormierung.
		const kept: Record<string, number> = {
			Körper: 40,
			'Mentale Gesundheit': 30,
			Beziehungen: 20,
			Wirksamkeit: 15,
		};
		for (const [name, weight] of Object.entries(kept)) {
			await Pillar.create({ name, description: '', weight, userId: user.id });
		}

		await migratePillarRestore(sequelize);

		const pillars = await pillarsOf(user.id);
		assert.equal(pillars.length, 5);
		const factor = 100 / 105;
		for (const pillar of pillars) {
			if (pillar.name === 'Sinn') {
				assert.ok(closeTo(pillar.weight, 0), 'neue Säule startet bei 0');
			} else {
				assert.ok(
					closeTo(pillar.weight, kept[pillar.name] * factor),
					`„${pillar.name}" wird proportional renormiert (${kept[pillar.name]} → ${kept[pillar.name] * factor})`,
				);
			}
		}
		const sum = pillars.reduce((acc, p) => acc + p.weight, 0);
		assert.ok(closeTo(sum, 100), `Summe nach Renormierung ist 100 (ist ${sum})`);
	});
});

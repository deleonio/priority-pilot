import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Pillar } from './index.js';
import User from './user.js';
import { resetDb, closeDb } from '../test/helpers.js';

beforeEach(resetDb);
after(closeDb);

// Rote Spec-Tests für #427 (AK1 + AK2) — Säulen werden **pro Nutzer** geführt. Das `Pillar`-Modell
// bekommt ein `userId`-Feld und der Unique-Index wandert von (`name`) auf (`name`, `userId`): derselbe
// Säulenname darf für verschiedene Nutzer existieren, für **denselben** Nutzer aber nur einmal.
//
// KEIN Produktivcode — die Tests werden grün, sobald `Pillar` das `userId`-Feld trägt und der
// Unique-Index auf (`name`, `userId`) steht. Aktuell ist der Name global eindeutig → die Tests
// scheitern (rot): entweder fehlt `userId` oder der globale Index weist bereits die zweite Säule ab.

/** Legt einen echten Nutzer an (für eine gültige `userId`-Referenz). */
const createUser = async (email: string): Promise<number> => {
	const user = await User.create({ email, passwordHash: 'x' });
	return user.id;
};

describe('Pillar-Modell — userId & Nutzer-Eindeutigkeit (#427)', () => {
	// ── AK1 (Modell-Seite): Säule speichert userId und hat den Default-Gewicht 20 ────────────────
	it('legt eine Säule mit userId an, trägt die userId und hat Default weight = 20 (AK1)', async () => {
		const userId = await createUser('ak1@example.com');

		const pillar = await Pillar.create({ name: 'Körper', description: 'Physis', userId });

		assert.equal(pillar.userId, userId, 'die gesetzte userId liegt an der Säule an');
		assert.equal(pillar.weight, 20, 'ohne Angabe greift der Default weight = 20');

		const reloaded = await Pillar.findByPk(pillar.id);
		assert.ok(reloaded, 'die Säule ist persistiert und abrufbar');
		assert.equal(reloaded.userId, userId, 'die userId überlebt die Persistenz');
	});

	// ── AK2: derselbe Säulenname für zwei verschiedene Nutzer ist erlaubt ────────────────────────
	it('erlaubt denselben Säulennamen für zwei verschiedene Nutzer (AK2)', async () => {
		const userA = await createUser('a@example.com');
		const userB = await createUser('b@example.com');

		await Pillar.create({ name: 'Körper', description: '', userId: userA });
		await assert.doesNotReject(
			() => Pillar.create({ name: 'Körper', description: '', userId: userB }),
			'gleicher Name bei anderem Nutzer ist erlaubt',
		);

		const total = await Pillar.count({ where: { name: 'Körper' } });
		assert.equal(total, 2, 'beide „Körper"-Säulen (je Nutzer eine) existieren nebeneinander');
	});

	// ── AK2: derselbe Säulenname für denselben Nutzer wird abgewiesen (Unique auf name, userId) ──
	it('weist einen doppelten Säulennamen für denselben Nutzer ab (Unique-Index name+userId, AK2)', async () => {
		const userId = await createUser('dupe@example.com');

		await Pillar.create({ name: 'Körper', description: '', userId });
		await assert.rejects(
			() => Pillar.create({ name: 'Körper', description: '', userId }),
			'zweite „Körper"-Säule desselben Nutzers verletzt den Unique-Constraint',
		);

		const total = await Pillar.count({ where: { name: 'Körper', userId } });
		assert.equal(total, 1, 'nur eine „Körper"-Säule je Nutzer wurde materialisiert');
	});
});

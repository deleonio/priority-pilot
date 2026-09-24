// Muss als Erstes stehen: lädt `.env` (u. a. `DATABASE_STORAGE`), bevor die DB-Verbindung entsteht.
import '../env.js';
import sequelize from '../database.js';
import '../models/index.js';
import { grandfatherPlans, planDistribution } from '../logics/grandfatherPlans.js';

/**
 * Einmalige Übergangs-Setzung (#1463, Runbook `docs/deployment.md` Abschnitt 7):
 * `GRANDFATHER_CUTOFF=<ISO-Datum> node dist/cli/grandfatherPlans.js`. Ohne gültigen Stichtag
 * bricht das Skript ohne DB-Zugriff mit Exit-Code 1 ab.
 */
const raw = process.env.GRANDFATHER_CUTOFF?.trim();
const cutoff = raw ? new Date(raw) : undefined;
if (!cutoff || Number.isNaN(cutoff.getTime())) {
	console.error('GRANDFATHER_CUTOFF fehlt oder ist kein gültiges ISO-Datum (z. B. 2026-10-01T00:00:00Z).');
	process.exit(1);
}

// Legt nur fehlende Tabellen an — auf der migrierten Produktions-DB ein No-op.
await sequelize.sync();
const changed = await grandfatherPlans(sequelize, cutoff);
console.log(`Auf ultimate gesetzt: ${changed} Konto/Konten (angelegt vor ${cutoff.toISOString()}, plan=free).`);
console.log('Paketverteilung:', JSON.stringify(await planDistribution(sequelize)));
await sequelize.close();

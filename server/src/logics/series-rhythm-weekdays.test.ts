import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Series, Task } from '../models/index.js';
import { generateDueInstances, nextOccurrence } from './series.js';
import { resetDb, closeDb } from '../test/helpers.js';

// 🔴🔴 Rote Spec-Tests für #467/#469 — wochentag-basierte Rhythmen (weekdays/weekend/mon–sun) 🔴🔴
//
// Das ENUM `SeriesRhythm` wird um `weekdays` (Mo–Fr), `weekend` (Sa+So) und `mon`…`sun` (je genau
// dieser Wochentag) erweitert. Diese Rhythmen erzeugen **mehrere Termine pro Woche** und durchbrechen
// damit das bisherige „ein Termin je Periode"-Modell.
//
// **Vertragsoberfläche (benannt im Issue #467):** Die `nextOccurrence`-Logik in `logics/series.ts`
// „muss für diese Werte wochentag-basiert filtern statt ein Schritt pro Periode zu addieren". Sie
// ist die zentrale Stelle, die die neuen Rhythmen kennen muss — daher ist sie die Vertragsfläche
// dieser Spec. Vor der Umsetzung ist `nextOccurrence` nicht exportiert → dieser Test-File ist beim
// Modul-Import **rot** (Cannot find export), ohne zu hängen. Sobald die Umsetzung `nextOccurrence`
// exportiert und die neuen Werte behandelt, werden alle Tests grün.
//
// **Warum ein separater Test-File:** `generateDueInstances` enthält eine synchrone `while`-Schleife,
// die für unbekannte Rhythmen terminiert (nextOccurrence unverändert → Endlosschleife). Ein Test
// gegen die noch fehlende Funktion über `generateDueInstances` würde *hängen* statt sauber rot zu
// sein. Die reine Stepper-Funktion ist hängfrei testbar; die Integration (Persistenz, Idempotenz)
// folgt automatisch, sobald der Stepper stimmt. KEIN Produktivcode.
beforeEach(resetDb);
after(closeDb);

const ONE_DAY = 24 * 60 * 60 * 1000;

// Wochentag-Konstanten (UTC): 0=So, 1=Mo, 2=Di, 3=Mi, 4=Do, 5=Fr, 6=Sa.
const MON = 1;
const TUE = 2;
const WED = 3;
const THU = 4;
const FRI = 5;
const SAT = 6;
const SUN = 0;

/** Ein UTC-Mitternacht-Datum aus Jahr/Monat(0-basiert)/Tag. */
const utcDate = (year: number, month: number, day: number): Date => new Date(Date.UTC(year, month, day));

describe('nextOccurrence — wochentag-basierte Rhythmen (#467 weekdays/weekend/mon–sun)', () => {
	// AK1 (Werktags): weekdays schreitet Werktags für Werktag weiter (Mo→Di→…→Fr→Mo), überspringt
	// das Wochenende. So entstehen je Woche 5 Termine, nie Sa/So.
	it('weekdays: von Mo auf Di, …, Fr auf (nächsten) Mo — überspringt Wochenende (#467 AK1)', () => {
		// anchorDay ist für wochentag-basierte Rhythmen ohne Bedeutung (1 übergeben).
		const anchorDay = 1;
		assert.equal(nextOccurrence(utcDate(2026, 0, 5), 'weekdays', anchorDay).getUTCDay(), TUE, 'Mo→Di'); // 5.1.2026 = Mo
		assert.equal(nextOccurrence(utcDate(2026, 0, 6), 'weekdays', anchorDay).getUTCDay(), WED, 'Di→Mi');
		assert.equal(nextOccurrence(utcDate(2026, 0, 7), 'weekdays', anchorDay).getUTCDay(), THU, 'Mi→Do');
		assert.equal(nextOccurrence(utcDate(2026, 0, 8), 'weekdays', anchorDay).getUTCDay(), FRI, 'Do→Fr');
		// Fr (8.1.) → Mo (12.1.), überspringt Sa/So — das Wochenende wird NICHT beliefert.
		const afterFri = nextOccurrence(utcDate(2026, 0, 8), 'weekdays', anchorDay);
		assert.equal(afterFri.getUTCDay(), MON, 'Fr→Mo (Wochenende übersprungen)');
		assert.equal(afterFri.getUTCDate(), 12, 'Fr 8.1. → Mo 12.1. (3 Tage später)');
	});

	// AK2 (Wochenende): weekend schreitet Sa→So→Sa, beliefert nie Werktage.
	it('weekend: Sa→So→Sa — beliefert nur Wochenende (#467 AK2)', () => {
		const anchorDay = 1;
		// 10.1.2026 = Sa
		assert.equal(nextOccurrence(utcDate(2026, 0, 10), 'weekend', anchorDay).getUTCDay(), SUN, 'Sa→So');
		// 11.1.2026 = So → Sa (nächste Woche)
		const afterSun = nextOccurrence(utcDate(2026, 0, 11), 'weekend', anchorDay);
		assert.equal(afterSun.getUTCDay(), SAT, 'So→Sa (nächste Woche)');
		assert.equal(afterSun.getUTCDate(), 17, 'So 11.1. → Sa 17.1. (6 Tage später)');
	});

	// AK3 (fester Wochentag): jeder einzelne Wochentag springt +7 Tage auf denselben Wochentag.
	it('mon…sun: fester Wochentag springt genau 7 Tage weiter auf denselben Tag (#467 AK3)', () => {
		const anchorDay = 1;
		const wed = utcDate(2026, 0, 7); // 7.1.2026 = Mi
		const nextWed = nextOccurrence(wed, 'wed', anchorDay);
		assert.equal(nextWed.getUTCDay(), WED, 'wed → bleibt Mittwoch');
		assert.equal(nextWed.getTime() - wed.getTime(), 7 * ONE_DAY, 'wed → +7 Tage');

		// Stichproben über alle Einzeltage: Sprung um genau 7 Tage, Wochentag konstant.
		const cases: Array<{ rhythm: string; day: number }> = [
			{ rhythm: 'mon', day: MON },
			{ rhythm: 'tue', day: TUE },
			{ rhythm: 'thu', day: THU },
			{ rhythm: 'fri', day: FRI },
			{ rhythm: 'sat', day: SAT },
			{ rhythm: 'sun', day: SUN },
		];
		// Finde je Wochentag ein Referenzdatum im Januar 2026.
		for (const { rhythm, day } of cases) {
			let d = utcDate(2026, 0, 1);
			while (d.getUTCDay() !== day) {
				d = new Date(d.getTime() + ONE_DAY);
			}
			const next = nextOccurrence(d, rhythm as never, anchorDay);
			assert.equal(next.getUTCDay(), day, `${rhythm} → Wochentag konstant (${day})`);
			assert.equal(next.getTime() - d.getTime(), 7 * ONE_DAY, `${rhythm} → +7 Tage`);
		}
	});
});

describe('generateDueInstances — wochentag-basierte Rhythmen Integration (#467 AK1/AK2/AK4)', () => {
	// Diese Integrationstests laufen gegen die öffentliche generateDueInstances-API und werden erst
	// grün, sobald nextOccurrence die neuen Werte behandelt (die Stepper-Tests oben definieren das
	// Verhalten). Sie prüfen die Materialisierung mit Persistenz und Idempotenz.

	const futureDate = (offsetDays: number): Date => {
		const result = new Date();
		result.setUTCDate(result.getUTCDate() + offsetDays);
		result.setUTCHours(0, 0, 0, 0);
		return result;
	};
	const futureWeekday = (targetDay: number): Date => {
		const result = futureDate(1);
		const diff = (targetDay - result.getUTCDay() + 7) % 7;
		result.setUTCDate(result.getUTCDate() + diff);
		return result;
	};

	// AK1 (Werktags): weekdays materialisiert je Woche genau 5 Tasks (Mo–Fr), keine am Wochenende.
	it('weekdays materialisiert je Woche genau 5 Tasks (Mo–Fr), keine am Wochenende (#467 AK1)', async () => {
		const start = futureWeekday(MON);
		const series = await Series.create({
			title: 'Werktags',
			rhythm: 'weekdays',
			priority: 3,
			estimatedEffort: 0.5,
			active: true,
			startDate: start,
		});
		const until = new Date(start.getTime() + 6 * ONE_DAY);
		const instances = await generateDueInstances(series, { until });

		assert.equal(instances.length, 5, 'genau 5 Termine (Mo–Fr) in der Woche');
		for (const inst of instances) {
			const day = new Date(inst.deadline as unknown as Date).getUTCDay();
			assert.ok(day >= MON && day <= FRI, `Termin auf Werktag (day=${day}), nicht am Wochenende`);
		}
		const persisted = await Task.count({ where: { seriesId: series.id } });
		assert.equal(persisted, 5);
	});

	// AK2 (Wochenende): weekend materialisiert je Woche genau 2 Tasks (Sa, So).
	it('weekend materialisiert je Woche genau 2 Tasks (Sa, So) (#467 AK2)', async () => {
		const start = futureWeekday(SAT);
		const series = await Series.create({
			title: 'Wochenende',
			rhythm: 'weekend',
			priority: 3,
			estimatedEffort: 0.5,
			active: true,
			startDate: start,
		});
		const until = new Date(start.getTime() + 1 * ONE_DAY);
		const instances = await generateDueInstances(series, { until });

		assert.equal(instances.length, 2, 'genau 2 Termine (Sa, So) am Wochenende');
		for (const inst of instances) {
			const day = new Date(inst.deadline as unknown as Date).getUTCDay();
			assert.ok(day === SAT || day === SUN, `Termin am Wochenende (day=${day})`);
		}
	});

	// AK4 (Idempotenz bleibt gewahrt): erneute Generierung desselben Fensters → keine Dubletten.
	it('weekdays: zweite Generierung desselben Fensters erzeugt keine Dubletten (#467 AK4)', async () => {
		const start = futureWeekday(MON);
		const series = await Series.create({
			title: 'Werktags idempotent',
			rhythm: 'weekdays',
			priority: 3,
			estimatedEffort: 0.5,
			active: true,
			startDate: start,
		});
		const until = new Date(start.getTime() + 6 * ONE_DAY);

		const first = await generateDueInstances(series, { until });
		assert.equal(first.length, 5, 'erster Lauf erzeugt 5 Werktags-Termine');

		const second = await generateDueInstances(series, { until });
		assert.equal(second.length, 0, 'zweiter Lauf erzeugt keine Dubletten');

		const total = await Task.count({ where: { seriesId: series.id } });
		assert.equal(total, 5, 'insgesamt bleiben es genau 5 Instanzen');
	});
});

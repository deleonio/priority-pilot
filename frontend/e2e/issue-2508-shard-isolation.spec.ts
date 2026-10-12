import { expect, test } from './fixtures';

/**
 * Isolations-Probe zur Shard-Isolation (#2508, Spec: `docs/spec/issue-2508.md`, AK1).
 *
 * Spielzug wie im CI-Shard: ein früherer Test (im echten Lauf eine fremde Spec) legt Daten an,
 * ein späterer Test liest die Liste und darf nur seine eigenen Daten sehen. Rot vor dem
 * Fixture-Umbau — beide Tests laufen ohne Session in denselben Pass-Through-Bestand
 * (`ownerScope(undefined)`, `server/src/logics/ownerScope.ts`) —, grün danach, wenn die Fixture
 * je Test eine eigene Session registriert.
 */
const FOREIGN_TITLE = 'Issue 2508 Isolationsprobe - Fremddaten aus vorheriger Spec';
const OWN_TITLE = 'Issue 2508 Isolationsprobe - Eigendaten dieser Spec';

test('Shard-Nachbar legt Daten an (Simulierung einer vorherigen Spec)', async ({ request }) => {
	const response = await request.post('/api/v1/tasks', { data: { title: FOREIGN_TITLE } });
	expect(response.ok()).toBeTruthy();
});

test('datenschreibende Spec sieht nur ihre eigenen Daten', async ({ request }) => {
	const created = await request.post('/api/v1/tasks', { data: { title: OWN_TITLE } });
	expect(created.ok()).toBeTruthy();
	const list = (await (await request.get('/api/v1/tasks')).json()) as { title: string }[];
	const titles = list.map((task) => task.title);
	expect(titles).toContain(OWN_TITLE);
	expect(titles.filter((title) => title === FOREIGN_TITLE)).toHaveLength(0);
});

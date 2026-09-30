import { cleanup, render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
// ROTER Spec-Test (#1360, Spec docs/spec/issue-1360.md): `StreakCard` existiert noch nicht.
// Der Import schlägt fehl, bis `frontend/src/components/StreakCard.tsx` die Komponente bereitstellt.
import { StreakCard } from './StreakCard';

/**
 * Spec-Tests für die Streak-Card (AK5, #1360): zeigt aktuellen Streak + Bestmarke aus
 * `GET /scores/streak`; bei `aktuell = 0` erscheint ein gestalteter Zustandstext statt einer
 * kontextlosen Zahl, die Bestmarke bleibt sichtbar.
 *
 * KoliBri und `api` werden modulweit gemockt (Muster `NearbyCard.test.tsx`).
 */

type Streak = { aktuell: number; best: number; letzterTag: string | null };

vi.mock('@public-ui/react-v19', () => ({
	KolCard: ({ _label, children }: { _label?: string; children?: ReactNode }) => (
		<div data-comp="kol-card" data-label={_label}>
			{children}
		</div>
	),
	KolDetails: ({ _label, children }: { _label?: string; children?: ReactNode }) => (
		<details>
			<summary>{_label}</summary>
			{children}
		</details>
	),
}));

const getStreak = vi.fn<() => Promise<Streak>>();

vi.mock('../api', () => ({
	api: {
		getStreak: () => getStreak(),
	},
}));

const card = (): HTMLElement => document.querySelector('[data-comp="kol-card"]') as HTMLElement;

describe('StreakCard (#1360 AK5)', () => {
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	it('zeigt den aktuellen Streak und die Bestmarke aus GET /scores/streak', async () => {
		getStreak.mockResolvedValue({ aktuell: 3, best: 7, letzterTag: '2026-09-11' });
		render(<StreakCard />);

		await waitFor(() => expect(card()).not.toBeNull());
		expect(card().textContent).toContain('3');
		expect(card().querySelector('[data-testid="streak-best"]')?.textContent).toContain('7');
		expect(card().querySelector('[data-testid="streak-zero"]')).toBeNull();
	});

	it('holt die Daten beim Mount per api.getStreak() (kein hartcodierter Wert)', async () => {
		getStreak.mockResolvedValue({ aktuell: 1, best: 1, letzterTag: '2026-09-11' });
		render(<StreakCard />);

		await waitFor(() => expect(getStreak).toHaveBeenCalledTimes(1));
	});

	it('bei aktuell=0 erscheint der Zustandstext (streak-zero) statt einer nackten „0", Bestmarke bleibt sichtbar', async () => {
		getStreak.mockResolvedValue({ aktuell: 0, best: 5, letzterTag: '2026-09-01' });
		render(<StreakCard />);

		await waitFor(() => expect(card().querySelector('[data-testid="streak-zero"]')).not.toBeNull());
		expect(card().querySelector('[data-testid="streak-best"]')?.textContent).toContain('5');
	});
});

/**
 * Spec-Tests #1819 (docs/spec/issue-1819.md): Hilfetext mit Zähl- und Bruchregel an der Streak-Card,
 * aus i18next (Schlüssel `streak.help.label` / `streak.help.text` im Namespace `common`).
 */
const helpModules = import.meta.glob<{ default: { streak?: { help?: { label?: unknown; text?: unknown } } } }>(
	'../i18n/locales/*/common.json',
	{ eager: true },
);

describe('StreakCard Hilfetext (#1819)', () => {
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	it.each([
		['aktuell > 0', { aktuell: 3, best: 7, letzterTag: '2026-09-11' }],
		['aktuell === 0', { aktuell: 0, best: 5, letzterTag: '2026-09-01' }],
	])('AK1/AK3 — %s: streak-help nennt Zählregel, Fälligkeitstag, Lücke und Bestmarke', async (_name, streak) => {
		getStreak.mockResolvedValue(streak);
		render(<StreakCard />);

		await waitFor(() => expect(card().querySelector('[data-testid="streak-help"]')).not.toBeNull());
		const text = card().querySelector('[data-testid="streak-help"]')!.textContent ?? '';
		expect(text).toMatch(/abhak/i);
		expect(text).toMatch(/Fälligkeitstag/);
		expect(text).toMatch(/gestern/);
		expect(text).toMatch(/Bestmarke/);
		expect(text).not.toMatch(/spielt keine Rolle/i);
	});

	it('AK2 — Label und Text sind in allen 10 Sprachen nicht leer', () => {
		const languages = Object.keys(helpModules).map((path) => /locales\/([^/]+)\//.exec(path)![1]);
		expect(languages.sort()).toHaveLength(10);
		for (const [path, module] of Object.entries(helpModules)) {
			const help = module.default.streak?.help;
			expect(typeof help?.label === 'string' && help.label.trim() !== '', `${path} streak.help.label`).toBe(true);
			expect(typeof help?.text === 'string' && help.text.trim() !== '', `${path} streak.help.text`).toBe(true);
		}
	});
});

import { cleanup, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { Pillar } from 'client';
import { afterEach, describe, expect, it, vi } from 'vitest';

// `Modal` nutzt KoliBris `KolDialog` (natives `<dialog>`), das in jsdom nicht lauffähig ist
// (`dialog.close is not a function`). Für diesen Komponententest reduzieren wir das Modal auf
// einen reinen Passthrough — die Kurzbeschreibung wird von `PillarWeightsModal` selbst gerendert,
// nicht vom Dialog-Rahmen, sodass die Logik isoliert und deterministisch prüfbar bleibt.
vi.mock('./Modal', () => ({
	Modal: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

import { PillarWeightsModal } from './PillarWeightsModal';

afterEach(cleanup);

const pillar = (id: number, name: string, description: string, weight: number): Pillar => ({
	id,
	name,
	description,
	weight,
});

/**
 * Die Kurzbeschreibung der Säulen (globale Stammdaten) wird im Einstellungs-Modal unter dem
 * jeweiligen Slider ausgegeben, damit beim Gewichten sofort erkennbar ist, wofür eine Säule steht.
 * Dieser Test sichert, dass die aus der API gelieferte `description` je Säule wirklich gerendert wird.
 */
describe('PillarWeightsModal — Kurzbeschreibung je Säule', () => {
	it('zeigt die Beschreibung jeder Säule unter dem Slider an', () => {
		const pillars = [
			pillar(1, 'Körper', 'Physische Gesundheit: Bewegung, Ernährung, Schlaf, Vorsorge.', 40),
			pillar(2, 'Sinn', 'Das „Wofür": Werte, Lebensziele, Spiritualität, Ehrenamt.', 60),
		];

		const { container } = render(
			<PillarWeightsModal pillars={pillars} onClose={() => undefined} onSaved={() => undefined} />,
		);

		const descriptions = container.querySelectorAll('.pillar-description');
		expect(descriptions).toHaveLength(2);
		expect(descriptions[0]?.textContent).toBe(pillars[0].description);
		expect(descriptions[1]?.textContent).toBe(pillars[1].description);
	});
});

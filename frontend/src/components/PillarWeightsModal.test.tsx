import { cleanup, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { Pillar } from 'client';
import { afterEach, describe, expect, it, vi } from 'vitest';

// `Modal` nutzt KoliBris `KolDialog` (natives `<dialog>`), das in jsdom nicht lauffähig ist
// (`dialog.close is not a function`). Für diesen Komponententest reduzieren wir das Modal auf
// einen reinen Passthrough — der Formularinhalt wird von `PillarWeightsForm` gerendert, nicht
// vom Dialog-Rahmen, sodass die Logik isoliert und deterministisch prüfbar bleibt.
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
 * #934 AK3 — Die Säulen-Gewichtung rendert die Säulen-Beschreibung nicht mehr pro Slider
 * (`.pillar-description` entfällt): dieselben Beschreibungen stehen bereits in der Säulenliste
 * darüber (`.pillar-list-description`, siehe PillarList.test.tsx) — die Wiederholung ist
 * redundant und verursachte Layout-Umbrüche. Der Test ist rot, solange `PillarWeightsForm`
 * den Beschreibungs-Absatz noch rendert.
 */
describe('PillarWeightsModal — keine Säulen-Beschreibung mehr je Slider (#934 AK3)', () => {
	it('rendert kein .pillar-description-Element, wohl aber je Säule ein Range-Feld', () => {
		const pillars = [
			pillar(1, 'Körper', 'Physische Gesundheit: Bewegung, Ernährung, Schlaf, Vorsorge.', 40),
			pillar(2, 'Sinn', 'Das „Wofür": Werte, Lebensziele, Spiritualität, Ehrenamt.', 60),
		];

		const { container } = render(
			<PillarWeightsModal pillars={pillars} onClose={() => undefined} onSaved={() => undefined} />,
		);

		// Guard gegen einen dauerhaft grünen Test über eine leere Menge: Das Formular muss
		// wirklich gerendert sein — je Säule ein Range-Feld im Gewichtungs-Grid.
		const ranges = container.querySelectorAll('.pillar-weights-grid kol-input-range');
		expect(ranges).toHaveLength(pillars.length);

		// Kern-Assertion (AK3): keine je-Säule-Beschreibung mehr im DOM.
		expect(container.querySelectorAll('.pillar-description')).toHaveLength(0);
	});
});

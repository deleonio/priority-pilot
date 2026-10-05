import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
// ROTER Spec-Test (#1997, docs/spec/issue-1997.md): `YearlyRecapCard` existiert noch nicht.
// Der Import schlägt fehl, bis `frontend/src/components/YearlyRecapCard.tsx` die Komponente bereitstellt.
import { YearlyRecapCard } from './YearlyRecapCard';

/**
 * Spec-Tests für die Jahresrückblick-Card (#1997): Sichtbarkeit nur im Januar (AK5), Datenabruf
 * des Vorjahres, Kennzahlen als Text im Card-DOM, Teilen als Web Share mit PNG und
 * Download-Fallback mit Jahres-Dateinamen. KoliBri und `api` werden modulweit gemockt (Muster
 * `MonthlyBalanceCard.test.tsx`); Canvas und `Image` sind gestubbt.
 */

const IM_JANUAR = new Date(2026, 0, 15, 12);
const IM_FEBRUAR = new Date(2026, 1, 3, 12);

const RECAP = {
	jahr: 2025,
	erledigteAufgaben: 412,
	stunden: 187.5,
	laengsterStreak: 33,
	staerksteSaeule: { id: 1, name: 'Bewegung', punkte: 91 },
	abgeschlosseneProjekte: 7,
};

type OnClick = { onClick?: (event?: unknown) => void };

vi.mock('@public-ui/react-v19', () => ({
	KolCard: ({ _label, children, ...rest }: { _label?: string; children?: ReactNode } & Record<string, unknown>) => (
		<div data-comp="kol-card" data-label={_label} {...rest}>
			{children}
		</div>
	),
	KolButton: ({ _label, _on, 'data-testid': testid }: { _label?: string; _on?: OnClick; 'data-testid'?: string }) => (
		<button data-testid={testid} onClick={() => _on?.onClick?.({})}>
			{_label}
		</button>
	),
	KolSpin: ({ _label }: { _label?: string }) => <div data-comp="kol-spin">{_label}</div>,
	KolAlert: ({ _type, children }: { _type?: string; children?: ReactNode }) => (
		<div data-comp="kol-alert" data-type={_type}>
			{children}
		</div>
	),
}));

const getYearlyRecap = vi.fn();

vi.mock('../api', () => ({
	api: {
		getYearlyRecap: (...args: unknown[]) => getYearlyRecap(...args),
	},
}));

getYearlyRecap.mockResolvedValue(RECAP);

/** jsdom-Stub: SVG→PNG-Rasterisierung (Canvas 2D, toBlob, Bildladen) ohne echte Canvas-Engine. */
const stubRasterisierung = (): void => {
	class FakeImage {
		onload: (() => void) | null = null;
		onerror: (() => void) | null = null;
		decode = (): Promise<void> => Promise.resolve();
		set src(_value: string) {
			queueMicrotask(() => this.onload?.());
		}
	}
	vi.stubGlobal('Image', FakeImage);
	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as CanvasRenderingContext2D);
	vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
		callback(new Blob(['png-bytes'], { type: 'image/png' }));
	});
};

const installShare = (faehig: boolean): { share: ReturnType<typeof vi.fn>; canShare: ReturnType<typeof vi.fn> } => {
	const share = vi.fn().mockResolvedValue(undefined);
	const canShare = vi.fn(() => faehig);
	Object.defineProperty(navigator, 'share', { value: share, configurable: true });
	Object.defineProperty(navigator, 'canShare', { value: canShare, configurable: true });
	return { share, canShare };
};

const cardEl = (): HTMLElement | null => document.querySelector('[data-testid="yearly-recap-card"]');

describe('YearlyRecapCard (#1997)', () => {
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	it('AK5: außerhalb des Januars erscheint weder Card noch Aktionen, es wird nichts geladen', () => {
		vi.useFakeTimers({ now: IM_FEBRUAR, shouldAdvanceTime: true });
		render(<YearlyRecapCard />);
		expect(cardEl()).toBeNull();
		expect(document.querySelector('[data-testid="yearly-share"]')).toBeNull();
		expect(document.querySelector('[data-testid="yearly-download"]')).toBeNull();
		expect(getYearlyRecap).not.toHaveBeenCalled();
	});

	it('AK5: im Januar rendert die Card und lädt das Vorjahr mit Zeitzone', async () => {
		vi.useFakeTimers({ now: IM_JANUAR, shouldAdvanceTime: true });
		render(<YearlyRecapCard />);
		await waitFor(() => expect(cardEl()).not.toBeNull());
		await waitFor(() =>
			expect(getYearlyRecap).toHaveBeenCalledWith(expect.objectContaining({ jahr: 2025, tz: expect.any(String) })),
		);
	});

	it('AK5: die Kennzahlen stehen als Text im Card-DOM', async () => {
		vi.useFakeTimers({ now: IM_JANUAR, shouldAdvanceTime: true });
		render(<YearlyRecapCard />);
		await waitFor(() => expect(document.body.textContent).toContain('Bewegung'));
		const text = document.body.textContent ?? '';
		expect(text).toMatch(/\b412\b/);
		expect(text).toMatch(/187[.,]5/);
		expect(text).toMatch(/\b33\b/);
		expect(text).toMatch(/\b7\b/);
	});

	it('Teilen ruft navigator.share mit der erzeugten PNG auf', async () => {
		vi.useFakeTimers({ now: IM_JANUAR, shouldAdvanceTime: true });
		stubRasterisierung();
		const { share, canShare } = installShare(true);
		render(<YearlyRecapCard />);
		await waitFor(() => expect(document.querySelector('[data-testid="yearly-share"]')).not.toBeNull());
		fireEvent.click(document.querySelector('[data-testid="yearly-share"]') as HTMLElement);

		await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
		expect(canShare).toHaveBeenCalledWith(expect.objectContaining({ files: expect.anything() }));
		expect((share.mock.calls[0][0] as ShareData).files?.[0]?.type).toBe('image/png');
	});

	it('Speichern: Download-Anker mit Jahres-Dateinamen und Blob-URL', async () => {
		vi.useFakeTimers({ now: IM_JANUAR, shouldAdvanceTime: true });
		stubRasterisierung();
		installShare(false);
		Object.defineProperty(URL, 'createObjectURL', { value: () => 'blob:mock', configurable: true });
		const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
		render(<YearlyRecapCard />);
		await waitFor(() => expect(document.querySelector('[data-testid="yearly-download"]')).not.toBeNull());
		fireEvent.click(document.querySelector('[data-testid="yearly-download"]') as HTMLElement);

		await waitFor(() => expect(click).toHaveBeenCalled());
		const anker = click.mock.contexts[0] as HTMLAnchorElement;
		expect(anker.download).toBe('balamentum-jahr-2025.png');
		expect(anker.href).toMatch(/^blob:/);
	});
});

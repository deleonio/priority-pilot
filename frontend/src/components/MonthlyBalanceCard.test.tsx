import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
// ROTER Spec-Test (#1995, docs/spec/issue-1995.md): `MonthlyBalanceCard` existiert noch nicht.
// Der Import schlägt fehl, bis `frontend/src/components/MonthlyBalanceCard.tsx` die Komponente bereitstellt.
import { MonthlyBalanceCard } from './MonthlyBalanceCard';

/**
 * Spec-Tests für die Rückblick-Card (#1995): Sichtbarkeit nur im Monatsanfangs-Fenster
 * (Tag 1–7, AK4), Datenabruf des Vormonats, Werte als Text im Card-DOM (AK2), Teilen als
 * Web Share mit der gerasterten PNG und Download-Fallback mit Monats-Dateinamen (AK4).
 *
 * KoliBri und `api` werden modulweit gemockt (Muster `WeeklyBalanceCard.test.tsx`); Canvas und
 * `Image` sind gestubbt, weil jsdom weder einen 2D-Kontext noch das Laden von Bildern mitbringt.
 */

// Tag 2 des Monats (im Gate-Fenster) und Tag 15 (danach) — Oktober 2026, Mittags (tz-kanten-sicher).
const MONATSANFANG = new Date(2026, 9, 2, 12);
const MONATSMITTE = new Date(2026, 9, 15, 12);

const RECAP = {
	monat: '2026-09',
	saeulen: [
		{ id: 1, name: 'Bewegung', punkte: 7 },
		{ id: 2, name: 'Ernährung', punkte: 0 },
		{ id: 3, name: 'Schlaf', punkte: 4 },
		{ id: 4, name: 'Achtsamkeit', punkte: 0 },
		{ id: 5, name: 'Soziales', punkte: 2 },
	],
	streak: 12,
	meilensteine: [{ schluessel: 'streak-7', zeitpunkt: '2026-09-14T10:00:00.000Z' }],
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
	// #2255: Domain-Link in der Marken-Fußzeile (KoliBri-First) — als natives <a> gerendert.
	KolLink: ({ _href, _label }: { _href?: string; _label?: string }) => <a href={_href}>{_label}</a>,
	KolAlert: ({ _type, children }: { _type?: string; children?: ReactNode }) => (
		<div data-comp="kol-alert" data-type={_type}>
			{children}
		</div>
	),
}));

const getMonthlyRecap = vi.fn();

vi.mock('../api', () => ({
	api: {
		getMonthlyRecap: (...args: unknown[]) => getMonthlyRecap(...args),
	},
}));

getMonthlyRecap.mockResolvedValue(RECAP);

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

/** `navigator.share`/`navigator.canShare` existieren in jsdom nicht — per defineProperty einsetzen. */
const installShare = (faehig: boolean): { share: ReturnType<typeof vi.fn>; canShare: ReturnType<typeof vi.fn> } => {
	const share = vi.fn().mockResolvedValue(undefined);
	const canShare = vi.fn(() => faehig);
	Object.defineProperty(navigator, 'share', { value: share, configurable: true });
	Object.defineProperty(navigator, 'canShare', { value: canShare, configurable: true });
	return { share, canShare };
};

const cardEl = (): HTMLElement | null => document.querySelector('[data-testid="monthly-balance-card"]');

describe('MonthlyBalanceCard (#1995)', () => {
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	it('AK4: nach dem Monatsanfangs-Fenster erscheint weder Card noch Aktionen', () => {
		vi.useFakeTimers({ now: MONATSMITTE, shouldAdvanceTime: true });
		render(<MonthlyBalanceCard />);
		expect(cardEl()).toBeNull();
		expect(document.querySelector('[data-testid="monthly-share"]')).toBeNull();
		expect(document.querySelector('[data-testid="monthly-download"]')).toBeNull();
	});

	it('AK4: im Fenster rendert die Card und lädt den Vormonat mit Zeitzone', async () => {
		vi.useFakeTimers({ now: MONATSANFANG, shouldAdvanceTime: true });
		render(<MonthlyBalanceCard />);
		await waitFor(() => expect(cardEl()).not.toBeNull());
		expect(document.querySelector('[data-testid="monthly-share"]')).not.toBeNull();
		expect(document.querySelector('[data-testid="monthly-download"]')).not.toBeNull();
		await waitFor(() =>
			expect(getMonthlyRecap).toHaveBeenCalledWith(
				expect.objectContaining({ monat: '2026-09', tz: expect.any(String) }),
			),
		);
	});

	it('AK2: die Werte stehen zusätzlich als Text im Card-DOM (Säulen, Streak, Meilenstein)', async () => {
		vi.useFakeTimers({ now: MONATSANFANG, shouldAdvanceTime: true });
		render(<MonthlyBalanceCard />);
		await waitFor(() => expect(document.body.textContent).toContain('Bewegung'));
		const text = document.body.textContent ?? '';
		for (const saeule of RECAP.saeulen) {
			expect(text).toContain(saeule.name);
		}
		expect(text).toContain('12');
		expect(text).toContain('streak-7');
	});

	it('AK4: Teilen ruft navigator.share mit der erzeugten PNG auf', async () => {
		vi.useFakeTimers({ now: MONATSANFANG, shouldAdvanceTime: true });
		stubRasterisierung();
		const { share, canShare } = installShare(true);
		render(<MonthlyBalanceCard />);
		await waitFor(() => expect(document.querySelector('[data-testid="monthly-share"]')).not.toBeNull());
		fireEvent.click(document.querySelector('[data-testid="monthly-share"]') as HTMLElement);

		await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
		expect(canShare).toHaveBeenCalledWith(expect.objectContaining({ files: expect.anything() }));
		const daten = share.mock.calls[0][0] as ShareData;
		expect(daten.files?.[0]?.type).toBe('image/png');
	});

	it('AK4: Download-Anker mit Monats-Dateinamen (Vormonat) und Blob-URL', async () => {
		vi.useFakeTimers({ now: MONATSANFANG, shouldAdvanceTime: true });
		stubRasterisierung();
		installShare(false);
		Object.defineProperty(URL, 'createObjectURL', { value: () => 'blob:mock', configurable: true });
		const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
		render(<MonthlyBalanceCard />);
		await waitFor(() => expect(document.querySelector('[data-testid="monthly-download"]')).not.toBeNull());
		fireEvent.click(document.querySelector('[data-testid="monthly-download"]') as HTMLElement);

		await waitFor(() => expect(click).toHaveBeenCalled());
		const anker = click.mock.contexts[0] as HTMLAnchorElement;
		expect(anker.download).toBe('balamentum-monat-2026-09.png');
		expect(anker.href).toMatch(/^blob:/);
		expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalled();
	});

	it('AK4 (#2255): Marken-Fußzeile — drei Logos mit Alt-Text, Domain als einziger Link, kein Store-Link', async () => {
		vi.useFakeTimers({ now: MONATSANFANG, shouldAdvanceTime: true });
		render(<MonthlyBalanceCard />);
		await waitFor(() => expect(cardEl()).not.toBeNull());

		// Drei Logos (Balamentum, Google Play, PWA) — jedes mit Alt-Text (Botschaft, nicht Objektbeschreibung).
		const logos = [...document.querySelectorAll('[data-testid="monthly-balance-card"] img')];
		expect(logos.length, 'drei Marken-Logos erwartet').toBe(3);
		for (const logo of logos) {
			expect(logo.getAttribute('alt'), 'Alt-Text fehlt').toBeTruthy();
		}

		// Domain-Link: der einzige Link der Karte — kein play.google.com, kein Install-Button.
		const links = [...document.querySelectorAll('[data-testid="monthly-balance-card"] a')];
		expect(links.length, 'genau der Domain-Link erwartet').toBe(1);
		expect(links[0].getAttribute('href')).toBe('https://balamentum.app');
		expect(document.querySelector('[data-testid="monthly-balance-card"]')?.innerHTML).not.toContain('play.google.com');
	});
});

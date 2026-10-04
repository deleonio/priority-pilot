import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
// ROTER Spec-Test (#1968, docs/spec/issue-1968.md): `WeeklyBalanceCard` existiert noch nicht.
// Der Import schlägt fehl, bis `frontend/src/components/WeeklyBalanceCard.tsx` die Komponente bereitstellt.
import { WeeklyBalanceCard } from './WeeklyBalanceCard';

/**
 * Spec-Tests für die teilbare Wochen-Balance-Karte (#1968): Teilen über Web Share mit der
 * erzeugten PNG (AK2), Download als Rasterisierungs-Fallback mit KW/Jahr-Dateinamen (AK3),
 * Sichtbarkeit frühestens am Sonntag der laufenden Woche (AK4).
 *
 * KoliBri und `api` werden modulweit gemockt (Muster `StreakCard.test.tsx`); Canvas und
 * `Image` sind gestubbt, weil jsdom weder einen 2D-Kontext noch das Laden von Bildern mitbringt.
 */

// KW-Grenzen: Mittwoch 07.10.2026 und Sonntag 11.10.2026 (Kalenderwoche 41, Montag–Sonntag).
const MITTWOCH = new Date(2026, 9, 7, 12);
const SONNTAG = new Date(2026, 9, 11, 12);

type OnClick = { onClick?: (event?: unknown) => void };

vi.mock('@public-ui/react-v19', () => ({
	KolCard: ({ _label, children, ...rest }: { _label?: string; children?: ReactNode } & Record<string, unknown>) => (
		<div data-comp="kol-card" data-label={_label} {...rest}>
			{children}
		</div>
	),
	KolButton: ({
		_label,
		_on,
		_variant,
		'data-testid': testid,
	}: {
		_label?: string;
		_on?: OnClick;
		_variant?: string;
		'data-testid'?: string;
	}) => (
		<button data-testid={testid} data-variant={_variant} onClick={() => _on?.onClick?.({})}>
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

const getBalanceHistory = vi.fn();
const getStreak = vi.fn();
const getBalanceStatus = vi.fn();
const postWochenkarteShare = vi.fn();

vi.mock('../api', () => ({
	api: {
		getBalanceHistory: (...args: unknown[]) => getBalanceHistory(...args),
		getStreak: (...args: unknown[]) => getStreak(...args),
		getBalanceStatus: (...args: unknown[]) => getBalanceStatus(...args),
		postWochenkarteShare: (...args: unknown[]) => postWochenkarteShare(...args),
	},
}));

getBalanceHistory.mockResolvedValue({ tage: [] });
getStreak.mockResolvedValue({ aktuell: 12, best: 20, letzterTag: null });
getBalanceStatus.mockResolvedValue({ fuellstand: [] });

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

const cardEl = (): HTMLElement | null => document.querySelector('[data-testid="weekly-balance-card"]');

describe('WeeklyBalanceCard (#1968)', () => {
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	it('AK4: vor Sonntag erscheint weder Card noch Teilen-Button', () => {
		vi.useFakeTimers({ now: MITTWOCH, shouldAdvanceTime: true });
		render(<WeeklyBalanceCard />);
		expect(cardEl()).toBeNull();
		expect(document.querySelector('[data-testid="weekly-share"]')).toBeNull();
	});

	it('AK4: am Sonntag rendert die Card mit Teilen- und Download-Button', async () => {
		vi.useFakeTimers({ now: SONNTAG, shouldAdvanceTime: true });
		render(<WeeklyBalanceCard />);
		await waitFor(() => expect(cardEl()).not.toBeNull());
		expect(document.querySelector('[data-testid="weekly-share"]')).not.toBeNull();
		expect(document.querySelector('[data-testid="weekly-download"]')).not.toBeNull();
	});

	it('AK2: Teilen ruft bei canShare genau einmal navigator.share mit der erzeugten PNG auf', async () => {
		vi.useFakeTimers({ now: SONNTAG, shouldAdvanceTime: true });
		stubRasterisierung();
		const { share, canShare } = installShare(true);
		render(<WeeklyBalanceCard />);
		await waitFor(() => expect(document.querySelector('[data-testid="weekly-share"]')).not.toBeNull());
		fireEvent.click(document.querySelector('[data-testid="weekly-share"]') as HTMLElement);

		await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
		expect(canShare).toHaveBeenCalledWith(expect.objectContaining({ files: expect.anything() }));
		const daten = share.mock.calls[0][0] as ShareData;
		expect(daten.files?.[0]?.type).toBe('image/png');
		expect(typeof daten.title).toBe('string');
		expect(typeof daten.text).toBe('string');
	});

	it('AK2: ohne File-Share-Fähigkeit bleibt share stumm, der Download-Pfad funktioniert (kein toter Button)', async () => {
		vi.useFakeTimers({ now: SONNTAG, shouldAdvanceTime: true });
		stubRasterisierung();
		const { share } = installShare(false);
		Object.defineProperty(URL, 'createObjectURL', { value: () => 'blob:mock', configurable: true });
		render(<WeeklyBalanceCard />);
		await waitFor(() => expect(cardEl()).not.toBeNull());
		const download = document.querySelector('[data-testid="weekly-download"]');
		expect(download).not.toBeNull();
		fireEvent.click(download as HTMLElement);

		await waitFor(() => expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalled());
		expect(share).not.toHaveBeenCalled();
	});

	it('AK4 (#1989): nach erfolgreichem navigator.share feuert der Wochenkarten-Share-Ping', async () => {
		vi.useFakeTimers({ now: SONNTAG, shouldAdvanceTime: true });
		stubRasterisierung();
		const { share } = installShare(true);
		render(<WeeklyBalanceCard />);
		await waitFor(() => expect(document.querySelector('[data-testid="weekly-share"]')).not.toBeNull());
		fireEvent.click(document.querySelector('[data-testid="weekly-share"]') as HTMLElement);

		await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
		expect(postWochenkarteShare).toHaveBeenCalledTimes(1);
	});

	it('AK4 (#1989): Download-Fallback ohne Share feuert keinen Wochenkarten-Ping', async () => {
		vi.useFakeTimers({ now: SONNTAG, shouldAdvanceTime: true });
		stubRasterisierung();
		const { share } = installShare(false);
		Object.defineProperty(URL, 'createObjectURL', { value: () => 'blob:mock', configurable: true });
		render(<WeeklyBalanceCard />);
		await waitFor(() => expect(document.querySelector('[data-testid="weekly-download"]')).not.toBeNull());
		fireEvent.click(document.querySelector('[data-testid="weekly-download"]') as HTMLElement);

		await waitFor(() => expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalled());
		expect(share).not.toHaveBeenCalled();
		expect(postWochenkarteShare).not.toHaveBeenCalled();
	});

	it('AK3: Download-Anker mit download-Attribut (KW/Jahr), Blob-URL und Canvas-Rasterisierung', async () => {
		vi.useFakeTimers({ now: SONNTAG, shouldAdvanceTime: true });
		stubRasterisierung();
		installShare(false);
		Object.defineProperty(URL, 'createObjectURL', { value: () => 'blob:mock', configurable: true });
		const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
		render(<WeeklyBalanceCard />);
		await waitFor(() => expect(document.querySelector('[data-testid="weekly-download"]')).not.toBeNull());
		fireEvent.click(document.querySelector('[data-testid="weekly-download"]') as HTMLElement);

		await waitFor(() => expect(click).toHaveBeenCalled());
		const anker = click.mock.contexts[0] as HTMLAnchorElement;
		expect(anker.download).toMatch(/41/); // KW 41 (Sonntag, 11.10.2026)
		expect(anker.download).toMatch(/2026/);
		expect(anker.download).toMatch(/\.png$/);
		expect(anker.href).toMatch(/^blob:/);
		expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalled();
	});
});

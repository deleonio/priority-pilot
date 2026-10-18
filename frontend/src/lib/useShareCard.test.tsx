import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
// ROTER Spec-Test (#2695, docs/spec/issue-2695.md): `useShareCard` existiert noch nicht —
// zur Laufzeit schlägt der Import fehl (erwarteter Rot-Zustand); das @ts-expect-error hält nur
// den Pre-Commit-tsc grün und ist mit der Implementierung zu ENTFERNEN.
// @ts-expect-error rot: Modul entsteht in der Impl-Phase
import { useShareCard } from './useShareCard';
import { rasterisiere } from './karteRasterisieren';

/**
 * Spec-Tests für den gemeinsamen Share-Card-Hook (#2695): Karten-Erzeugung mit Fehler- und
 * Spinner-Zustand, Download über Object-URL, Teilen per `navigator.canShare` mit AbortError- und
 * Download-Fallback sowie der optionale `onGeteilt`-Rückruf (nur Wochenkarte, #1989).
 *
 * `rasterisiere` ist gemockt (jsdom hat keine Canvas-Engine), `navigator.share`/`canShare` und
 * die Object-URL-Funktionen werden per `defineProperty` eingesetzt (Muster
 * `WeeklyBalanceCard.test.tsx`).
 */

vi.mock('./karteRasterisieren', () => ({ rasterisiere: vi.fn() }));

const PNG_BLOB = (): Blob => new Blob(['png-bytes'], { type: 'image/png' });
const SVG_KARTE = { svg: '<svg/>', dateiname: 'karte.png' };

/** jsdom-Stub: Anker-Klick und Object-URL-Funktionen existieren nicht bzw. nicht spy-bar. */
const installDownload = (): { klick: ReturnType<typeof vi.fn>; revoke: ReturnType<typeof vi.fn> } => {
	const klick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
	const revoke = vi.fn();
	Object.defineProperty(URL, 'createObjectURL', { value: () => 'blob:mock', configurable: true });
	Object.defineProperty(URL, 'revokeObjectURL', { value: revoke, configurable: true });
	return { klick, revoke };
};

/** `navigator.share`/`navigator.canShare` existieren in jsdom nicht — per defineProperty einsetzen. */
const installShare = (faehig: boolean): { share: ReturnType<typeof vi.fn>; canShare: ReturnType<typeof vi.fn> } => {
	const share = vi.fn().mockResolvedValue(undefined);
	const canShare = vi.fn(() => faehig);
	Object.defineProperty(navigator, 'share', { value: share, configurable: true });
	Object.defineProperty(navigator, 'canShare', { value: canShare, configurable: true });
	return { share, canShare };
};

const hookParams = (onGeteilt?: () => void): Record<string, unknown> => ({
	erzeugeSvg: vi.fn(() => ({ ...SVG_KARTE })),
	titel: 'Wochenkarte',
	text: 'KW 41',
	...(onGeteilt ? { onGeteilt } : {}),
});

describe('useShareCard (#2695)', () => {
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
		vi.mocked(rasterisiere).mockResolvedValue(PNG_BLOB());
	});

	it('AK3: speichern startet genau einen Download über Object-URL (Anker mit Dateiname, Revoke)', async () => {
		const { klick, revoke } = installDownload();
		const params = hookParams();
		const { result } = renderHook(() => useShareCard(params as never));

		await act(async () => {
			await result.current.speichern();
		});

		expect(klick).toHaveBeenCalledTimes(1);
		const anker = klick.mock.contexts[0] as HTMLAnchorElement;
		expect(anker.download).toBe(SVG_KARTE.dateiname);
		expect(anker.href).toBe('blob:mock');
		expect(revoke).toHaveBeenCalledWith('blob:mock');
	});

	it('AK3: teilen mit canShare ruft genau einmal navigator.share mit PNG-Datei, Titel und Text', async () => {
		installDownload();
		const { share, canShare } = installShare(true);
		const params = hookParams();
		const { result } = renderHook(() => useShareCard(params as never));

		await act(async () => {
			await result.current.teilen();
		});

		expect(share).toHaveBeenCalledTimes(1);
		expect(canShare).toHaveBeenCalledWith(expect.objectContaining({ files: expect.anything() }));
		const daten = share.mock.calls[0][0] as ShareData;
		expect(daten.files?.[0]?.type).toBe('image/png');
		expect(daten.files?.[0]?.name).toBe(SVG_KARTE.dateiname);
		expect(daten.title).toBe('Wochenkarte');
		expect(daten.text).toBe('KW 41');
	});

	it('AK3: onGeteilt feuert genau einmal nach echtem System-Share (#1989)', async () => {
		installDownload();
		installShare(true);
		const onGeteilt = vi.fn();
		const { result } = renderHook(() => useShareCard(hookParams(onGeteilt) as never));

		await act(async () => {
			await result.current.teilen();
		});

		expect(onGeteilt).toHaveBeenCalledTimes(1);
	});

	it('AK3: ohne canShare bleibt share stumm, Download-Fallback greift, onGeteilt feuert nicht', async () => {
		const { klick } = installDownload();
		const { share } = installShare(false);
		const onGeteilt = vi.fn();
		const { result } = renderHook(() => useShareCard(hookParams(onGeteilt) as never));

		await act(async () => {
			await result.current.teilen();
		});

		expect(share).not.toHaveBeenCalled();
		expect(klick).toHaveBeenCalledTimes(1);
		expect(onGeteilt).not.toHaveBeenCalled();
		expect(result.current.fehler).toBe(false);
	});

	it('AK3: nicht-abort Share-Fehler fällt in den Download-Fallback, kein Fehlerzustand', async () => {
		const { klick } = installDownload();
		const { share } = installShare(true);
		share.mockRejectedValue(new Error('netz'));
		const onGeteilt = vi.fn();
		const { result } = renderHook(() => useShareCard(hookParams(onGeteilt) as never));

		await act(async () => {
			await result.current.teilen();
		});

		expect(klick).toHaveBeenCalledTimes(1);
		expect(onGeteilt).not.toHaveBeenCalled();
		expect(result.current.fehler).toBe(false);
	});

	it('AK3: AbortError ist kein Fehlerzustand — kein Fallback-Download, kein onGeteilt', async () => {
		const { klick } = installDownload();
		const { share } = installShare(true);
		share.mockRejectedValue(new DOMException('Abbruch', 'AbortError'));
		const onGeteilt = vi.fn();
		const { result } = renderHook(() => useShareCard(hookParams(onGeteilt) as never));

		await act(async () => {
			await result.current.teilen();
		});

		expect(klick).not.toHaveBeenCalled();
		expect(onGeteilt).not.toHaveBeenCalled();
		expect(result.current.fehler).toBe(false);
	});

	it('AK3: Karten-Erzeugung wirft → fehler gesetzt, kein Download und kein Share', async () => {
		const { klick } = installDownload();
		const { share } = installShare(true);
		const erzeugeSvg = vi.fn(() => {
			throw new Error('boom');
		});
		const { result } = renderHook(() => useShareCard({ erzeugeSvg, titel: 'T', text: 'x' } as never));

		await act(async () => {
			await result.current.speichern();
		});

		expect(result.current.fehler).toBe(true);
		expect(klick).not.toHaveBeenCalled();
		await act(async () => {
			await result.current.teilen();
		});
		expect(share).not.toHaveBeenCalled();
	});

	it('AK3: rastert ist nur während der Karten-Erzeugung wahr (Spinner-Zustand)', async () => {
		installDownload();
		installShare(false);
		let loese: (blob: Blob) => void = () => {};
		vi.mocked(rasterisiere).mockImplementation(
			() =>
				new Promise<Blob>((resolve) => {
					loese = resolve;
				}),
		);
		const { result } = renderHook(() => useShareCard(hookParams() as never));

		let lauf: Promise<void> = Promise.resolve();
		act(() => {
			lauf = result.current.speichern();
		});
		expect(result.current.rastert).toBe(true);

		await act(async () => {
			loese(PNG_BLOB());
			await lauf;
		});
		expect(result.current.rastert).toBe(false);
		expect(result.current.fehler).toBe(false);
	});
});

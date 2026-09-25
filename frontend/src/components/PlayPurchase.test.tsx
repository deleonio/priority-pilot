import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * #1692/#1695/#1696: Kauf, Wiederherstellen und Paketwechsel über Google Play in der Android-App. `cordova-plugin-purchase` ist als globales
 * `CdvPurchase` gemockt, API und Auth ebenso; KoliBri wie in `DeleteAccount.test.tsx`.
 */

vi.mock('@public-ui/react-v19', () => ({
	KolAlert: ({ children }: { children?: ReactNode }) => <div role="alert">{children}</div>,
	KolButton: ({ _label, _on }: { _label?: string; _on?: { onClick?: (_e: MouseEvent) => void } }) => (
		<button onClick={(e) => _on?.onClick?.(e.nativeEvent)}>{_label}</button>
	),
}));
vi.mock('../api', () => ({
	api: { submitGooglePurchase: vi.fn(() => Promise.resolve()), createBillingSubscription: vi.fn() },
}));
vi.mock('../lib/auth', () => ({ checkAuth: () => Promise.resolve({ playAccountId: 'acc-1' }) }));
const refresh = vi.fn(() => Promise.resolve());
let subscription: object | null = null;
vi.mock('../lib/usePlan', () => ({ usePlan: () => ({ subscription, refresh }) }));

import { api } from '../api';
import { usePlayPurchase } from './PlayPurchase';

let approved: ((transaction: unknown) => void) | undefined;
const finish = vi.fn(() => Promise.resolve());
const order = vi.fn();
const store = {
	applicationUsername: undefined as string | undefined,
	register: vi.fn(),
	when: () => ({ approved: (callback: (transaction: unknown) => void) => (approved = callback) }),
	initialize: vi.fn(() => Promise.resolve()),
	get: (id: string) => ({ offers: [{ id: `${id}@monthly`, pricingPhases: [{ price: '9,49 €' }], order }] }),
	restorePurchases: vi.fn(() => Promise.resolve(undefined)),
	localReceipts: [] as { platform: string; purchaseToken?: string }[],
};

beforeEach(() => {
	vi.stubGlobal('CdvPurchase', { store });
});
afterEach(() => {
	subscription = null;
	store.localReceipts = [];
	vi.clearAllMocks();
	vi.unstubAllGlobals();
});

const renderReady = async () => {
	const hook = renderHook(() => usePlayPurchase());
	await waitFor(() => expect(hook.result.current.price?.('pro', 'monthly')).toBe('9,49 €'));
	return hook;
};

describe('Kauf über Google Play (#1692)', () => {
	it('kauft das Store-Angebot, meldet den Token an den Server und lädt die Entitlements neu', async () => {
		order.mockImplementation(async () => {
			approved?.({ parentReceipt: { purchaseToken: 'tok-1' }, finish });
			return undefined;
		});
		const { result } = await renderReady();
		expect(store.applicationUsername).toBe('acc-1');

		render(<>{result.current.actionCell?.('pro', 'monthly').node}</>);
		await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Buchen' })));

		await waitFor(() => expect(finish).toHaveBeenCalled());
		expect(api.submitGooglePurchase).toHaveBeenCalledWith('tok-1');
		expect(refresh).toHaveBeenCalled();
		expect(api.createBillingSubscription).not.toHaveBeenCalled();
	});

	it('Abbruch im Store-Dialog lässt die Ansicht unverändert, ohne Fehlermeldung', async () => {
		order.mockResolvedValue({ code: 6777006, message: 'cancelled' });
		const { result } = await renderReady();

		const { rerender } = render(<>{result.current.actionCell?.('pro', 'monthly').node}</>);
		await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Buchen' })));
		rerender(<>{result.current.notice}</>);

		expect(api.submitGooglePurchase).not.toHaveBeenCalled();
		expect(screen.queryByRole('alert')).toBeNull();
	});
});

describe('Käufe wiederherstellen (#1695)', () => {
	const restore = async () => {
		const { result } = await renderReady();
		const { rerender } = render(<>{result.current.notice}</>);
		await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Käufe wiederherstellen' })));
		rerender(<>{result.current.notice}</>);
	};

	it('meldet die vorhandenen Käufe an den Server und lädt die Entitlements neu', async () => {
		store.localReceipts = [{ platform: 'android-playstore', purchaseToken: 'tok-9' }];

		await restore();

		expect(store.restorePurchases).toHaveBeenCalled();
		expect(api.submitGooglePurchase).toHaveBeenCalledWith('tok-9');
		expect(refresh).toHaveBeenCalled();
		expect(screen.getByRole('alert')).toHaveTextContent('Deine Käufe aus Google Play sind wiederhergestellt.');
	});

	it('ein abgelehnter Kauf hält die übrigen nicht auf, die Entitlements werden trotzdem neu geladen', async () => {
		store.localReceipts = [
			{ platform: 'android-playstore', purchaseToken: 'tok-alt' },
			{ platform: 'android-playstore', purchaseToken: 'tok-9' },
		];
		vi.mocked(api.submitGooglePurchase).mockRejectedValueOnce(new Error('403'));

		await restore();

		expect(api.submitGooglePurchase).toHaveBeenCalledWith('tok-9');
		expect(refresh).toHaveBeenCalled();
		expect(screen.getByRole('alert')).toHaveTextContent('Die Käufe konnten nicht wiederhergestellt werden.');
	});

	it('ohne vorhandene Käufe erscheint ein Hinweis, der Server wird nicht angefragt', async () => {
		store.localReceipts = [];

		await restore();

		expect(api.submitGooglePurchase).not.toHaveBeenCalled();
		expect(refresh).not.toHaveBeenCalled();
		expect(screen.getByRole('alert')).toHaveTextContent(
			'Für dein Google-Konto gibt es keine Käufe, die sich wiederherstellen lassen.',
		);
	});
});

describe('Paketwechsel über Google Play (#1696)', () => {
	const change = async (from: string, to: 'pro' | 'max') => {
		subscription = { provider: 'google_play', plan: from, period: 'monthly', currentPeriodEnd: '2026-10-24T10:00:00Z' };
		store.localReceipts = [{ platform: 'android-playstore', purchaseToken: 'tok-alt' }];
		order.mockResolvedValue(undefined);
		const { result } = await renderReady();
		const { rerender } = render(<>{result.current.actionCell?.(to, 'monthly').node}</>);
		await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Wechseln' })));
		rerender(<>{result.current.notice}</>);
	};

	it('Upgrade startet den Kauf mit dem alten Token und sofortigem Replacement-Mode', async () => {
		await change('pro', 'max');

		expect(order).toHaveBeenCalledWith({
			googlePlay: { oldPurchaseToken: 'tok-alt', replacementMode: 'IMMEDIATE_WITH_TIME_PRORATION' },
		});
		expect(screen.queryByRole('alert')).toBeNull();
	});

	it('Downgrade wirkt zum Periodenende und zeigt das Wechseldatum an', async () => {
		await change('max', 'pro');

		expect(order).toHaveBeenCalledWith({ googlePlay: { oldPurchaseToken: 'tok-alt', replacementMode: 'DEFERRED' } });
		expect(screen.getByRole('alert')).toHaveTextContent('Wechsel zu Pro ab 24.10.2026.');
	});
});

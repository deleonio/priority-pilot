import { render, renderHook, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Subscription } from '../lib/auth';

/**
 * #1695: Läuft das Abo über einen anderen Anbieter als den des Kanals, zeigt der Kanal den Anbieter
 * statt der Kauf-Knöpfe. Die Kaufwege selbst sind gemockt, geprüft wird nur die Weiche.
 */

vi.mock('@public-ui/react-v19', () => ({
	KolAlert: ({ _label, children }: { _label?: string; children?: ReactNode }) => (
		<div role="alert">
			{_label}
			{children}
		</div>
	),
	KolButton: ({ _label }: { _label?: string }) => <button>{_label}</button>,
	KolSpin: () => null,
}));
const channelPurchase = { actionCell: () => ({ text: 'Buchen', node: <button>Buchen</button> }), notice: null };
vi.mock('./PaypalPurchase', () => ({ usePaypalPurchase: () => channelPurchase }));
vi.mock('./PlayPurchase', () => ({ usePlayPurchase: () => channelPurchase }));
let subscription: Partial<Subscription> | null = null;
vi.mock('../lib/usePlan', () => ({ usePlan: () => ({ subscription }) }));
vi.mock('../api', () => ({ api: { listBillingInvoices: () => Promise.resolve([]) } }));

import { purchaseHookFor } from './billingChannel';
import { SubscriptionSection } from './SubscriptionSection';

const ACTIVE = {
	plan: 'pro',
	period: 'monthly',
	currentPeriodEnd: '2026-10-15T00:00:00.000Z',
	pendingPlan: null,
	graceUntil: null,
};

afterEach(() => {
	subscription = null;
	vi.unstubAllGlobals();
});

describe('Abo über einen anderen Anbieter (#1695)', () => {
	it('play: ein PayPal-Abo zeigt „verwaltet über PayPal" und keine Kauf-Knöpfe', () => {
		subscription = { ...ACTIVE, provider: 'paypal' } as Subscription;
		const { result } = renderHook(() => purchaseHookFor('play')());

		render(<>{result.current.notice}</>);

		expect(result.current.actionCell).toBeUndefined();
		expect(screen.getByRole('alert')).toHaveTextContent('Abo aktiv, verwaltet über PayPal');
		expect(screen.queryByRole('link')).toBeNull();
	});

	it('web: ein Play-Abo zeigt „verwaltet über Google Play" mit Link zur Abo-Verwaltung', () => {
		subscription = { ...ACTIVE, provider: 'google_play' } as Subscription;
		const { result } = renderHook(() => purchaseHookFor('web')());

		render(<>{result.current.notice}</>);

		expect(result.current.actionCell).toBeUndefined();
		expect(screen.getByRole('alert')).toHaveTextContent('Abo aktiv, verwaltet über Google Play');
		expect(screen.getByRole('link', { name: 'In Google Play verwalten' })).toHaveAttribute(
			'href',
			'https://play.google.com/store/account/subscriptions?package=de.balamentum.app',
		);
	});

	it('ein Abo beim eigenen Anbieter lässt den Kaufweg des Kanals unverändert', () => {
		subscription = { ...ACTIVE, provider: 'google_play' } as Subscription;
		const { result } = renderHook(() => purchaseHookFor('play')());

		expect(result.current).toBe(channelPurchase);
	});

	it('Abo-Reiter: ein Play-Abo bietet keine Kündigung über PayPal an, sondern den Anbieter', async () => {
		subscription = { ...ACTIVE, provider: 'google_play' } as Subscription;
		render(<SubscriptionSection />);

		await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Abo aktiv, verwaltet über Google Play'));
		expect(screen.queryByRole('button', { name: 'Abo kündigen' })).toBeNull();
	});
});

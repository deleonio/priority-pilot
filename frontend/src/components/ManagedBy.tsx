import { KolAlert } from '@public-ui/react-v19';
import { useTranslation } from 'react-i18next';
import type { Subscription } from '../lib/auth';

type Provider = Subscription['provider'];

const PROVIDER_LABELS: Record<Provider, string> = { paypal: 'PayPal', google_play: 'Google Play' };

/** Abo-Verwaltung von Google Play: Kündigen und Zahlungsdaten laufen dort (ADR 0017). */
const PLAY_SUBSCRIPTIONS_URL = 'https://play.google.com/store/account/subscriptions?package=de.balamentum.app';

/**
 * Hinweis, über welchen Anbieter das Abo läuft (#1695). Steht statt der Kauf- und Kündigen-Knöpfe,
 * wenn der Kanal das Abo nicht selbst verwaltet; ein Play-Abo verlinkt auf die Abo-Verwaltung.
 */
export const ManagedBy = ({ provider }: { provider: Provider }) => {
	const { t } = useTranslation('messages');
	return (
		<KolAlert _type="info" _label={t('billing.managedBy', { provider: PROVIDER_LABELS[provider] })}>
			{provider === 'google_play' && (
				<a href={PLAY_SUBSCRIPTIONS_URL} target="_blank" rel="noopener noreferrer">
					{t('billing.manageInPlay')}
				</a>
			)}
		</KolAlert>
	);
};
